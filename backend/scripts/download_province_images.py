"""Tải và lưu trữ ảnh danh lam thắng cảnh cho 63 tỉnh thành Việt Nam về máy cục bộ.
Đảm bảo 100% không còn link bên ngoài, ảnh chuẩn 900x600 (3:2) cho màn hình chuyến đi.
"""

import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

from app.core.config import settings

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = REPO_ROOT / "web" / "public" / "assets" / "images" / "provinces"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROVINCE_LANDMARKS = {
    "ha-noi": "Hồ Hoàn Kiếm Hà Nội",
    "ho-chi-minh": "Landmark 81 Hồ Chí Minh",
    "da-nang": "Cầu Vàng Bà Nà Hills Đà Nẵng",
    "quang-ninh": "Vịnh Hạ Long Quảng Ninh",
    "khanh-hoa": "Biển Nha Trang Khánh Hòa",
    "lam-dong": "Hồ Xuân Hương Đà Lạt",
    "thua-thien-hue": "Đại Nội Huế",
    "hue": "Đại Nội Huế",
    "kien-giang": "Bãi Sao Phú Quốc",
    "lao-cai": "Fansipan Sapa Lào Cai",
    "ninh-binh": "Tràng An Ninh Bình",
    "hai-phong": "Đảo Cát Bà Hải Phòng",
    "ba-ria-vung-tau": "Bãi Sau Vũng Tàu",
    "quang-binh": "Động Phong Nha Quảng Bình",
    "quang-nam": "Chùa Cầu Phố Cổ Hội An",
    "can-tho": "Chợ Nổi Cái Răng Cần Thơ",
    "binh-thuan": "Đồi Cát Bay Mũi Né",
    "binh-dinh": "Eo Gió Kỳ Co Quy Nhơn",
    "phu-yen": "Gành Đá Đĩa Phú Yên",
    "ha-giang": "Đèo Mã Pí Lèng Hà Giang",
    "cao-bang": "Thác Bản Giốc Cao Bằng",
    "yen-bai": "Ruộng Bậc Thang Mù Cang Chải",
    "an-giang": "Rừng Tràm Trà Sư An Giang",
    "tay-ninh": "Núi Bà Đen Tây Ninh",
    "dak-lak": "Thác Dray Nur Buôn Ma Thuột",
    "gia-lai": "Biển Hồ T'Nưng Pleiku",
    "kon-tum": "Nhà Thờ Gỗ Kon Tum",
    "dak-nong": "Hồ Tà Đùng Đắk Nông",
    "dong-nai": "Nam Cát Tiên Đồng Nai",
    "binh-duong": "Chùa Châu Thới Bình Dương",
    "binh-phuoc": "Trảng Cỏ Bù Lạch Bình Phước",
    "long-an": "Làng Nổi Tân Lập Long An",
    "tien-giang": "Chùa Vĩnh Tràng Tiền Giang",
    "ben-tre": "Cồn Phụng Bến Tre",
    "dong-thap": "Vườn Quốc Gia Tràm Chim",
    "vinh-long": "Cù Lao An Bình Vĩnh Long",
    "tra-vinh": "Chùa Hang Trà Vinh",
    "hau-giang": "Khu Bảo Tồn Lung Ngọc Hoàng",
    "soc-trang": "Chùa Dơi Sóc Trăng",
    "bac-lieu": "Cánh Đồng Điện Gió Bạc Liêu",
    "ca-mau": "Mốc Tọa Độ Mũi Cà Mau",
    "nghe-an": "Làng Sen Quê Bác Nghệ An",
    "ha-tinh": "Khu Di Tích Ngã Ba Đồng Lộc",
    "quang-tri": "Địa Đạo Vịnh Mốc Quảng Trị",
    "quang-ngai": "Đảo Bé Lý Sơn Quảng Ngãi",
    "ninh-thuan": "Vịnh Vĩnh Hy Ninh Thuận",
    "thanh-hoa": "Pù Luông Thanh Hóa",
    "son-la": "Đồi Chè Trái Tim Mộc Châu",
    "dien-bien": "Tượng Đài Chiến Thắng Điện Biên Phủ",
    "lai-chau": "Đèo Ô Quy Hồ Lai Châu",
    "hoa-binh": "Thung Lũng Mai Châu Hòa Bình",
    "thai-nguyen": "Đồi Chè Tân Cương Thái Nguyên",
    "lang-son": "Đỉnh Mẫu Sơn Lạng Sơn",
    "bac-giang": "Chùa Vĩnh Nghiêm Bắc Giang",
    "bac-kan": "Hồ Ba Bể Bắc Kạn",
    "tuyen-quang": "Hồ Na Hang Tuyên Quang",
    "phu-tho": "Đền Hùng Phú Thọ",
    "vinh-phuc": "Cầu Mây Tam Đảo Vĩnh Phúc",
    "bac-ninh": "Chùa Dâu Bắc Ninh",
    "hai-duong": "Côn Sơn Kiếp Bạc Hải Dương",
    "hung-yen": "Phố Hiến Hưng Yên",
    "ha-nam": "Chùa Tam Chúc Hà Nam",
    "nam-dinh": "Nhà Thờ Đổ Hải Hậu Nam Định",
    "thai-binh": "Chùa Keo Thái Bình",
}

HEADERS_SEARCH = {
    "X-API-KEY": settings.serper_api_key,
    "Content-Type": "application/json",
}

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


def download_one_province(slug, landmark_query):
    target = OUT_DIR / f"{slug}.jpg"
    temp_raw = OUT_DIR / f"{slug}_dl.tmp"

    # Tìm kiếm ảnh đẹp qua Serper Images
    payload = {"q": f"thắng cảnh {landmark_query}", "gl": "vn", "hl": "vi", "num": 5}
    try:
        r = requests.post(settings.serper_images_url, headers=HEADERS_SEARCH, json=payload, timeout=10)
        if r.status_code == 200:
            for item in r.json().get("images", []):
                img_url = item.get("imageUrl")
                if not img_url:
                    continue
                try:
                    img_resp = requests.get(img_url, headers=BROWSER_HEADERS, timeout=6)
                    if img_resp.status_code == 200 and len(img_resp.content) > 10000:
                        with open(temp_raw, "wb") as f:
                            f.write(img_resp.content)

                        # Chuẩn hóa về tỷ lệ 900x600 chất lượng cao
                        cmd = [
                            "/usr/bin/convert",
                            str(temp_raw),
                            "-resize", "900x600^",
                            "-gravity", "center",
                            "-extent", "900x600",
                            "-quality", "84",
                            str(target),
                        ]
                        subprocess.run(cmd, capture_output=True)
                        if temp_raw.exists():
                            temp_raw.unlink()

                        if target.exists() and target.stat().st_size > 5000:
                            print(f"[✓ Tải thành công] {slug} ({landmark_query}): {target.stat().st_size // 1024} KB")
                            return True
                except Exception:
                    continue
    except Exception as e:
        print(f"[✗ Lỗi API] {slug}: {e}")

    if temp_raw.exists():
        temp_raw.unlink()

    return target.exists()


def main():
    print(f"Bắt đầu tải và chuẩn hóa {len(PROVINCE_LANDMARKS)} ảnh danh lam thắng cảnh...")
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [
            executor.submit(download_one_province, slug, query)
            for slug, query in PROVINCE_LANDMARKS.items()
        ]
        results = [f.result() for f in futures]

    print(f"\n Hoàn tất tải {sum(results)}/{len(PROVINCE_LANDMARKS)} ảnh tỉnh thành cục bộ vào {OUT_DIR}.")


if __name__ == "__main__":
    main()
