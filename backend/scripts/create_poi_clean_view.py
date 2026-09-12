"""Tạo lớp POI sạch cho app, không xóa dữ liệu Overture gốc.

Lớp này chỉ giữ POI thuộc các nhóm khách du lịch dùng, làm sạch số điện thoại
chèn trong tên và loại bản ghi trùng cùng tên/loại/vị trí. Bảng `poi` nguyên bản
vẫn được giữ để audit và enrichment.
"""

import psycopg
import subprocess

from app.core.config import settings


SQL = """
CREATE OR REPLACE VIEW poi_clean AS
WITH normalized AS (
    SELECT p.*,
           trim(regexp_replace(
               regexp_replace(p.name, '(?:\\+?84|0)[0-9][0-9 .()\\-]{8,}', '', 'g'),
               '[[:space:]]+', ' ', 'g'
           )) AS clean_name
    FROM poi p
    WHERE p.geom IS NOT NULL
      AND p.name IS NOT NULL
      AND p.tags->>'category_root' IN (
          'food_and_drink', 'cultural_and_historic',
          'geographic_entities', 'arts_and_entertainment',
          'sports_and_recreation', 'travel_and_transportation',
          'shopping'
      )
), ranked AS (
    SELECT n.*, row_number() OVER (
        PARTITION BY n.tags->>'category_root',
                     lower(regexp_replace(unaccent(n.clean_name), '[^a-z0-9]+', ' ', 'gi')),
                     round(ST_X(n.geom)::numeric, 5),
                     round(ST_Y(n.geom)::numeric, 5)
        ORDER BY (n.tags->>'website' IS NOT NULL) DESC,
                 (n.tags->>'phone' IS NOT NULL) DESC,
                 n.confidence DESC NULLS LAST,
                 n.id
    ) AS duplicate_rank
    FROM normalized n
)
SELECT id, osm_id, clean_name AS name, amenity, tourism, description,
       confidence, geom, ov_id, rating, review_count, price_level,
       climate_label, tags, province_id
FROM ranked
WHERE duplicate_rank = 1
  AND length(clean_name) >= 3
  AND lower(trim(clean_name)) NOT IN (
      'unnamed', 'unknown', 'poi', 'place', 'test',
      'không tên', 'chưa đặt tên'
  )
"""


def main():
    try:
        with psycopg.connect(settings.database_url) as conn:
            conn.execute(SQL)
            conn.commit()
            clean_count = conn.execute("SELECT COUNT(*) FROM poi_clean").fetchone()[0]
            raw_count = conn.execute("SELECT COUNT(*) FROM poi").fetchone()[0]
    except psycopg.OperationalError:
        # Dev machine may not publish PostgreSQL port; use the running DB
        # container without changing the configured application DSN.
        query = SQL + ";\nSELECT (SELECT COUNT(*) FROM poi), (SELECT COUNT(*) FROM poi_clean);"
        result = subprocess.run(
            ['docker', 'exec', 'gis_db', 'psql', '-U', 'postgres',
             '-d', 'gis_vietnam', '-At', '-F', '\t', '-c', query],
            text=True, capture_output=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr)
        raw_count, clean_count = result.stdout.strip().splitlines()[-1].split('\t')
        raw_count, clean_count = int(raw_count), int(clean_count)
    print(f"poi raw={raw_count:,}")
    print(f"poi_clean={clean_count:,}")
    print(f"removed={raw_count - clean_count:,}")


if __name__ == '__main__':
    main()
