"""Gán mỗi địa điểm vào tỉnh/thành chứa nó.

Trang điểm đến ("Đà Nẵng có gì") cần lọc `WHERE province_id = ...`. Chạy
ST_Contains giữa 805k địa điểm và 55 polygon tỉnh mỗi lần tải trang là không
khả thi — đo được hơn 2 phút cho một lần đếm. Tính MỘT LẦN rồi lưu.

Ranh giới OSM/Overture có bản ghi tự cắt nên phải làm sạch bằng
ST_CollectionExtract(ST_MakeValid(geom), 3) trước khi ST_Contains, nếu không
kết quả không xác định. Cùng mẫu với VALID_BOUNDARY trong app/research/ir.py.

Chạy:  cd backend && ./venv/bin/python scripts/assign_province.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg

from app.core.config import settings

DDL = """
ALTER TABLE poi           ADD COLUMN IF NOT EXISTS province_id int;
ALTER TABLE accommodation ADD COLUMN IF NOT EXISTS province_id int;

-- Polygon tỉnh đã làm sạch, materialise để không phải MakeValid lặp lại.
DROP TABLE IF EXISTS provinces_clean;
CREATE TABLE provinces_clean AS
SELECT id, name, ST_CollectionExtract(ST_MakeValid(geom), 3) AS geom
FROM boundaries WHERE admin_level = 4;
CREATE INDEX provinces_clean_gix ON provinces_clean USING gist (geom);
"""

GAN = """
UPDATE {bang} t SET province_id = p.id
FROM provinces_clean p
WHERE t.province_id IS NULL AND ST_Contains(p.geom, t.geom);
"""

INDEX = """
CREATE INDEX IF NOT EXISTS {bang}_province_idx ON {bang}(province_id);
"""


def main():
    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            print("Chuẩn bị bảng ranh giới sạch...", flush=True)
            cur.execute(DDL)
            conn.commit()

            for bang in ("poi", "accommodation"):
                print(f"Gán tỉnh cho {bang}...", flush=True)
                cur.execute(GAN.format(bang=bang))
                print(f"  {cur.rowcount:,} dòng", flush=True)
                conn.commit()
                cur.execute(INDEX.format(bang=bang))
                conn.commit()

            # Bảng đếm sẵn: COUNT(*) trên 805k dòng JOIN mất 72 giây mỗi lần
            # tải danh sách điểm đến. Số này chỉ đổi khi nhập dữ liệu nên tính
            # sẵn một lần ở đây.
            print("Tính bảng thống kê điểm đến...", flush=True)
            cur.execute("""
                DROP TABLE IF EXISTS province_stats;
                CREATE TABLE province_stats AS
                SELECT p.id, p.name,
                       ST_X(ST_Centroid(p.geom)) AS lon,
                       ST_Y(ST_Centroid(p.geom)) AS lat,
                       (SELECT count(*) FROM poi t WHERE t.province_id = p.id)
                           AS so_dia_diem,
                       (SELECT count(*) FROM accommodation a WHERE a.province_id = p.id)
                           AS so_luu_tru
                FROM provinces_clean p;
                ALTER TABLE province_stats ADD PRIMARY KEY (id);
            """)
            conn.commit()

            cur.execute("""
                SELECT p.name, count(*) n
                FROM poi t JOIN provinces_clean p ON p.id = t.province_id
                GROUP BY p.name ORDER BY n DESC LIMIT 8
            """)
            print("\nTop tỉnh theo số địa điểm:")
            for name, n in cur.fetchall():
                print(f"  {name}: {n:,}")

            cur.execute("SELECT count(*) FROM poi WHERE province_id IS NULL")
            print(f"\nPOI chưa gán được tỉnh: {cur.fetchone()[0]:,}")
    print("Xong.")


if __name__ == "__main__":
    main()
