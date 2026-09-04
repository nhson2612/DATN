"""Client Tavily và chuẩn hoá kết quả có bằng chứng.

Nguyên tắc: raw `answer` của Tavily KHÔNG được làm bằng chứng. Một field chỉ
được nhận khi nó xuất hiện trong `results[].content` của một result đã qua bước
định danh (domain trùng website Overture / phone trùng / tên + locality cùng
xuất hiện). Result không qua định danh vẫn nằm trong raw_response để debug
nhưng không bao giờ thành field hiển thị.

Không bao giờ log secret hay toàn bộ raw response.
"""

import re
import unicodedata
from urllib.parse import urlparse

import requests

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

MAX_RESPONSE_BYTES = 1_048_576          # 1 MiB
MAX_IMAGES = 8
MAX_SOURCES = 8
MAX_HIGHLIGHTS = 3
MAX_SUMMARY = 600
MAX_EVIDENCE = 280
MAX_CONTENT = 600

INSTRUCTION = ("Find current opening hours, rating, review count, "
               "representative review highlights, short travel description "
               "and official photos. Distinguish the exact branch.")

# Nhãn giờ mở cửa có DẢI đầy đủ ("Opening Hours: 8:00 AM – 10:00 PM").
RANGE_RE = re.compile(
    r"(?:opening hours?|hours?|giờ mở cửa)\s*[:\-]?\s*"
    r"(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]\s*"
    r"\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", re.I)
# Chỉ có một vế đóng ("Closes at 22:00"): KHÔNG tự bịa giờ mở cửa.
CLOSE_RE = re.compile(
    r"(?:closes?|đóng cửa)(?:\s+at|\s+lúc)?\s+(\d{1,2}:\d{2})", re.I)

# Rating có review count ngay trong ngoặc: "4.7 (7,813 reviews)".
PAREN_RE = re.compile(r"(\d(?:[.,]\d{1,2})?)\s*\(([^()]*\d[^()]*)\)")
# Rating có nhãn rõ ràng: "4.5/5", "4 stars", "4,7 sao".
LABEL_RE = re.compile(
    r"(\d(?:[.,]\d{1,2})?)\s*(?:/5|out\s*of\s*5|stars?|sao)\b", re.I)
# Số đánh giá — ba dạng:
#   "7,813"/"7.813" : nhóm nghìn (dấu phẩy kiểu Anh, dấu chấm kiểu Việt)
#   "66K"/"66K+"/"1.2k" : viết tắt triệu/trăm
#   "7813" trần : CHỈ nhận khi kèm nhãn reviews/đánh giá (số trần lẻ loi dễ là năm)
_SO_NHOM_NGHIN = r"\d{1,3}(?:[.,]\d{3})+"
_SO_K = r"\d+(?:[.,]\d+)?[Kk]\+?"
_SO_TRAN_NHAN = r"\d{4,}(?=\s*(?:reviews?|ratings?|đánh giá|đánh giá))"
_COUNT_RE = re.compile(
    rf"({_SO_NHOM_NGHIN}|{_SO_K}|{_SO_TRAN_NHAN})"
    r"\s*(?:reviews?|ratings?|đánh giá|đánh giá)?", re.I)

_QUANG_CAO_RE = re.compile(
    r"\b(?:book|booking|reserve|reservation|tour|ticket|price|deposit|"
    r"discount|depart|itinerary|combo|offer|save|promo|promotion|"
    r"đặt vé|khuyến mãi|ưu đãi|combo|tour trọn gói)\b|\$\s?\d", re.I)
_TICH_CUC = ("tuyệt vời", "tuyệt", "đẹp", "ngon", "ấn tượng", "thích",
             "wonderful", "amazing", "beautiful", "delicious", "great",
             "excellent", "recommend", "friendly", "clean", "must-see",
             "đáng", "đáng để", "bổ ích", "nên thử")
_TIEU_CUC = ("tệ", "chê", "chật", "bẩn", "đông", "awful", "worst",
             "disappoint", "dirty", "expensive", "overpriced", "boring",
             "không đáng", "thất vọng")

# Câu khẳng định rating/giờ mở cửa — không có bằng chứng thì không vào summary.
_KHAI_GIU_RE = re.compile(
    r"\d+(?:[.,]\d+)?|review|star|đánh giá|đánh giá|sao|"
    r"(?:opens?|closes?|open now)|hours?|giờ mở cửa|đóng cửa", re.I)


class TavilyError(Exception):
    """Lỗi gốc của mọi lỗi Tavily."""


class TavilyConfigurationError(TavilyError):
    """Thiếu key hoặc cấu hình sai — lỗi của hệ thống, không phải mạng."""


class TavilyTransientError(TavilyError):
    """DNS/timeout/HTTP 429/5xx — thử lại được ở lần mở sau."""


# ── Tiện ích chuẩn hoá ──────────────────────────────────────────────────────

def _norm(s: str) -> str:
    """Bỏ dấu, hạ chữ, gộp khoảng trắng: 'Đà Nẵng' -> 'da nang'."""
    s = unicodedata.normalize("NFD", str(s).casefold().replace("đ", "d"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def _host(url) -> str | None:
    """Tên miền (không www, không scheme) — None nếu URL không phải HTTP(S)."""
    try:
        p = urlparse(str(url))
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    return p.netloc.lower().removeprefix("www.")


def _rut_gon(s: str, gioi_han: int) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()[:gioi_han]


def _official(place: dict, url: str) -> bool:
    """Result trùng domain với website Overture của địa điểm."""
    web = place.get("website")
    if not web:
        return False
    return bool(_host(web)) and _host(web) == _host(url)


def _name_ngrams(place: dict) -> list[str]:
    """Bigram liên tiếp của tên đã chuẩn hoá; tên 1 từ thì dùng chính nó."""
    tokens = _norm(place.get("name") or "").split()
    if not tokens:
        return []
    if len(tokens) == 1:
        return tokens
    return [" ".join(tokens[i:i + 2]) for i in range(len(tokens) - 1)]


def _locality(place: dict) -> str:
    """Locality để khoá đúng chi nhánh: thành phố, nếu thiếu thì địa chỉ."""
    return _norm(place.get("thanh_pho") or place.get("dia_chi") or "")


def _ten_locality_khop(place: dict, text: str) -> bool:
    """Tên + locality cùng xuất hiện — đủ chặt để loại chi nhánh sai tỉnh."""
    t = _norm(text)
    if not t or not any(b in t for b in _name_ngrams(place)):
        return False
    lo = _locality(place)
    return not lo or lo in t


def _phone_khop(place: dict, text: str) -> bool:
    """Phone trùng (so sánh chuỗi số). Chấp nhận '84' đứng đầu hoặc '0' + phần sau."""
    dt = re.sub(r"\D", "", str(place.get("dien_thoai") or ""))
    if not dt:
        return False
    dang = {dt}
    if dt.startswith("84"):
        dang.add("0" + dt[2:])
    chuoi_so = re.sub(r"\D", "", text)
    return any(d in chuoi_so for d in dang if d)


def _result_matches(place: dict, result: dict) -> bool:
    """Gắn một result với đúng địa điểm bằng ít nhất một bằng chứng."""
    url = result.get("url") or ""
    if _official(place, url):
        return True
    text = _norm(f"{result.get('title') or ''} {result.get('content') or ''}")
    if _phone_khop(place, text):
        return True
    return _ten_locality_khop(place, text)


def _parse_review_count(s: str):
    """'7,813' -> 7813 · '7.813' -> 7813 · '66K reviews'/'66K+' -> 66000.

    Nhóm nghìn bóc dấu rồi int() — KHÔNG qua float(), vì "7,813" mà thành
    "7.813" sẽ ra 8. Dạng K thì là số thập phân thật (1.2k = 1200).
    """
    m = re.match(
        rf"\s*({_SO_NHOM_NGHIN}|{_SO_K}|{_SO_TRAN_NHAN})"
        r"\s*(?:reviews?|ratings?|đánh giá|đánh giá)?\s*$", str(s), re.I)
    if not m:
        return None
    raw = m.group(1)
    if "k" in raw.lower():
        return int(round(
            float(raw.lower().replace("k", "").replace("+", "")
                  .replace(",", ".")) * 1000))
    return int(raw.replace(",", "").replace(".", ""))


def _count_trong(text: str, vi_tri: int) -> int | None:
    """Số đánh giá gần vi_tri (trong phạm vi 100 ký tự) — đọc các dạng K/k."""
    vung = text[max(0, vi_tri - 100): vi_tri + 100]
    for m in _COUNT_RE.finditer(vung):
        gt = m.group(0)
        # "7813" trần không kèm nhãn reviews — dễ nhầm năm, bỏ qua; còn
        # "7813 reviews", "7,813", "66K+" là dạng có chủ ý nên nhận.
        if re.fullmatch(r"\d+", gt):
            continue
        dem = _parse_review_count(gt)
        if dem is not None:
            return dem
    return None


def _rating_candidates(result: dict) -> list[dict]:
    """Mọi cặp (rating, review_count) xuất hiện TRONG MỘT result content.

    Mỗi ứng viên có bằng chứng là substring khớp trong content gốc.
    """
    noi_dung = str(result.get("content") or "")
    url = result.get("url") or ""
    cu = []

    for m in PAREN_RE.finditer(noi_dung):
        try:
            value = float(m.group(1).replace(",", "."))
        except ValueError:
            continue
        dem = _count_trong(m.group(2), len(m.group(2)) // 2) or _count_trong(noi_dung, m.start())
        if not (0 <= value <= 5):
            continue
        cu.append({"value": value, "review_count": dem,
                   "evidence": m.group(0).strip()})

    for m in LABEL_RE.finditer(noi_dung):
        try:
            value = float(m.group(1).replace(",", "."))
        except ValueError:
            continue
        if not (0 <= value <= 5):
            continue
        cu.append({"value": value,
                   "review_count": _count_trong(noi_dung, m.end()),
                   "evidence": m.group(0).strip()})

    # Bỏ trùng (value, count) — hai pattern có thể cùng khớp một chỗ.
    da_thay, loc = set(), []
    for c in cu:
        khoa = (c["value"], c["review_count"])
        if khoa not in da_thay:
            da_thay.add(khoa)
            loc.append(c)
    return loc


def _extract_rating(place: dict, matched: list[dict]) -> dict | None:
    """Chọn rating tốt nhất: website chính thức, rồi count lớn, rồi score.

    Không trộn rating của nguồn này với review count của nguồn khác — mỗi ứng
    viên tự mang cặp (value, count) từ MỘT result. Không suy diễn histogram.
    """
    ung_vien = []
    for r in matched:
        for c in _rating_candidates(r):
            ung_vien.append({
                **c, "url": r.get("url") or "",
                "host": _host(r.get("url")) or "",
                "score": float(r.get("score") or 0),
                "official": _official(place, r.get("url") or ""),
            })
    if not ung_vien:
        return None
    ung_vien.sort(key=lambda c: (
        0 if c["official"] else 1,
        -(c["review_count"] or -1),
        -(c["score"] or 0),
    ))
    tot = ung_vien[0]
    return {
        "value": tot["value"],
        "review_count": tot["review_count"],
        "provider": tot["host"] or None,
        "source_url": tot["url"],
        "evidence": tot["evidence"][:MAX_EVIDENCE],
    }


def _gio_24(txt: str):
    """'8:00 AM' -> (8,0) · '10:00 PM' -> (22,0) · '22:00' -> (22,0)."""
    m = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", txt.strip(), re.I)
    if not m:
        return None
    hh, mm = int(m.group(1)), int(m.group(2) or 0)
    ap = (m.group(3) or "").lower()
    if ap == "pm" and hh < 12:
        hh += 12
    if ap == "am" and hh == 12:
        hh = 0
    return hh, mm


def _extract_hours(place: dict, matched: list[dict]) -> dict | None:
    """Giờ mở cửa chỉ từ result CÓ DẢI hoặc CÓ VẾ ĐÓNG — không bịa vế còn thiếu."""
    danh_sach = sorted(matched, key=lambda r: (
        0 if _official(place, r.get("url") or "") else 1,
        -(float(r.get("score") or 0)),
    ))
    for r in danh_sach:
        noi_dung = str(r.get("content") or "")
        m = RANGE_RE.search(noi_dung)
        if m:
            hai_dau = re.split(r"\s*[–—-]\s*", m.group(1))
            gio = [_gio_24(t) for t in hai_dau[:2]]
            if len(gio) == 2 and all(gio):
                dau, cuoi = gio
                return {
                    "display": f"{dau[0]:02d}:{dau[1]:02d}–{cuoi[0]:02d}:{cuoi[1]:02d} hằng ngày",
                    "weekly": None,
                    "source_url": r.get("url") or "",
                    "evidence": m.group(0).strip()[:MAX_EVIDENCE],
                }
        m = CLOSE_RE.search(noi_dung)
        if m:
            return {
                "display": f"Đóng cửa lúc {_rut_gon(m.group(1), 5)}",
                "weekly": None,
                "source_url": r.get("url") or "",
                "evidence": m.group(0).strip()[:MAX_EVIDENCE],
            }
    return None


_TU_TICH_CUC = tuple(_norm(w) for w in _TICH_CUC)
_TU_TIEU_CUC = tuple(_norm(w) for w in _TIEU_CUC)


def _sentiment(cau: str) -> str | None:
    n = _norm(cau)
    duong = sum(w in n for w in _TU_TICH_CUC)
    am = sum(w in n for w in _TU_TIEU_CUC)
    if duong > am:
        return "positive"
    if am > duong:
        return "negative"
    return None


def _extract_review(result: dict) -> dict | None:
    """Một nhận xét đại diện (có cảm xúc rõ) từ content của một result."""
    noi_dung = str(result.get("content") or "")
    for cau in re.split(r"(?<=[.!?…])\s+|\n+", noi_dung):
        cau = cau.strip()
        if not (20 <= len(cau) <= 280):
            continue
        if _QUANG_CAO_RE.search(cau):
            continue                        # quảng cáo/tour không phải review
        tinh_cam = _sentiment(cau)
        if not tinh_cam:
            continue
        return {"text": cau, "sentiment": tinh_cam,
                "source_title": _rut_gon(result.get("title") or "", 200),
                "source_url": result.get("url") or ""}
    return None


def _safe_images(payload: dict, place: dict) -> list[dict]:
    """Tối đa 8 ảnh HTTPS, chỉ giữ ảnh có title/description khớp địa điểm."""
    ket_qua = []
    for img in payload.get("images") or []:
        if not isinstance(img, dict):
            continue
        url = img.get("url") or ""
        if not str(url).startswith("https://") or not _host(url):
            continue
        mo_ta = _norm(f"{img.get('title') or ''} {img.get('description') or ''}")
        if mo_ta and not _ten_locality_khop(place, mo_ta):
            continue                        # ảnh của chi nhánh/địa danh khác
        ket_qua.append({
            "url": _rut_gon(url, 500),
            "title": _rut_gon(img.get("title") or "", 200),
            "description": _rut_gon(img.get("description") or "", 300),
            "host": _host(url),
        })
        if len(ket_qua) >= MAX_IMAGES:
            break
    return ket_qua


def _safe_summary(place: dict, payload: dict, matched: list[dict]) -> str | None:
    """Summary từ answer sau khi bỏ câu khẳng định rating/hours không bằng chứng.

    Không lọc được (answer rỗng hoặc toàn câu khẳng định) thì ghép content của
    hai result qua định danh có score cao nhất.
    """
    cau_giu = []
    for cau in re.split(r"(?<=[.!?…])\s+|\n+", str(payload.get("answer") or "")):
        cau = cau.strip()
        if not cau:
            continue
        if _KHAI_GIU_RE.search(cau):
            continue                        # có số/giờ/rating chưa kiểm chứng
        cau_giu.append(cau)
    if cau_giu:
        return " ".join(cau_giu)[:MAX_SUMMARY]

    noi = []
    for r in matched[:2]:
        nd = str(r.get("content") or "").strip()
        if nd:
            noi.append(_rut_gon(nd, 300))
    return (" ".join(noi)[:MAX_SUMMARY]) or None


def _safe_sources(matched: list[dict]) -> list[dict]:
    """Tối đa 8 nguồn HTTP(S) đã qua định danh, loại trùng theo canonical URL."""
    ket_qua, da_thay = [], set()
    for r in matched:
        url = str(r.get("url") or "")
        if not _host(url):
            continue
        chuan = _norm(url).rstrip("/")
        if chuan in da_thay:
            continue
        da_thay.add(chuan)
        ket_qua.append({
            "title": _rut_gon(r.get("title") or "", 200),
            "url": _rut_gon(url, 500),
            "content": _rut_gon(r.get("content") or "", MAX_CONTENT),
            "score": float(r.get("score") or 0),
        })
        if len(ket_qua) >= MAX_SOURCES:
            break
    return ket_qua


# ── API công khai ───────────────────────────────────────────────────────────

def build_query(place: dict) -> str:
    """Dựng câu hỏi từ dữ liệu Overture — không dùng text người dùng gõ."""
    phan = [str(place.get("name") or "").strip()]
    for khoa in ("dia_chi", "thanh_pho"):
        gt = place.get(khoa)
        if gt:
            phan.append(str(gt).strip())
    q = ", ".join(p for p in phan if p)

    bo_sung = []
    if place.get("dien_thoai"):
        bo_sung.append(str(place["dien_thoai"]).strip())
    web = place.get("website")
    if web:
        bo_sung.append(_host(web) or str(web).strip())
    if place.get("social"):
        bo_sung.append(str(place["social"]).strip())
    if bo_sung:
        q += " - " + " ".join(bo_sung)
    return f"{q}. {INSTRUCTION}"


def search(place: dict, post=requests.post) -> dict:
    """Một Tavily Search với giới hạn thời gian và dung lượng.

    Trả payload thô (results/images/answer). Mọi HTTP 429/5xx, timeout, DNS và
    response quá 1 MiB đều là lỗi tạm thời; thiếu API key là lỗi cấu hình.
    """
    key = (settings.tavily_api_key or "").strip()
    if not key:
        raise TavilyConfigurationError(
            "TAVILY_API_KEY chưa được cấu hình (đọc cả tên cũ TAVILI_API_KEY).")

    payload = {
        "query": build_query(place),
        "topic": "general",
        "search_depth": "basic",
        "max_results": 8,
        "include_answer": True,
        "include_images": True,
        "include_image_descriptions": True,
        "include_raw_content": False,
    }
    logger.info("Tavily search cho địa điểm %r (%d ký tự query)",
                place.get("name"), len(payload["query"]))

    try:
        response = post(
            settings.tavily_url,
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
            timeout=settings.tavily_timeout,
        )
    except requests.exceptions.Timeout as e:
        raise TavilyTransientError(f"Tavily timeout sau {settings.tavily_timeout}s") from e
    except requests.exceptions.RequestException as e:
        raise TavilyTransientError(f"Không tới được Tavily: {e}") from e

    if response.status_code == 429 or response.status_code >= 500:
        raise TavilyTransientError(f"Tavily HTTP {response.status_code}")
    response.raise_for_status()

    if len(response.content) > MAX_RESPONSE_BYTES:
        raise TavilyTransientError(
            f"Response Tavily {len(response.content)} byte > {MAX_RESPONSE_BYTES}")
    try:
        data = response.json()
    except ValueError as e:
        raise TavilyTransientError("Response Tavily không phải JSON") from e
    if not isinstance(data.get("results"), list) or not isinstance(data.get("images"), list):
        raise TavilyTransientError("Response Tavily thiếu results/images")
    return data


def normalize(place: dict, payload: dict) -> dict:
    """Payload Tavily thô -> shape ổn định, chỉ giữ field có bằng chứng."""
    results = [r for r in payload.get("results") or [] if isinstance(r, dict)]
    matched = [r for r in results if _result_matches(place, r)]
    matched.sort(key=lambda r: float(r.get("score") or 0), reverse=True)

    return {
        "summary": _safe_summary(place, payload, matched),
        "opening_hours": _extract_hours(place, matched),
        "rating": _extract_rating(place, matched),
        "review_highlights": _lay_highlights(matched),
        "images": _safe_images(payload, place),
        "sources": _safe_sources(matched),
    }


def _lay_highlights(matched: list[dict]) -> list[dict]:
    ket_qua, da_thay = [], set()
    for r in matched:
        rv = _extract_review(r)
        if rv and rv["text"] not in da_thay:
            da_thay.add(rv["text"])
            ket_qua.append(rv)
        if len(ket_qua) >= MAX_HIGHLIGHTS:
            break
    return ket_qua
