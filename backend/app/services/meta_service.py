"""Ảnh và mô tả tạm cho địa điểm, lấy từ thẻ <meta> OpenGraph của chính website nó.

Đây là nguồn CHỮA CHÁY sau khi bỏ DataForSEO, không phải nguồn thay thế: thẻ
OpenGraph có ảnh và mô tả, KHÔNG có giờ mở cửa và KHÔNG có điểm đánh giá dạng số.
Hai thứ đó vẫn thiếu (xem README §4).

Đây cũng chính là việc mọi trang xem trước liên kết đều làm — Facebook, Zalo,
Slack đều đọc đúng mấy thẻ này khi bạn dán một đường dẫn. Ta chỉ đọc trang mà
địa điểm tự khai trong `tags->>'website'`, đọc một lần rồi lưu cứng.

Đo thật trên 45 địa điểm ngẫu nhiên (2026-09-04):

    nguồn        có website   lấy được meta   ghi chú
    trang riêng    274.817       7/25 (28%)   13/25 tên miền đã chết
    facebook        17.737      11/12 (92%)   mô tả kèm số lượt thích
    zalo             8.147       0/8  ( 0%)   luôn trả trang đăng nhập
    google           3.769       0/3  ( 0%)   link tìm kiếm, không có OG

Nên bỏ hẳn zalo và google: gọi vào đó chỉ tốn thời gian chờ.
"""

import html
import re
import urllib.request

from app.core.database import execute_query
from app.core.logging import get_logger

logger = get_logger(__name__)

UA = "Mozilla/5.0 (compatible; DiDauBot/0.1; +khoa-luan-tot-nghiep)"
TIMEOUT_S = 6
MAX_BYTES = 150_000          # thẻ meta nằm trong <head>, không cần tải cả trang

# Miền không bao giờ trả OG hữu ích — xem bảng đo ở đầu file.
MIEN_BO_QUA = ("zalo.me", "zalo.vn", "google.com/search", "google.com/maps",
               "goo.gl", "facebook.com/groups")

_M1 = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](og:title|og:description|og:image|description)["\']'
    r'[^>]*content=["\']([^"\']*)', re.I)
_M2 = re.compile(
    r'<meta[^>]+content=["\']([^"\']*)["\']'
    r'[^>]*(?:property|name)=["\'](og:title|og:description|og:image|description)', re.I)


def bo_qua(url: str) -> bool:
    u = (url or "").lower()
    return not u.startswith(("http://", "https://")) or any(m in u for m in MIEN_BO_QUA)


def _mo_ta_dung_duoc(url: str, mo_ta: str) -> bool:
    """Lọc mô tả rác của Facebook.

    Link Facebook của một địa điểm hay trỏ vào TRANG CÁ NHÂN của chủ quán, nên
    og:description thành tên người ("Chí Nguyện. 5.369 lượt thích") hoặc thành
    câu mời chào chung ("... đang ở trên Facebook. Tham gia Facebook để kết
    nối..."). Trang doanh nghiệp thật thì mô tả luôn có số lượt thích.
    """
    if "facebook.com" not in url.lower():
        return True
    if "đang ở trên Facebook" in mo_ta or "Tham gia Facebook" in mo_ta:
        return False
    return "lượt thích" in mo_ta or "likes" in mo_ta.lower()


def doc_og(url: str) -> dict | None:
    """Đọc thẻ OpenGraph của một URL. Trả None nếu không lấy được gì."""
    if bo_qua(url):
        return None
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": UA, "Accept-Language": "vi,en;q=0.8"})
        raw = urllib.request.urlopen(req, timeout=TIMEOUT_S).read(MAX_BYTES)
    except Exception as e:
        # Tên miền chết là chuyện thường với dữ liệu Overture — 13/25 trang riêng
        # trong mẫu đo. Ghi DEBUG chứ không WARNING, nếu không log ngập.
        logger.debug("Không đọc được %s: %s", url[:80], type(e).__name__)
        return None

    trang = raw.decode("utf8", "replace")
    d = {k.lower(): html.unescape(v).strip() for k, v in _M1.findall(trang)}
    for v, k in _M2.findall(trang):
        d.setdefault(k.lower(), html.unescape(v).strip())

    mo_ta = d.get("og:description") or d.get("description") or ""
    if mo_ta and not _mo_ta_dung_duoc(url, mo_ta):
        mo_ta = ""

    ket = {k: v for k, v in {
        "tieu_de": d.get("og:title", ""),
        "mo_ta": mo_ta,
        "anh": d.get("og:image", ""),
    }.items() if v}
    return ket or None


def bo_sung(place: dict) -> dict:
    """Gắn `place['mo_ta_web']` và ảnh nếu chưa có. Gọi API ngoài đúng MỘT lần.

    Kết quả lưu vào `place_photos.details->'meta'`, kể cả khi thất bại — nếu
    không, mỗi lượt xem một địa điểm có tên miền chết lại phải chờ hết timeout.
    """
    if not place or not place.get("id"):
        return place
    web = (place.get("website") or "").strip()
    if not web:
        return place

    p_type, p_id = place.get("type") or "poi", place["id"]
    rows = execute_query(
        "SELECT details FROM place_photos WHERE place_type = %s AND place_id = %s",
        (p_type, p_id)) or []
    chi_tiet = (rows[0]["details"] if rows else None) or {}

    meta = chi_tiet.get("meta")
    if meta is None:
        meta = doc_og(web) or {}
        chi_tiet["meta"] = meta
        _luu(p_type, p_id, chi_tiet)
        logger.info("Meta %s#%s từ %s: %s", p_type, p_id, web[:60],
                    ", ".join(meta) or "không có gì")

    if meta.get("mo_ta"):
        place["mo_ta_web"] = meta["mo_ta"]
    if meta.get("anh") and not place.get("anh"):
        place["anh"] = meta["anh"]
        place["anh_nguon"] = "Trang web của địa điểm"
    return place


def _luu(p_type: str, p_id: int, chi_tiet: dict):
    import json
    try:
        execute_query(
            """
            -- url là NOT NULL nên lưu chuỗi rỗng thay cho NULL. Mã đọc ảnh
            -- kiểm truthy (`if rows[0].get("url")`) nên chuỗi rỗng vẫn được
            -- hiểu đúng là "chưa có ảnh".
            INSERT INTO place_photos (place_type, place_id, url, details)
            VALUES (%s, %s, '', %s::jsonb)
            ON CONFLICT (place_type, place_id)
            DO UPDATE SET details = EXCLUDED.details
            """,
            (p_type, p_id, json.dumps(chi_tiet, ensure_ascii=False)),
        )
    except Exception as e:
        logger.warning("Không lưu được meta %s#%s: %s", p_type, p_id, e)
