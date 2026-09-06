"""Backfill ảnh từ Wikimedia Commons cho đúng các địa điểm nằm trong itinerary của tour.

Tập trung đúng các place_id trong tours.itinerary, không fetch dàn trải hàng trăm POI khác.
Tái sử dụng hàm tim_anh() từ scripts.fetch_photos.

Chạy: cd backend && ./venv/bin/python scripts/backfill_itinerary_photos.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg

from app.core.config import settings
from scripts.fetch_photos import NGHI_GIAY, tim_anh


def main():
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            # 1. Lấy tất cả place_id trong itinerary của các tour
            cur.execute("SELECT id, slug, name, itinerary FROM tours ORDER BY id")
            tours = cur.fetchall()

            all_pids = []
            for tid, slug, name, itin in tours:
                for day in (itin or []):
                    for pid in (day.get("place_ids") or []):
                        if pid not in all_pids:
                            all_pids.append(pid)

            print(f"Tổng số địa điểm unique trong itinerary của các tour: {len(all_pids)}")

            # 2. Lọc bỏ các địa điểm đã có ảnh trong place_photos
            cur.execute(
                """
                SELECT place_id FROM place_photos
                WHERE place_type = 'poi' AND place_id = ANY(%s)
                """,
                (all_pids,),
            )
            da_co_anh = {r[0] for r in cur.fetchall()}
            chua_co_anh = [pid for pid in all_pids if pid not in da_co_anh]

            print(f"  - Đã có ảnh trong place_photos: {len(da_co_anh)}")
            print(f"  - Cần tìm ảnh mới: {len(chua_co_anh)}")

            if not chua_co_anh:
                print("Tất cả địa điểm đã có ảnh hoặc không còn địa điểm nào cần backfill.")
                return

            # 3. Lấy tên địa điểm từ bảng poi
            cur.execute(
                """
                SELECT id, name FROM poi WHERE id = ANY(%s)
                """,
                (chua_co_anh,),
            )
            poi_map = dict(cur.fetchall())

            co, khong = 0, 0
            for i, pid in enumerate(chua_co_anh, 1):
                ten = poi_map.get(pid)
                if not ten:
                    print(f"[{i}/{len(chua_co_anh)}] POI #{pid}: không tìm thấy tên trong bảng poi")
                    khong += 1
                    continue

                print(f"[{i}/{len(chua_co_anh)}] POI #{pid} ({ten}): Đang tìm kiếm trên Wikimedia...", end=" ", flush=True)
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
                    conn.commit()
                    co += 1
                    print(f"CÓ ẢNH -> {url}")
                else:
                    khong += 1
                    print("KHÔNG CÓ")

                time.sleep(NGHI_GIAY)

            print(f"\nHoàn tất backfill: {co} địa điểm tìm thấy ảnh mới / {len(chua_co_anh)} đã thử.")


if __name__ == "__main__":
    main()
