"""Sắp lại thứ tự các điểm trong MỘT NGÀY sao cho đi ít đường nhất.

Bài toán: người dùng thêm địa điểm theo thứ tự nghĩ ra, không theo thứ tự đi.
Một ngày 6 điểm thêm lộn xộn có thể phải chạy vòng vèo gấp đôi quãng đường cần
thiết. Đây là bài toán người bán hàng rong (TSP) mở — không quay về điểm đầu.

Vì sao đo bằng đường chim bay chứ không bằng pgRouting: một lượt pgr_dijkstra
mất 2,7 giây (đo 2026-08-30 trên gis_vietnam). Xếp thứ tự cần ma trận n×n, tức
15 lượt cho 6 điểm — 40 giây cho một cú bấm nút. Với các điểm tham quan trong
cùng thành phố, thứ tự tối ưu theo đường chim bay gần như luôn trùng thứ tự tối
ưu theo đường bộ, vì mạng đường đô thị khá đều. Đường bộ thật vẫn được vẽ sau,
cho thứ tự đã chốt: n-1 lượt thay vì n².

Thuật toán: láng giềng gần nhất để có lời giải ban đầu, rồi 2-opt để gỡ các đoạn
bắt chéo. Với n nhỏ (một ngày hiếm khi quá 10 điểm) cách này cho kết quả tối ưu
hoặc sát tối ưu, và chạy dưới một mili giây.
"""

import math

from app.core.logging import get_logger

logger = get_logger(__name__)

BAN_KINH_TRAI_DAT_M = 6_371_000
MAX_2OPT_VONG = 50      # chống lặp vô hạn nếu có điểm trùng toạ độ


def khoang_cach_m(a, b):
    """Haversine. Đủ chính xác ở cỡ một thành phố và không cần chạm CSDL."""
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp = p2 - p1
    dl = math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * BAN_KINH_TRAI_DAT_M * math.asin(math.sqrt(h))


def tong_quang_duong(diem, is_closed=False):
    if len(diem) < 2:
        return 0.0
    d = sum(khoang_cach_m(diem[i], diem[i + 1]) for i in range(len(diem) - 1))
    if is_closed:
        d += khoang_cach_m(diem[-1], diem[0])
    return d


def _lang_gieng_gan_nhat(diem, bat_dau=0):
    con_lai = set(range(len(diem)))
    con_lai.discard(bat_dau)
    thu_tu = [bat_dau]
    while con_lai:
        cuoi = thu_tu[-1]
        ke = min(con_lai, key=lambda j: khoang_cach_m(diem[cuoi], diem[j]))
        thu_tu.append(ke)
        con_lai.discard(ke)
    return thu_tu


def _hai_opt(thu_tu, diem, is_closed=False):
    """Đảo ngược từng đoạn con cho tới khi không rút ngắn được nữa."""
    def dai(tt):
        return tong_quang_duong([diem[idx] for idx in tt], is_closed=is_closed)

    tot = dai(thu_tu)
    for _ in range(MAX_2OPT_VONG):
        cai_thien = False
        for i in range(len(thu_tu) - 1):
            for j in range(i + 2, len(thu_tu)):
                thu = thu_tu[:i + 1] + thu_tu[i + 1:j + 1][::-1] + thu_tu[j + 1:]
                d = dai(thu)
                if d < tot - 1e-6:
                    thu_tu, tot, cai_thien = thu, d, True
        if not cai_thien:
            break
    return thu_tu, tot


def toi_uu_mot_ngay(stops):
    """stops: [{lon, lat, ...}] của MỘT ngày -> (danh sách đã sắp, trước_m, sau_m).

    Giữ nguyên điểm đầu: đó thường là chỗ ở hoặc điểm người dùng cố ý xuất phát.
    Nếu điểm đầu tiên có type='accommodation', ta sẽ chạy tối ưu vòng khép kín (closed-loop TSP),
    nghĩa là chặng cuối cùng sẽ từ điểm cuối quay về điểm đầu tiên (khách sạn).
    Bỏ qua nếu dưới 3 điểm — 2 điểm thì đảo thứ tự không đổi quãng đường.
    """
    hop_le = [s for s in stops if s.get("lon") is not None and s.get("lat") is not None]
    if len(hop_le) < 3:
        return stops, 0.0, 0.0

    diem = [(float(s["lon"]), float(s["lat"])) for s in hop_le]
    
    # Kiểm tra xem điểm xuất phát đầu tiên có phải là khách sạn không
    is_closed = hop_le[0].get("type") == "accommodation"
    
    truoc = tong_quang_duong(diem, is_closed=is_closed)

    thu_tu = _lang_gieng_gan_nhat(diem, bat_dau=0)
    thu_tu, sau = _hai_opt(thu_tu, diem, is_closed=is_closed)

    da_sap = [hop_le[i] for i in thu_tu]
    # Điểm thiếu toạ độ không xếp được thì để cuối, không được làm mất chúng.
    thieu = [s for s in stops if s.get("lon") is None or s.get("lat") is None]
    logger.info("Tối ưu %d điểm (closed=%s): %.0fm -> %.0fm (giảm %.0f%%)",
                len(diem), is_closed, truoc, sau,
                (truoc - sau) / truoc * 100 if truoc else 0)
    return da_sap + thieu, truoc, sau


def toi_uu_lich_trinh(stops, day=None):
    """Tối ưu một ngày (day=N) hoặc mọi ngày (day=None).

    Trả (stops mới GIỮ NGUYÊN thứ tự các ngày khác, thống kê từng ngày).
    """
    theo_ngay = {}
    for s in stops:
        theo_ngay.setdefault(s.get("day"), []).append(s)

    thong_ke, ket_qua = [], []
    for ngay in sorted(theo_ngay, key=lambda d: (d is None, d)):
        ds = theo_ngay[ngay]
        # Ngày 0 là kho "chưa xếp ngày" — không có thứ tự đi nên không tối ưu.
        if (day is None and ngay) or (day is not None and ngay == day):
            ds, truoc, sau = toi_uu_mot_ngay(ds)
            if truoc:
                thong_ke.append({"day": ngay, "truoc_m": round(truoc),
                                 "sau_m": round(sau)})
        ket_qua.extend(ds)
    return ket_qua, thong_ke
