"""Tạo tour mẫu từ dữ liệu địa điểm THẬT trong CSDL.

Tour là dữ liệu do công ty du lịch soạn, hệ thống không tự sinh được — nhưng để
demo và để kiểm thử thì cần vài tour có sẵn. Script này lấy địa điểm thật ở mỗi
tỉnh (chùa, bãi biển, bảo tàng...) rồi ghép thành lịch trình, nên mọi `place_id`
trong tour đều trỏ tới địa điểm tồn tại và vẽ được lên bản đồ.

Giá và ngày khởi hành là số do script đặt — đây là dữ liệu nghiệp vụ, thật sự
phải do admin nhập.

Chạy:  cd backend && ./venv/bin/python scripts/seed_tours.py
"""

import sys
import unicodedata
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute_query
from app.repositories import tour_repo

# (tên tỉnh trong CSDL, số ngày, giá/khách, tiêu đề từng ngày)
MAU = [
    ("Đà Nẵng", 3, 3_490_000, ["Biển Mỹ Khê & phố cổ", "Bà Nà và Cầu Vàng", "Ngũ Hành Sơn - mua sắm"]),
    ("Hà Nội", 2, 2_190_000, ["Phố cổ và Hồ Gươm", "Văn Miếu - Bảo tàng"]),
    ("Lâm Đồng", 4, 4_290_000, ["Đà Lạt trung tâm", "Thác và hồ", "Vườn hoa - chùa", "Chợ đêm và về"]),
    ("Khánh Hòa", 3, 3_890_000, ["Biển Nha Trang", "Đảo và lặn ngắm san hô", "Tháp Bà - chợ Đầm"]),
    ("Thành phố Hồ Chí Minh", 2, 1_990_000, ["Trung tâm Sài Gòn", "Chợ Bến Thành - ẩm thực"]),
]

BAO_GOM = "Xe đưa đón, khách sạn 3 sao, ăn theo chương trình, vé tham quan, hướng dẫn viên."
KHONG_BAO_GOM = "Vé máy bay, chi phí cá nhân, đồ uống, tip cho hướng dẫn viên."


def slugify(t: str) -> str:
    t = str(t).lower().replace("đ", "d")
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    import re
    t = re.sub(r"^(thanh pho|tinh)\s+", "", t)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def diem_theo_tinh(province_id: int, so_luong: int):
    """Lấy địa điểm đáng tham quan thật ở tỉnh đó."""
    return execute_query(
        """
        SELECT t.id, t.name
        FROM poi t
        WHERE t.province_id = %s
          AND t.tags->>'category_root' IN ('cultural_and_historic','geographic_entities')
          AND t.amenity <> 'landmark_and_historical_building'
          AND t.name ~ '^[A-Za-zÀ-ỹ]'
          AND length(t.name) >= 8
        ORDER BY (t.tags->>'website' IS NULL), length(t.name)
        LIMIT %s
        """,
        (province_id, so_luong),
    ) or []


def main():
    hom_nay = date.today()
    tao = 0

    for ten_tinh, so_ngay, gia, tieu_de_ngay in MAU:
        # CSDL lưu "Thành phố Đà Nẵng" còn ở đây gõ tắt "Đà Nẵng"; và có bản ghi
        # trùng tên (ranh giới bị tách) nên lấy cái nhiều địa điểm nhất.
        tinh = execute_query(
            """
            SELECT id, name FROM province_stats
            WHERE name = %s
               OR regexp_replace(name, '^(Thành phố|Tỉnh)\s+', '') = %s
            ORDER BY so_dia_diem DESC LIMIT 1
            """,
            (ten_tinh, ten_tinh))
        if not tinh:
            print(f"  Bỏ qua {ten_tinh}: không có trong province_stats")
            continue
        tinh = tinh[0]

        diem = diem_theo_tinh(tinh["id"], so_ngay * 3)
        if len(diem) < so_ngay:
            print(f"  Bỏ qua {ten_tinh}: chỉ có {len(diem)} địa điểm")
            continue

        lich = []
        for i, tieu_de in enumerate(tieu_de_ngay):
            cua_ngay = diem[i * 3:(i + 1) * 3]
            lich.append({
                "day": i + 1,
                "title": tieu_de,
                "description": "Tham quan: " + ", ".join(d["name"] for d in cua_ngay),
                "place_ids": [d["id"] for d in cua_ngay],
            })

        ten_ngan = ten_tinh
        tour_id = tour_repo.create_tour({
            "slug": f"{slugify(ten_tinh)}-{so_ngay}n{so_ngay - 1}d",
            "name": f"Khám phá {ten_ngan} {so_ngay} ngày {so_ngay - 1} đêm",
            "summary": f"Trọn gói {so_ngay} ngày tại {ten_ngan} — xe, khách sạn, "
                       f"vé tham quan và hướng dẫn viên.",
            "description": f"Hành trình {so_ngay} ngày khám phá {ten_ngan} với "
                           f"{len(diem)} điểm đến tiêu biểu. Khởi hành hằng tuần.",
            "province_id": tinh["id"],
            "duration_days": so_ngay,
            "price_from": gia,
            "highlights": [d["name"] for d in diem[:4]],
            "itinerary": lich,
            "included": BAO_GOM,
            "excluded": KHONG_BAO_GOM,
        })

        # 6 đợt khởi hành, mỗi tuần một chuyến; cuối tuần đắt hơn 15%.
        for tuan in range(6):
            ngay = hom_nay + timedelta(days=7 * tuan + 5)
            gia_dot = int(gia * 1.15) if ngay.weekday() >= 5 else gia
            tour_repo.add_departure(tour_id, ngay, gia_dot, seats=20)

        tao += 1
        print(f"  {ten_ngan}: {so_ngay} ngày, {len(diem)} địa điểm, 6 đợt khởi hành")

    print(f"Xong: {tao} tour.")


if __name__ == "__main__":
    main()
