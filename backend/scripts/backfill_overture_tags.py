"""Lấp cột `tags` cho gis_vietnam từ Overture Places.

gis_vietnam KHÔNG dựng bằng importer.py (Overpass không kham nổi cả nước) mà
bằng DuckDB đọc thẳng parquet Overture, và pipeline đó chỉ giữ name/amenity/
tourism — mọi thuộc tính khác bị bỏ. Script này lấy lại chúng và ghi vào `tags`,
join theo `poi.ov_id` = `place.id`.

Overture KHÔNG dùng tag OSM, nên khoá được map sang đúng tên khoá OSM mà
IR_SYSTEM_PROMPT dạy cho LLM (BẢNG KHOÁ TAG) — nếu không, cùng một câu hỏi sẽ
cần key khác nhau tuỳ DB đang trỏ vào đâu:

    Overture                      -> khoá OSM trong `tags`
    categories.primary            -> cuisine        (vd "vietnamese_restaurant")
    categories.alternate[]        -> cuisine:alt
    addresses[0].freeform         -> addr:street
    phones[0]                     -> phone
    websites[0]                   -> website
    brand.names.primary           -> brand
    operating_status              -> operating_status

Chạy:  cd backend && ./venv/bin/python scripts/backfill_overture_tags.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import duckdb
import psycopg

from app.core.config import settings

RELEASE = "2026-08-19.0"
S3 = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*"
# Bbox Việt Nam — lọc ngay trên parquet để không kéo cả thế giới về.
BBOX = (102.0, 8.0, 110.0, 24.0)
BATCH = 5000


def fetch_overture():
    con = duckdb.connect()
    con.execute(
        "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;"
        "SET s3_region='us-west-2';"
    )
    print(f"Đọc Overture {RELEASE} (bbox Việt Nam)...")
    return con.execute(
        f"""
        SELECT id,
               categories.primary            AS cat_primary,
               categories.alternate          AS cat_alt,
               addresses[1].freeform         AS addr_freeform,
               addresses[1].locality         AS addr_locality,
               phones[1]                     AS phone,
               websites[1]                   AS website,
               brand.names.primary           AS brand,
               operating_status
        FROM read_parquet('{S3}', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN {BBOX[0]} AND {BBOX[2]}
          AND bbox.ymin BETWEEN {BBOX[1]} AND {BBOX[3]}
        """
    ).fetchall()


def to_tags(row):
    """Overture -> dict khoá OSM. Bỏ khoá rỗng để `tags` không đầy null."""
    (_id, cat, cat_alt, addr, locality, phone, website, brand, status) = row
    tags = {
        "cuisine": cat,
        "cuisine:alt": ";".join(cat_alt) if cat_alt else None,
        "addr:street": addr,
        "addr:city": locality,
        "phone": phone,
        "website": website,
        "brand": brand,
        "operating_status": status,
    }
    return {k: v for k, v in tags.items() if v}


def main():
    rows = fetch_overture()
    print(f"Overture trả {len(rows):,} địa điểm trong bbox.")

    payload = [(r[0], json.dumps(to_tags(r), ensure_ascii=False)) for r in rows]
    payload = [(i, t) for i, t in payload if t != "{}"]
    print(f"{len(payload):,} địa điểm có ít nhất một thuộc tính.")

    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TEMP TABLE ov_tags (ov_id text PRIMARY KEY, tags jsonb)"
            )
            with cur.copy("COPY ov_tags (ov_id, tags) FROM STDIN") as cp:
                for ov_id, tags in payload:
                    cp.write_row((ov_id, tags))
            conn.commit()

            for table in ("poi", "accommodation"):
                cur.execute(
                    f"""
                    UPDATE {table} t SET tags = o.tags
                    FROM ov_tags o WHERE t.ov_id = o.ov_id
                    """
                )
                print(f"  {table}: cập nhật {cur.rowcount:,} dòng")
            conn.commit()

    print("Xong.")


if __name__ == "__main__":
    main()
