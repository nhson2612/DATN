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
NGHI_GIAY = 1.0          # Wikipedia chặn tạm thời nếu gọi dồn dập
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


def tim_anh(ten: str):
    """Tên địa điểm -> (url ảnh, nguồn) hoặc None."""
    d = _goi_api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": ten, "gsrlimit": 1,
        "prop": "pageimages", "piprop": "original", "pilicense": "any",
    })
    if not d:
        return None
    for page in (d.get("query", {}).get("pages") or {}).values():
        src = (page.get("original") or {}).get("source")
        if src:
            return src, f"Wikipedia tiếng Việt — {page.get('title', ten)}"
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
                ORDER BY length(t.name)
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
                if i % 25 == 0:
                    conn.commit()
                    print(f"  {i}/{len(ds)} — có ảnh {co}, không {khong}", flush=True)
                time.sleep(NGHI_GIAY)
            conn.commit()
            print(f"Xong: {co} địa điểm có ảnh / {len(ds)} đã thử.")


if __name__ == "__main__":
    main()
