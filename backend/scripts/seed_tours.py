"""Seed bộ tour demo đầy đủ, lặp lại an toàn và không tạo tham chiếu mồ côi.

Điểm tham quan dùng ID ``serper:`` tự chứa tên, địa chỉ và toạ độ. Đây là
định dạng ứng dụng dùng sau khi bảng ``poi`` được loại bỏ; API giải mã tại chỗ,
không gọi mạng và không phụ thuộc một bản ghi địa điểm có thể bị xoá.

Chạy: cd backend && ./venv/bin/python scripts/seed_tours.py
"""

from __future__ import annotations

import base64
import json
import os
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute_query, pool, transaction
from app.core.security import hash_password
from app.shared.places.serper import decode_place_id


MUI_GIO = ZoneInfo("Asia/Ho_Chi_Minh")
EMAIL_OPERATOR = "operator@gmail.com"

BAO_GOM = [
    "Xe du lịch máy lạnh theo chương trình",
    "Khách sạn 3 sao, hai khách một phòng",
    "Các bữa ăn ghi trong lịch trình",
    "Vé tham quan một lượt",
    "Hướng dẫn viên tiếng Việt",
    "Bảo hiểm du lịch",
]
KHONG_BAO_GOM = [
    "Vé máy bay hoặc tàu đến điểm đón",
    "Chi phí cá nhân và đồ uống ngoài chương trình",
    "Phụ thu phòng đơn",
    "Tiền tip cho hướng dẫn viên và tài xế",
]
CHINH_SACH_HUY = [
    {"days_before": 15, "refund_percent": 90},
    {"days_before": 8, "refund_percent": 70},
    {"days_before": 4, "refund_percent": 50},
    {"days_before": 1, "refund_percent": 0},
    {"days_before": 0, "refund_percent": 0},
]


def dia_diem(key, name, address, lat, lon, category, image):
    return {
        "key": key,
        "name": name,
        "address": address,
        "lat": lat,
        "lon": lon,
        "category": category,
        "image": image,
    }


# URL ảnh cụ thể từ Wikimedia, không dùng ảnh placeholder/generic của dự án.
TOURS = [
    {
        "slug": "da-nang-3n2d",
        "name": "Khám phá Đà Nẵng – Bà Nà Hills 3N2Đ",
        "province": "Đà Nẵng",
        "duration_days": 3,
        "transportation": ["Máy bay", "Xe du lịch", "Cáp treo"],
        "departure_location": "Sân bay quốc tế Đà Nẵng",
        "tags": ["Biển", "Di sản", "Gia đình", "3N2Đ"],
        "price": 5_500_000,
        "sale_price": 4_990_000,
        "summary": "Khám phá biển Mỹ Khê, Bà Nà Hills, Cầu Vàng và phố cổ Hội An trong 3 ngày 2 đêm.",
        "description": "Hành trình trọn gói kết hợp nghỉ dưỡng biển, biểu tượng hiện đại của Đà Nẵng và di sản Hội An.",
        "places": [
            dia_diem("my-khe", "Bãi biển Mỹ Khê", "Võ Nguyên Giáp, Sơn Trà, Đà Nẵng", 16.0610, 108.2462, "Bãi biển", "https://upload.wikimedia.org/wikipedia/commons/c/c0/My_Khe_Beach%2C_Da_Nang%2C_Vietnam.jpg"),
            dia_diem("cau-rong", "Cầu Rồng", "Nguyễn Văn Linh, Hải Châu, Đà Nẵng", 16.0611, 108.2277, "Điểm tham quan", "https://upload.wikimedia.org/wikipedia/commons/0/07/Da_Nang_-_Dragon_Bridge.jpg"),
            dia_diem("ba-na", "Sun World Bà Nà Hills", "Hòa Ninh, Hòa Vang, Đà Nẵng", 15.9950, 107.9960, "Khu du lịch", "https://upload.wikimedia.org/wikipedia/commons/2/2e/Ba_Na_Hills_French_Village.jpg"),
            dia_diem("cau-vang", "Cầu Vàng", "Bà Nà Hills, Hòa Vang, Đà Nẵng", 15.9952, 107.9964, "Điểm tham quan", "https://upload.wikimedia.org/wikipedia/commons/3/34/Da_Nang_Golden_Bridge%2C_Sun_World_Ba_Na_Hills.jpg"),
            dia_diem("ngu-hanh-son", "Danh thắng Ngũ Hành Sơn", "81 Huyền Trân Công Chúa, Ngũ Hành Sơn, Đà Nẵng", 16.0035, 108.2630, "Danh thắng", "https://upload.wikimedia.org/wikipedia/commons/1/1d/Da_Nang_Marble_Mountains_2020_IMG_4008.jpg"),
            dia_diem("hoi-an", "Phố cổ Hội An", "Minh An, Hội An, Quảng Nam", 15.8801, 108.3380, "Di sản văn hóa", "https://upload.wikimedia.org/wikipedia/commons/f/f2/H%E1%BB%99i_An%2C_Ancient_Town%2C_2020-01_CN-01.jpg"),
        ],
        "days": [
            ("Đón khách – Biển Mỹ Khê – Cầu Rồng", "Đón khách, nhận phòng, tắm biển và ngắm thành phố lên đèn.", ["my-khe", "cau-rong"]),
            ("Bà Nà Hills – Cầu Vàng", "Đi cáp treo, tham quan Cầu Vàng và vui chơi tại Bà Nà Hills.", ["ba-na", "cau-vang"]),
            ("Ngũ Hành Sơn – Hội An", "Khám phá danh thắng Ngũ Hành Sơn, dạo phố cổ trước khi tiễn khách.", ["ngu-hanh-son", "hoi-an"]),
        ],
    },
    {
        "slug": "ha-noi-2n1d",
        "name": "Tinh hoa Hà Nội 2N1Đ",
        "province": "Hà Nội",
        "duration_days": 2,
        "transportation": ["Xe du lịch", "Đi bộ"],
        "departure_location": "Nhà hát Lớn Hà Nội, 01 Tràng Tiền, Hoàn Kiếm",
        "tags": ["Văn hóa", "Lịch sử", "Ẩm thực", "2N1Đ"],
        "price": 2_590_000,
        "sale_price": 2_190_000,
        "summary": "Hành trình ngắn ngày qua Hồ Gươm, phố cổ, Văn Miếu và Lăng Chủ tịch Hồ Chí Minh.",
        "description": "Tour trung tâm Hà Nội dành cho khách muốn trải nghiệm lịch sử, kiến trúc và ẩm thực thủ đô.",
        "places": [
            dia_diem("ho-guom", "Hồ Hoàn Kiếm", "Hoàn Kiếm, Hà Nội", 21.0288, 105.8522, "Danh thắng", "https://upload.wikimedia.org/wikipedia/commons/7/70/Hanoi_Vietnam_Shrine-at-Ho%C3%A0n-Ki%E1%BA%BFm-Lake-01.jpg"),
            dia_diem("pho-co", "Phố cổ Hà Nội", "Hoàn Kiếm, Hà Nội", 21.0350, 105.8500, "Khu phố lịch sử", "https://upload.wikimedia.org/wikipedia/commons/c/c9/Hanoi%2C_Vietnam_%2812035240825%29.jpg"),
            dia_diem("van-mieu", "Văn Miếu – Quốc Tử Giám", "58 Quốc Tử Giám, Đống Đa, Hà Nội", 21.0277, 105.8355, "Di tích lịch sử", "https://upload.wikimedia.org/wikipedia/commons/2/23/Oct2025._Visit_to_the_Ho_Chi_Minh_Museum%2C_Hanoi%2C_Vietnam_01.jpg"),
            dia_diem("lang-bac", "Lăng Chủ tịch Hồ Chí Minh", "2 Hùng Vương, Ba Đình, Hà Nội", 21.0368, 105.8346, "Di tích lịch sử", "https://upload.wikimedia.org/wikipedia/commons/d/dc/Oct2025._Visit_to_the_Ho_Chi_Minh_Museum%2C_Hanoi%2C_Vietnam_02.jpg"),
        ],
        "days": [
            ("Hồ Gươm – Phố cổ", "Đi bộ quanh hồ, tham quan đền Ngọc Sơn và khám phá ẩm thực phố cổ.", ["ho-guom", "pho-co"]),
            ("Văn Miếu – Quảng trường Ba Đình", "Tìm hiểu lịch sử giáo dục và tham quan khu trung tâm chính trị Ba Đình.", ["van-mieu", "lang-bac"]),
        ],
    },
    {
        "slug": "lam-dong-4n3d",
        "name": "Đà Lạt mộng mơ 4N3Đ",
        "province": "Lâm Đồng",
        "duration_days": 4,
        "transportation": ["Máy bay", "Xe du lịch"],
        "departure_location": "Sân bay Liên Khương, Đức Trọng, Lâm Đồng",
        "tags": ["Cao nguyên", "Thiên nhiên", "Nghỉ dưỡng", "4N3Đ"],
        "price": 4_790_000,
        "sale_price": 4_290_000,
        "summary": "Bốn ngày tận hưởng khí hậu cao nguyên, hồ Xuân Hương, Langbiang và thác Datanla.",
        "description": "Lịch trình cân bằng giữa cảnh quan thiên nhiên, văn hóa bản địa và thời gian nghỉ dưỡng tại Đà Lạt.",
        "places": [
            dia_diem("xuan-huong", "Hồ Xuân Hương", "Phường 1, Đà Lạt, Lâm Đồng", 11.9416, 108.4450, "Hồ", "https://upload.wikimedia.org/wikipedia/commons/6/67/Da_Lat_train_station_02.JPG"),
            dia_diem("ga-da-lat", "Ga Đà Lạt", "1 Quang Trung, Đà Lạt, Lâm Đồng", 11.9417, 108.4545, "Kiến trúc", "https://upload.wikimedia.org/wikipedia/commons/5/5f/Tran_Le_Xuan_Villa_01.jpg"),
            dia_diem("datanla", "Thác Datanla", "Đèo Prenn, Đà Lạt, Lâm Đồng", 11.9012, 108.4482, "Thác nước", "https://upload.wikimedia.org/wikipedia/commons/2/24/Tourists_with_xe_om_in_Da_Lat.jpg"),
            dia_diem("tuyen-lam", "Hồ Tuyền Lâm", "Phường 4, Đà Lạt, Lâm Đồng", 11.9036, 108.4356, "Hồ", "https://upload.wikimedia.org/wikipedia/commons/4/42/Vietnam_National_Archives_Centre_IV_01.jpg"),
            dia_diem("langbiang", "Núi Langbiang", "Lạc Dương, Lâm Đồng", 12.0500, 108.4417, "Núi", "https://upload.wikimedia.org/wikipedia/commons/d/da/Ho_Chi_Minh_statue%2C_Vietnam_National_Archives_Centre_IV.jpg"),
            dia_diem("vuon-hoa", "Vườn hoa thành phố Đà Lạt", "Trần Quốc Toản, Đà Lạt, Lâm Đồng", 11.9465, 108.4487, "Vườn hoa", "https://upload.wikimedia.org/wikipedia/commons/8/8a/Interior%2C_Vietnam_National_Archives_Centre_IV_01.jpg"),
            dia_diem("cho-da-lat", "Chợ Đà Lạt", "Nguyễn Thị Minh Khai, Đà Lạt, Lâm Đồng", 11.9435, 108.4378, "Chợ", "https://upload.wikimedia.org/wikipedia/commons/f/ff/Interior%2C_Vietnam_National_Archives_Centre_IV_02.jpg"),
        ],
        "days": [
            ("Đà Lạt trung tâm", "Nhận phòng, dạo hồ Xuân Hương và tham quan nhà ga cổ.", ["xuan-huong", "ga-da-lat"]),
            ("Thác Datanla – Hồ Tuyền Lâm", "Trải nghiệm thiên nhiên phía nam thành phố.", ["datanla", "tuyen-lam"]),
            ("Langbiang – Vườn hoa", "Ngắm cao nguyên từ Langbiang và khám phá sắc hoa Đà Lạt.", ["langbiang", "vuon-hoa"]),
            ("Chợ Đà Lạt – Tiễn khách", "Mua đặc sản địa phương và kết thúc hành trình.", ["cho-da-lat"]),
        ],
    },
    {
        "slug": "khanh-hoa-3n2d",
        "name": "Nha Trang biển xanh 3N2Đ",
        "province": "Khánh Hòa",
        "duration_days": 3,
        "transportation": ["Máy bay", "Xe du lịch", "Tàu thủy / ca nô"],
        "departure_location": "Sân bay quốc tế Cam Ranh, Khánh Hòa",
        "tags": ["Biển đảo", "Lặn biển", "Gia đình", "3N2Đ"],
        "price": 4_390_000,
        "sale_price": 3_890_000,
        "summary": "Nghỉ dưỡng Nha Trang, khám phá Hòn Mun, Hòn Chồng và Tháp Bà Ponagar.",
        "description": "Tour biển đảo có lịch trình vừa phải, phù hợp gia đình và nhóm bạn.",
        "places": [
            dia_diem("bien-nha-trang", "Bãi biển Nha Trang", "Trần Phú, Nha Trang, Khánh Hòa", 12.2388, 109.1967, "Bãi biển", "https://upload.wikimedia.org/wikipedia/commons/9/9b/Coast_of_Nha_Trang%2C_Vietnam._June_2025.jpg"),
            dia_diem("hon-chong", "Hòn Chồng", "Vĩnh Phước, Nha Trang, Khánh Hòa", 12.2726, 109.2022, "Danh thắng", "https://upload.wikimedia.org/wikipedia/commons/c/c7/Hon_Chong_from_Co_Tien_beach.JPG"),
            dia_diem("hon-mun", "Khu bảo tồn biển Hòn Mun", "Vĩnh Nguyên, Nha Trang, Khánh Hòa", 12.1680, 109.3020, "Đảo", "https://upload.wikimedia.org/wikipedia/commons/8/8e/Hon_Chong_seen_from_the_hill.JPG"),
            dia_diem("ponagar", "Tháp Bà Ponagar", "61 Hai Tháng Tư, Nha Trang, Khánh Hòa", 12.2654, 109.1951, "Di tích lịch sử", "https://upload.wikimedia.org/wikipedia/commons/8/8d/Hoi_quan_Vinh_Nha_Trang.JPG"),
            dia_diem("cho-dam", "Chợ Đầm", "Bến Chợ, Nha Trang, Khánh Hòa", 12.2521, 109.1920, "Chợ", "https://upload.wikimedia.org/wikipedia/commons/f/f2/Enirejo_de_la_ripozejo_Champa_Club_%28Nha_Trang%29_01.jpg"),
        ],
        "days": [
            ("Biển Nha Trang – Hòn Chồng", "Nhận phòng, tắm biển và ngắm hoàng hôn tại Hòn Chồng.", ["bien-nha-trang", "hon-chong"]),
            ("Tour đảo Hòn Mun", "Đi canô, bơi và lặn ngắm san hô trong khu bảo tồn biển.", ["hon-mun"]),
            ("Tháp Bà – Chợ Đầm", "Tìm hiểu văn hóa Chăm và mua đặc sản trước khi tiễn khách.", ["ponagar", "cho-dam"]),
        ],
    },
    {
        "slug": "ho-chi-minh-2n1d",
        "name": "Sài Gòn năng động 2N1Đ",
        "province": "Hồ Chí Minh",
        "duration_days": 2,
        "transportation": ["Xe du lịch", "Đi bộ"],
        "departure_location": "Bưu điện Trung tâm Sài Gòn, Quận 1",
        "tags": ["City tour", "Lịch sử", "Ẩm thực", "2N1Đ"],
        "price": 2_390_000,
        "sale_price": 1_990_000,
        "summary": "Khám phá các biểu tượng kiến trúc, lịch sử và ẩm thực trung tâm Thành phố Hồ Chí Minh.",
        "description": "Chuyến city tour gọn nhẹ qua những điểm đến tiêu biểu nhất của Sài Gòn.",
        "places": [
            dia_diem("doc-lap", "Dinh Độc Lập", "135 Nam Kỳ Khởi Nghĩa, Quận 1, TP. Hồ Chí Minh", 10.7770, 106.6953, "Di tích lịch sử", "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/20190923_Independence_Palace-10.jpg/1280px-20190923_Independence_Palace-10.jpg"),
            dia_diem("buu-dien", "Bưu điện Trung tâm Sài Gòn", "2 Công xã Paris, Quận 1, TP. Hồ Chí Minh", 10.7799, 106.6999, "Kiến trúc", "https://upload.wikimedia.org/wikipedia/commons/7/7c/Ho_Chi_Minh_City_VIETNAM.jpg"),
            dia_diem("bao-tang-chung-tich", "Bảo tàng Chứng tích Chiến tranh", "28 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh", 10.7795, 106.6920, "Bảo tàng", "https://upload.wikimedia.org/wikipedia/commons/e/ef/%27Bui_Vein_Street%27%2C_the_backpackers_rendezvous.JPG"),
            dia_diem("cho-ben-thanh", "Chợ Bến Thành", "Lê Lợi, Quận 1, TP. Hồ Chí Minh", 10.7725, 106.6980, "Chợ", "https://upload.wikimedia.org/wikipedia/commons/b/b9/-_trung_tam_saigon-B%E1%BA%BFn_Ngh%C3%A9%2C_Qu%E1%BA%ADn_1%2C_TPHCM%2C_Vi%E1%BB%87t_Nam_-_panoramio.jpg"),
        ],
        "days": [
            ("Dinh Độc Lập – Bưu điện Thành phố", "Khám phá lịch sử và kiến trúc đặc trưng của trung tâm Sài Gòn.", ["doc-lap", "buu-dien"]),
            ("Bảo tàng – Chợ Bến Thành", "Tham quan bảo tàng, thưởng thức ẩm thực và mua quà tại chợ.", ["bao-tang-chung-tich", "cho-ben-thanh"]),
        ],
    },
]


def tao_id_serper(place: dict) -> str:
    """Tạo đúng định dạng ID mà ``serper.decode_place_id`` hỗ trợ."""
    identity = {
        "name": place["name"],
        "address": place["address"],
        "lat": place["lat"],
        "lon": place["lon"],
        "cid": f"seed-{place['key']}",
        "category": place["category"],
        "rating": 4.7,
        "review_count": 100,
    }
    token = base64.urlsafe_b64encode(
        json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"serper:{token}"


def tim_tinh(tx, ten: str) -> dict:
    rows = tx.execute(
        """
        SELECT id, name FROM province_stats
        WHERE name = %s OR regexp_replace(name, '^(Thành phố|Tỉnh)\\s+', '') = %s
        ORDER BY so_dia_diem DESC NULLS LAST, id LIMIT 1
        """,
        (ten, ten),
    )
    if not rows:
        raise RuntimeError(f"Không tìm thấy tỉnh/thành '{ten}' trong province_stats.")
    return rows[0]


def dam_bao_operator(tx) -> int:
    """Tạo hoặc tái sử dụng đúng một tài khoản/operator demo."""
    rows = tx.execute("SELECT id FROM users WHERE email = %s FOR UPDATE", (EMAIL_OPERATOR,))
    if rows:
        user_id = rows[0]["id"]
        tx.execute(
            "UPDATE users SET full_name = %s, role = 'operator' WHERE id = %s",
            ("Điều hành tour mẫu", user_id),
        )
    else:
        password = os.getenv("SEED_OPERATOR_PASSWORD", "123456")
        rows = tx.execute(
            """
            INSERT INTO users (email, hashed_password, full_name, role)
            VALUES (%s, %s, %s, 'operator') RETURNING id
            """,
            (EMAIL_OPERATOR, hash_password(password), "Điều hành tour mẫu"),
        )
        user_id = rows[0]["id"]

    rows = tx.execute(
        "SELECT id FROM operators WHERE user_id = %s ORDER BY id LIMIT 1 FOR UPDATE",
        (user_id,),
    )
    if rows:
        operator_id = rows[0]["id"]
        tx.execute(
            """
            UPDATE operators SET company_name = %s, tax_code = %s,
                commission_rate = %s, status = 'ACTIVE' WHERE id = %s
            """,
            ("Công ty Du lịch Việt", "SEED-DEMO-001", 0.10, operator_id),
        )
        return operator_id

    rows = tx.execute(
        """
        INSERT INTO operators (user_id, company_name, tax_code, commission_rate, status)
        VALUES (%s, %s, %s, %s, 'ACTIVE') RETURNING id
        """,
        (user_id, "Công ty Du lịch Việt", "SEED-DEMO-001", 0.10),
    )
    return rows[0]["id"]


def tao_lich_trinh(tour: dict) -> tuple[list[dict], list[str], list[str]]:
    places = {p["key"]: {**p, "id": tao_id_serper(p)} for p in tour["places"]}
    itinerary = []
    for index, (title, description, keys) in enumerate(tour["days"], start=1):
        selected = [places[key] for key in keys]
        itinerary.append({
            "day": index,
            "title": title,
            "description": description,
            "place_ids": [p["id"] for p in selected],
            "place_notes": {p["id"]: p["address"] for p in selected},
            "checklist": ["Mang theo giấy tờ tùy thân", "Có mặt trước giờ hẹn 15 phút"],
            "timeline": [
                {
                    "id": f"seed-{tour['slug']}-{index}-{position}",
                    "type": "place",
                    "place": {
                        "id": p["id"], "name": p["name"],
                        "dia_chi": p["address"], "lat": p["lat"], "lon": p["lon"],
                    },
                }
                for position, p in enumerate(selected, start=1)
            ],
        })
    images = [p["image"] for p in places.values()]
    highlights = [p["name"] for p in list(places.values())[:4]]
    return itinerary, images, highlights


def upsert_tour(tx, tour: dict, operator_id: int, province_id: int) -> int:
    itinerary, images, highlights = tao_lich_trinh(tour)
    rows = tx.execute(
        """
        INSERT INTO tours (
            slug, name, operator_id, summary, description, province_id,
            duration_days, price_from, cover_url, images, highlights,
            transportation, departure_location, tags,
            itinerary, included, excluded, cancellation_policy, status, active
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s::jsonb, %s::jsonb, %s::jsonb, %s, %s::jsonb,
            %s::jsonb, %s::jsonb, %s::jsonb,
            %s::jsonb, 'ACTIVE', TRUE
        )
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name, operator_id = EXCLUDED.operator_id,
            summary = EXCLUDED.summary, description = EXCLUDED.description,
            province_id = EXCLUDED.province_id, duration_days = EXCLUDED.duration_days,
            price_from = EXCLUDED.price_from, cover_url = EXCLUDED.cover_url,
            images = EXCLUDED.images, highlights = EXCLUDED.highlights,
            transportation = EXCLUDED.transportation,
            departure_location = EXCLUDED.departure_location,
            tags = EXCLUDED.tags,
            itinerary = EXCLUDED.itinerary, included = EXCLUDED.included,
            excluded = EXCLUDED.excluded,
            cancellation_policy = EXCLUDED.cancellation_policy,
            status = 'ACTIVE', active = TRUE, reject_reason = NULL
        RETURNING id
        """,
        (
            tour["slug"], tour["name"], operator_id, tour["summary"],
            tour["description"], province_id, tour["duration_days"],
            tour["sale_price"], images[0], json.dumps(images, ensure_ascii=False),
            json.dumps(highlights, ensure_ascii=False),
            json.dumps(tour["transportation"], ensure_ascii=False),
            tour["departure_location"],
            json.dumps(tour["tags"], ensure_ascii=False),
            json.dumps(itinerary, ensure_ascii=False),
            json.dumps(BAO_GOM, ensure_ascii=False),
            json.dumps(KHONG_BAO_GOM, ensure_ascii=False),
            json.dumps(CHINH_SACH_HUY, ensure_ascii=False),
        ),
    )
    tour_id = rows[0]["id"]

    for place in tour["places"]:
        place_id = tao_id_serper(place)
        details = {
            "name": place["name"], "address": place["address"],
            "category": place["category"], "lat": place["lat"], "lon": place["lon"],
        }
        tx.execute(
            """
            INSERT INTO place_photos (place_type, place_id, url, attribution, details)
            VALUES ('serper', %s, %s, 'Wikimedia Commons', %s::jsonb)
            ON CONFLICT (place_type, place_id) DO UPDATE SET
                url = EXCLUDED.url, attribution = EXCLUDED.attribution,
                details = EXCLUDED.details, fetched_at = CURRENT_TIMESTAMP
            """,
            (place_id, place["image"], json.dumps(details, ensure_ascii=False)),
        )
    return tour_id


def seed_departures(tx, tour_id: int, tour: dict, start_date: date) -> None:
    now = datetime.now(MUI_GIO)
    for week in range(6):
        depart_date = start_date + timedelta(days=7 * week)
        sale_end = datetime.combine(depart_date - timedelta(days=2), time(23, 59), MUI_GIO)
        tx.execute(
            """
            INSERT INTO tour_departures (
                tour_id, depart_date, list_price, sale_price,
                sale_starts_at, sale_ends_at, status, min_pax, seats_total, seats_left
            ) VALUES (%s, %s, %s, %s, %s, %s, 'OPEN', 4, 24, 24)
            ON CONFLICT (tour_id, depart_date) DO UPDATE SET
                list_price = EXCLUDED.list_price, sale_price = EXCLUDED.sale_price,
                sale_starts_at = EXCLUDED.sale_starts_at,
                sale_ends_at = EXCLUDED.sale_ends_at, min_pax = EXCLUDED.min_pax,
                status = CASE WHEN tour_departures.status IN ('CANCELLED', 'COMPLETED')
                    THEN tour_departures.status ELSE 'OPEN' END
            """,
            (tour_id, depart_date, tour["price"], tour["sale_price"], now, sale_end),
        )

    tx.execute(
        """
        UPDATE tour_departures SET status = 'DEPARTED'
        WHERE tour_id = %s AND depart_date < CURRENT_DATE AND status = 'OPEN'
        """,
        (tour_id,),
    )


def kiem_tra_tham_chieu() -> None:
    """Kiểm tra FK vật lý và tham chiếu địa điểm trong JSON itinerary."""
    checks = {
        "tour thiếu operator": """SELECT count(*) AS n FROM tours t LEFT JOIN operators o ON o.id=t.operator_id WHERE t.operator_id IS NOT NULL AND o.id IS NULL""",
        "tour thiếu tỉnh/thành": """SELECT count(*) AS n FROM tours t LEFT JOIN province_stats p ON p.id=t.province_id WHERE t.province_id IS NOT NULL AND p.id IS NULL""",
        "đợt khởi hành thiếu tour": """SELECT count(*) AS n FROM tour_departures d LEFT JOIN tours t ON t.id=d.tour_id WHERE t.id IS NULL""",
        "operator thiếu user": """SELECT count(*) AS n FROM operators o LEFT JOIN users u ON u.id=o.user_id WHERE u.id IS NULL""",
    }
    errors = []
    for label, sql in checks.items():
        count = execute_query(sql)[0]["n"]
        if count:
            errors.append(f"{label}: {count}")

    accommodation_ids = {row["id"] for row in (execute_query("SELECT id FROM accommodation") or [])}
    rows = execute_query("SELECT id, slug, itinerary FROM tours") or []
    for row in rows:
        itinerary = row.get("itinerary") or []
        if isinstance(itinerary, str):
            itinerary = json.loads(itinerary)
        for day in itinerary:
            for place_id in day.get("place_ids") or []:
                if isinstance(place_id, int) or str(place_id).isdigit():
                    if int(place_id) not in accommodation_ids:
                        errors.append(f"tour {row['slug']} tham chiếu accommodation #{place_id} không tồn tại")
                elif str(place_id).startswith("serper:"):
                    if decode_place_id(str(place_id)) is None:
                        errors.append(f"tour {row['slug']} có ID Serper không giải mã được")
                else:
                    errors.append(f"tour {row['slug']} có loại place_id không hỗ trợ: {place_id}")

    if errors:
        raise RuntimeError("Phát hiện tham chiếu mồ côi:\n- " + "\n- ".join(errors))


def main() -> None:
    today = date.today()
    days_until_friday = (4 - today.weekday()) % 7
    first_departure = today + timedelta(days=days_until_friday or 7)

    seeded = []
    with transaction() as tx:
        operator_id = dam_bao_operator(tx)
        for tour in TOURS:
            province = tim_tinh(tx, tour["province"])
            tour_id = upsert_tour(tx, tour, operator_id, province["id"])
            seed_departures(tx, tour_id, tour, first_departure)
            seeded.append((tour_id, tour["slug"], len(tour["places"])))

    # Chỉ báo thành công sau khi commit và toàn bộ DB vượt qua kiểm tra orphan.
    kiem_tra_tham_chieu()
    for tour_id, slug, place_count in seeded:
        print(f"  #{tour_id} {slug}: {place_count} địa điểm, 6 đợt khởi hành tương lai")
    print(f"Xong: {len(seeded)} tour; không phát hiện tham chiếu mồ côi.")


if __name__ == "__main__":
    try:
        main()
    finally:
        pool.close()
