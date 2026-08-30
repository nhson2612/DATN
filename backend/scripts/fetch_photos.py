"""Lấy ảnh địa điểm từ Wikimedia Commons.

CSDL Overture không có ảnh, mà trang du lịch không ảnh thì vô hồn. Wikimedia là
nguồn mở, miễn phí, hợp pháp — đổi lại chỉ phủ được địa điểm nổi tiếng (chùa,
bãi biển, bảo tàng), quán ăn nhỏ sẽ không có. Địa điểm không có ảnh thì frontend
dùng ảnh mặc định theo nhóm.

KHÔNG chạy cho cả 805k POI: chỉ lấy cho nhóm tham quan và thắng cảnh, là chỗ
người dùng thực sự muốn nhìn ảnh trước khi quyết định đi.

Giấy phép Wikimedia bắt buộc ghi nguồn nên `attribution` luôn được lưu kèm.

Chạy:  cd backend && ./venv/bin/python scripts/fetch_photos.py [số lượng]
"""

import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg

from app.core.config import settings

API = "https://vi.wikipedia.org/w/api.php"
NGHI_GIAY = 2.5          # Wikipedia chặn tạm nếu gọi dồn; chậm mà chắc
NHOM_UU_TIEN = ("cultural_and_historic", "geographic_entities")


def _goi_api(params):
    """Gọi qua curl: urllib bị chặn trong môi trường này (Connection refused)."""
    url = API + "?" + urllib.parse.urlencode(params)
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", "20", "-H",
             "User-Agent: DATN-Tourism/1.0 (sinh vien; khoa luan tot nghiep)", url],
            capture_output=True, timeout=25).stdout
        if out[:1] != b"{":
            return None
        import json
        return json.loads(out)
    except Exception:
        return None


def _norm(t: str) -> str:
    import unicodedata
    t = str(t).lower().replace("đ", "d")
    t = unicodedata.normalize("NFD", t)
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def _dung_dia_diem(ten: str, tieu_de: str) -> bool:
    """Trang Wikipedia tìm được có đúng là địa điểm này không?

    Tìm kiếm Wikipedia LUÔN trả về kết quả gần nhất dù chẳng liên quan gì: tra
    "Hm" ra ảnh Premier League, "QD" ra ảnh điện thoại Nokia. Không kiểm thì
    trang du lịch đầy ảnh sai — mà ảnh sai còn tệ hơn không có ảnh.

    Quy tắc: quá nửa số từ trong tên địa điểm phải xuất hiện ở tiêu đề trang.
    """
    tu_ten = {t for t in _norm(ten).split() if len(t) >= 2}
    if len(tu_ten) < 2:
        return False          # tên một từ quá dễ khớp bừa
    tu_tieu_de = set(_norm(tieu_de).split())
    return len(tu_ten & tu_tieu_de) * 2 >= len(tu_ten)


def tim_anh(ten: str):
    """Tên địa điểm -> (url ảnh, nguồn), hoặc None nếu không chắc đúng."""
    d = _goi_api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": ten, "gsrlimit": 3,
        "prop": "pageimages", "piprop": "original", "pilicense": "any",
    })
    if not d:
        return None
    for page in (d.get("query", {}).get("pages") or {}).values():
        src = (page.get("original") or {}).get("source")
        tieu_de = page.get("title", "")
        if src and _dung_dia_diem(ten, tieu_de):
            return src, f"Wikipedia tiếng Việt — {tieu_de}"
    return None


def main():
    gioi_han = int(sys.argv[1]) if len(sys.argv) > 1 else 300

    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.id, t.name
                FROM poi t
                LEFT JOIN place_photos ph
                       ON ph.place_type = 'poi' AND ph.place_id = t.id
                WHERE ph.id IS NULL
                  AND t.tags->>'category_root' = ANY(%s)
                  AND t.name !~ '^(POI|Accommodation|Road) [0-9]+$'
                  AND t.name ~ '^[A-Za-zÀ-ỹ]'
                  -- Tên quá ngắn ("Hm", "Lá", "QD") thì tìm kiếm Wikipedia trả
                  -- về bất kỳ thứ gì: từng lấy ảnh Premier League cho "Hm" và
                  -- ảnh điện thoại Nokia cho "QD".
                  AND length(t.name) >= 10
                  -- landmark_and_historical_building là thùng chứa của Overture,
                  -- gộp cả căn hộ cho thuê; ưu tiên loại cụ thể.
                  AND t.amenity <> 'landmark_and_historical_building'
                ORDER BY length(t.name) DESC
                LIMIT %s
                """,
                (list(NHOM_UU_TIEN), gioi_han),
            )
            ds = cur.fetchall()
            print(f"Thử lấy ảnh cho {len(ds)} địa điểm...", flush=True)

            co, khong = 0, 0
            for i, (pid, ten) in enumerate(ds, 1):
                kq = tim_anh(ten)
                if kq:
                    url, nguon = kq
                    cur.execute(
                        """
                        INSERT INTO place_photos (place_type, place_id, url, attribution)
                        VALUES ('poi', %s, %s, %s)
                        ON CONFLICT (place_type, place_id) DO NOTHING
                        """,
                        (pid, url, nguon),
                    )
                    co += 1
                else:
                    khong += 1
                if i % 10 == 0:
                    conn.commit()
                    print(f"  {i}/{len(ds)} — có ảnh {co}, không {khong}", flush=True)
                time.sleep(NGHI_GIAY)
            conn.commit()
            print(f"Xong: {co} địa điểm có ảnh / {len(ds)} đã thử.")


if __name__ == "__main__":
    main()
