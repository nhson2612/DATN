"""Tìm địa điểm bằng suy luận NHIỀU BƯỚC, mỗi bước chạm dữ liệu thật.

Vì sao không phải một phát ăn ngay (IR cũ, xem app/research/ir_agent.py): ở đó
LLM phải chọn bảng, cột, giá trị enum, toán tử không gian — tất cả TRƯỚC khi
nhìn thấy một dòng dữ liệu nào. Nó đoán trong bóng tối và bịa ra `tourism="beach"`
hay `amenity="karaoke"` vốn không tồn tại.

Vì sao cũng không phải luật cắm cứng (bản tất định trong search_service.py): ở
đó mọi quyết định là hằng số tôi tự nghĩ ra — danh sách giới từ, 30 hư từ, bán
kính 3000m, vòng rút gọn n-gram. Bán kính 3000m làm "quán cà phê ở tỉnh Hà Tĩnh"
trả rỗng dù trong tỉnh có 101 quán, vì tâm tỉnh rơi vào vùng núi.

Ở đây chia nhỏ thành các bước, mỗi bước LLM chỉ quyết ĐÚNG MỘT việc và luôn
quyết trên dữ liệu có thật:

    B1  TÁCH Ý ĐỊNH   LLM: câu hỏi -> cần tìm gì / địa danh nào / "trong" hay "gần"
                      Chữ tự do, KHÔNG có danh sách enum để bịa.
    B2  PHÂN GIẢI MỐC DB tra tên -> các ứng viên CÓ THẬT.
                      LLM chỉ được chọn trong số đó; nhập nhằng thì hỏi lại người dùng.
    B3  CHỌN PHẠM VI  Lấy từ HÌNH DẠNG mốc, không từ hằng số:
                      mốc là vùng -> tìm trong ranh giới; mốc là điểm -> bán kính.
    B4  TÌM           Khớp mờ trên tên và loại thật trong CSDL.
    B5  XEM KẾT QUẢ   LLM nhìn số dòng và tên thật trả về rồi quyết bước tiếp:
                      xong / nới từ khoá / mở rộng phạm vi / bỏ mốc.
                      Quay lại B4. Đây là chỗ "nhiều bước" thật sự — có vòng phản
                      hồi từ kết quả, thay vì rút gọn n-gram máy móc.

LLM hỏng hoặc quá chậm thì rơi về đường tất định trong search_service — chậm và
thô còn hơn trả 504.
"""

import json

from app.core.config import settings
from app.core.logging import get_logger, log_duration
from app.llm.adapter import query_llm
from app.services import search_service as ts

logger = get_logger(__name__)

MAX_VONG = 3          # số vòng B4-B5 tối đa; mỗi vòng là một truy vấn + một lượt LLM
TIMEOUT_BUOC = 25     # mỗi bước là một câu JSON ngắn, quá số này thì không đáng chờ
MAU_TEN = 8           # số tên thật đưa cho LLM xem ở B5
BAN_KINH_TOI_DA = 50_000


class LLMKhongDung(Exception):
    """LLM không trả JSON dùng được — gọi hàm để rơi về đường tất định."""


def _hoi_llm(system, prompt, buoc):
    with log_duration(logger, f"B{buoc} gọi LLM"):
        raw = query_llm(prompt, system, json_mode=True,
                        timeout=min(TIMEOUT_BUOC, settings.llm_timeout))
    try:
        out = json.loads(raw)
    except (ValueError, TypeError) as e:
        logger.warning("B%s LLM trả JSON hỏng: %r", buoc, (raw or "")[:200])
        raise LLMKhongDung(str(e))
    logger.info("B%s LLM -> %s", buoc, json.dumps(out, ensure_ascii=False)[:300])
    return out


# ── B1: tách ý định ──────────────────────────────────────────────────────────

SYS_TACH = """Bạn tách câu hỏi du lịch tiếng Việt thành các phần.

Trả về JSON đúng các khoá sau, KHÔNG thêm khoá nào khác:
{"tim": "...", "dia_danh": "...", "pham_vi": "trong" | "gan"}

  tim       loại địa điểm hoặc tên cần tìm, viết ngắn gọn như người Việt gọi.
            Bỏ hết từ mô tả cảm tính (ngon, đẹp, giá rẻ, nổi tiếng, view đẹp).
  dia_danh  tên nơi chốn xuất hiện trong câu, GIỮ NGUYÊN như người dùng viết.
            Không có thì để chuỗi rỗng.
  pham_vi   "trong" nếu người dùng muốn ở BÊN TRONG địa danh đó (ở, tại, khu vực).
            "gan"   nếu muốn ở GẦN nó (gần, cạnh, quanh, cách ... m).

Không suy diễn thêm. Không tự thêm tên tỉnh mà câu hỏi không nhắc tới.

Ví dụ:
"quán cà phê ở tỉnh Hà Tĩnh"        -> {"tim":"quán cà phê","dia_danh":"tỉnh Hà Tĩnh","pham_vi":"trong"}
"khách sạn gần biển Mỹ Khê"         -> {"tim":"khách sạn","dia_danh":"biển Mỹ Khê","pham_vi":"gan"}
"quán bún đậu ngon quanh đây"       -> {"tim":"quán bún đậu","dia_danh":"","pham_vi":"gan"}
"cho tôi mấy cái chùa cổ ở Huế"     -> {"tim":"chùa","dia_danh":"Huế","pham_vi":"trong"}"""


def b1_tach_y_dinh(question):
    out = _hoi_llm(SYS_TACH, f"Câu hỏi: {question}\nTrả JSON.", 1)
    tim = str(out.get("tim") or "").strip()
    if not tim:
        raise LLMKhongDung("LLM không tách được thứ cần tìm")
    return tim, str(out.get("dia_danh") or "").strip(), \
        ("trong" if out.get("pham_vi") == "trong" else "gan")


# ── B2: phân giải mốc trên dữ liệu thật ──────────────────────────────────────

SYS_CHON_MOC = """Người dùng nhắc tới một địa danh. Dưới đây là các địa danh CÓ
THẬT trong cơ sở dữ liệu có tên khớp. Chọn đúng một cái.

Trả JSON: {"chon": <số thứ tự>} nếu chắc chắn,
hoặc {"chon": null, "hoi_lai": "câu hỏi ngắn cho người dùng"} nếu thật sự nhập nhằng.

Chỉ được chọn trong danh sách. Không bịa thêm địa danh nào."""


def b2_phan_giai_moc(dia_danh, lon, lat, tu_dong=True, chinh_xac=None):
    """Trả (mốc, câu_hỏi_lại). Không có ứng viên -> (None, None).

    `chinh_xac` là tên người dùng ĐÃ CHỌN ở lượt hỏi lại trước. Phải khớp đúng
    tên đó, không được lấy ứng viên đầu danh sách: hỏi "Hà Tĩnh (điểm) hay Tỉnh
    Hà Tĩnh (vùng)?" rồi người dùng chọn tỉnh mà vẫn tìm quanh cái điểm thì lượt
    hỏi lại thành vô nghĩa.
    """
    ung_vien = ts.anchor_candidates(dia_danh, lon, lat)
    if not ung_vien:
        logger.info("B2 không có địa danh nào tên %r trong CSDL", dia_danh)
        return None, None
    if chinh_xac:
        khop = [c for c in ung_vien
                if ts._norm(c["name"]) == ts._norm(chinh_xac)]
        if khop:
            logger.info("B2 dùng lựa chọn của người dùng: %r", khop[0]["name"])
            return khop[0], None
        logger.warning("B2 %r không còn trong danh sách ứng viên", chinh_xac)
    if len(ung_vien) == 1 or tu_dong:
        m = ung_vien[0]
        logger.info("B2 mốc: %s %r %s", m["kind"], m["name"],
                    "[vùng]" if m["la_vung"] else "[điểm]")
        return m, None

    ds = "\n".join(
        f'{i}. {c["name"]} ({"vùng" if c["la_vung"] else "điểm"}, '
        f'cách bạn {c["d"] / 1000:.0f} km)'
        for i, c in enumerate(ung_vien)
    )
    out = _hoi_llm(SYS_CHON_MOC, f'Người dùng viết: "{dia_danh}"\n\n{ds}\n\nTrả JSON.', 2)
    i = out.get("chon")
    if isinstance(i, int) and 0 <= i < len(ung_vien):
        return ung_vien[i], None
    return None, out.get("hoi_lai") or f'Ý bạn là "{ung_vien[0]["name"]}" hay nơi khác?'


# ── B3: phạm vi lấy từ hình dạng mốc ─────────────────────────────────────────

def b3_pham_vi(moc, y_dinh):
    """Trả (trong_vung, bán_kính_m).

    Không có hằng số bán kính mặc định cho mọi trường hợp: mốc là vùng thì tìm
    trong chính vùng đó, mốc là điểm thì bán kính suy từ độ lớn của mốc.
    """
    if moc is None:
        return False, ts.ban_kinh_quanh_diem(None)
    if moc["la_vung"] and y_dinh == "trong":
        return True, None
    # "gần <một vùng>" — đo từ mép vùng, bán kính theo cỡ của chính vùng đó.
    return False, min(ts.ban_kinh_quanh_diem(moc), BAN_KINH_TOI_DA)


# ── B5: nhìn kết quả thật rồi quyết bước tiếp ────────────────────────────────

SYS_QUYET = """Bạn đang tìm địa điểm cho người dùng. Dưới đây là kết quả THẬT của
lần tìm vừa rồi. Quyết định bước tiếp theo.

Trả JSON: {"hanh_dong": "...", "tim": "...", "ly_do": "..."}

hanh_dong nhận đúng một trong bốn giá trị:
  "xong"        kết quả đã dùng được, dừng lại.
  "noi_tu_khoa" từ khoá quá hẹp hoặc quá dài, thử từ khoá ngắn/chung hơn.
                Bắt buộc kèm khoá "tim" là từ khoá mới.
  "mo_rong"     đúng loại nhưng quá ít, nới rộng phạm vi tìm.
  "bo_moc"      địa danh có thể sai, thử tìm quanh vị trí người dùng.

Nguyên tắc:
- Có từ 5 kết quả đúng loại trở lên thì "xong".
- 0 kết quả và từ khoá nhiều hơn 2 từ thì "noi_tu_khoa" (ví dụ "quán bún đậu mắm tôm" -> "bún đậu").
- 0 kết quả với từ khoá đã ngắn thì "mo_rong".
- Kết quả trả về toàn thứ không liên quan tới yêu cầu thì "noi_tu_khoa" với từ chung hơn.
- Đã "xong" được thì đừng nới thêm."""


def b5_quyet(tim, moc, ten_mau, so_dong, vong):
    o_dau = f'trong/gần "{moc["name"]}"' if moc else "quanh vị trí người dùng"
    mau = "\n".join(f"- {t}" for t in ten_mau) or "(không có dòng nào)"
    prompt = (
        f'Người dùng cần tìm: "{tim}"\n'
        f"Đã tìm {o_dau}.\n"
        f"Số kết quả: {so_dong}. Vòng thứ {vong}/{MAX_VONG}.\n"
        f"Một vài tên trả về:\n{mau}\n\nTrả JSON."
    )
    out = _hoi_llm(SYS_QUYET, prompt, 5)
    hd = out.get("hanh_dong")
    if hd not in ("xong", "noi_tu_khoa", "mo_rong", "bo_moc"):
        hd = "xong"
    return hd, str(out.get("tim") or "").strip(), str(out.get("ly_do") or "")


# ── Vòng điều phối ───────────────────────────────────────────────────────────

def search(question, lon, lat, limit=ts.DEFAULT_LIMIT, resolved_admin=None):
    try:
        return _search_llm(question, lon, lat, limit, resolved_admin)
    except LLMKhongDung as e:
        # Không để câu hỏi chết vì LLM: rơi về đường tất định, kém tinh nhưng chạy.
        logger.warning("Agent nhiều bước hỏng (%s) — dùng đường tất định", e)
        kq = ts.search(question, lon, lat, limit)
        kq["che_do"] = "tat_dinh"
        return kq
    except Exception as e:
        logger.warning("Agent nhiều bước lỗi %s: %s — dùng đường tất định",
                       type(e).__name__, e)
        kq = ts.search(question, lon, lat, limit)
        kq["che_do"] = "tat_dinh"
        return kq


def _search_llm(question, lon, lat, limit, resolved_admin):
    tim, dia_danh, y_dinh = b1_tach_y_dinh(question)
    logger.info("B1 cần tìm %r | địa danh %r | phạm vi %r", tim, dia_danh, y_dinh)

    moc, hoi_lai = None, None
    if resolved_admin:
        # Người dùng đã chọn từ lượt hỏi lại trước — không hỏi nữa.
        moc, _ = b2_phan_giai_moc(resolved_admin, lon, lat,
                                  tu_dong=True, chinh_xac=resolved_admin)
    elif dia_danh:
        moc, hoi_lai = b2_phan_giai_moc(dia_danh, lon, lat, tu_dong=False)
        if hoi_lai:
            logger.info("B2 nhập nhằng, hỏi lại: %s", hoi_lai)
            return {"results": [], "anchor": None, "keywords": tim,
                    "hoi_lai": hoi_lai,
                    "candidates": [c["name"] for c in ts.anchor_candidates(dia_danh, lon, lat)],
                    "che_do": "nhieu_buoc"}

    trong_vung, ban_kinh = b3_pham_vi(moc, y_dinh)
    logger.info("B3 phạm vi: %s", "trong ranh giới mốc" if trong_vung
                else f"bán kính {ban_kinh:.0f}m")

    rows, buoc_da_lam = [], []
    for vong in range(1, MAX_VONG + 1):
        rows = ts.tim_theo_pham_vi(tim, moc, lon, lat, limit,
                                   trong_vung=trong_vung, ban_kinh=ban_kinh)
        logger.info("B4 vòng %d: từ khoá %r -> %d kết quả", vong, tim, len(rows))
        buoc_da_lam.append({"vong": vong, "tim": tim, "so_dong": len(rows)})

        if vong == MAX_VONG:
            break
        if len(rows) >= limit:
            # Đủ dòng để LẤP ĐẦY giới hạn truy vấn: chính CSDL nói là không
            # thiếu, không cần hỏi LLM có nên tìm tiếp không. Đây là sự thật rút
            # từ truy vấn chứ không phải ngưỡng tôi tự đặt.
            logger.info("B5 bỏ qua: đã đầy %d dòng", limit)
            buoc_da_lam[-1]["quyet"] = "xong"
            buoc_da_lam[-1]["ly_do"] = "đủ dòng lấp đầy giới hạn truy vấn"
            break
        try:
            hd, tim_moi, ly_do = b5_quyet(
                tim, moc, [r["name"] for r in rows[:MAU_TEN]], len(rows), vong)
        except LLMKhongDung as e:
            # Đã có kết quả trong tay rồi thì đừng vứt đi để chạy lại từ đầu:
            # lần chạy lại tốn thêm 25 giây timeout nữa mà ra cùng thứ.
            logger.warning("B5 hỏng ở vòng %d (%s) — dừng với %d kết quả đang có",
                           vong, e, len(rows))
            buoc_da_lam[-1]["quyet"] = "dung_vi_llm_hong"
            break
        buoc_da_lam[-1]["quyet"] = hd
        buoc_da_lam[-1]["ly_do"] = ly_do
        if hd == "xong":
            break
        if hd == "noi_tu_khoa" and tim_moi and tim_moi != tim:
            tim = tim_moi
        elif hd == "mo_rong":
            if trong_vung:
                # Đã tìm cả vùng rồi thì nới nữa cũng vô nghĩa — đổi sang bán kính
                # quanh mốc để với sang tỉnh bên cạnh.
                trong_vung, ban_kinh = False, min(ts.ban_kinh_quanh_diem(moc) * 2,
                                                  BAN_KINH_TOI_DA)
            else:
                ban_kinh = min((ban_kinh or 3000) * 3, BAN_KINH_TOI_DA)
        elif hd == "bo_moc":
            moc, trong_vung = None, False
            ban_kinh = ts.ban_kinh_quanh_diem(None)
        else:
            break

    return {
        "results": rows,
        "anchor": ({"kind": moc["kind"], "name": moc["name"],
                    "lon": moc["lon"], "lat": moc["lat"]} if moc else None),
        "keywords": tim,
        "che_do": "nhieu_buoc",
        "cac_buoc": buoc_da_lam,
    }
