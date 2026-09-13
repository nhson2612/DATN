"""Chạy migration 008: Bổ sung 29 tỉnh thành còn thiếu và chuẩn hóa danh mục 63 tỉnh thành Việt Nam.

Chạy lệnh:
    cd backend && ./venv/bin/python scripts/seed_full_63_provinces.py
"""

import sys
from pathlib import Path

# Thêm backend root vào sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import pool, execute_query

SQL_FILE = Path(__file__).resolve().parents[2] / "db" / "migrations" / "008_seed_full_63_provinces.sql"


def run():
    print(f"Đọc file migration: {SQL_FILE}")
    sql_text = SQL_FILE.read_text(encoding="utf-8")

    # Tách các khối lệnh SQL
    statements = [s.strip() for s in sql_text.split(";") if s.strip()]

    with pool.connection() as conn:
        with conn.cursor() as cur:
            for s in statements:
                cur.execute(s)
        conn.commit()

    # Kiểm tra kết quả
    rows = execute_query("SELECT count(*) AS c FROM province_stats")
    total = rows[0]["c"] if rows else 0
    print(f"Tổng số tỉnh/thành hiện có trong province_stats: {total}")

    provinces = execute_query(
        "SELECT id, name FROM province_stats ORDER BY regexp_replace(name, '^(Thành phố|Tỉnh)\\s+', '') ASC"
    )
    print("\nDanh sách 63 tỉnh thành sau chuẩn hóa:")
    for i, p in enumerate(provinces, 1):
        print(f"  {i:2d}. [{p['id']:4d}] {p['name']}")

    pool.close()


if __name__ == "__main__":
    run()
