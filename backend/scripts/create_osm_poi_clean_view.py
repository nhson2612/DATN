"""Tạo lớp POI du lịch sạch từ OSM raw trong database osm_audit.

Không sửa hoặc xóa các bảng osm2pgsql. Bộ lọc dùng tag và tín hiệu chất lượng
của dữ liệu; không có danh sách tên địa điểm viết tay.
"""

import subprocess


SQL = r"""
CREATE OR REPLACE VIEW osm_poi_clean AS
WITH source AS (
    SELECT p.osm_id,
           trim(regexp_replace(
               regexp_replace(p.name, '(?:\+?84|0)[0-9][0-9 .()\-]{8,}', '', 'g'),
               '[[:space:]]+', ' ', 'g'
           )) AS name,
           p.amenity, p.shop, p.tourism, p.historic, p.natural, p.leisure,
           p.public_transport, p.railway, p.place, p.brand, p.operator,
           p.way,
           lower(regexp_replace(unaccent(trim(regexp_replace(
               regexp_replace(p.name, '(?:\+?84|0)[0-9][0-9 .()\-]{8,}', '', 'g'),
               '[[:space:]]+', ' ', 'g'))), '[^a-z0-9]+', ' ', 'gi')) AS name_key
    FROM osm_point p
    WHERE p.name IS NOT NULL
      AND p.way IS NOT NULL
      AND (p.amenity IS NOT NULL OR p.shop IS NOT NULL OR p.tourism IS NOT NULL
           OR p.historic IS NOT NULL OR p.leisure IS NOT NULL
           OR p.public_transport IS NOT NULL OR p.railway IS NOT NULL)
), frequencies AS (
    SELECT name_key, COUNT(*) AS same_name_count
    FROM source
    GROUP BY name_key
), ranked AS (
    SELECT s.*, f.same_name_count,
           row_number() OVER (
               PARTITION BY s.name_key,
                            round(ST_X(ST_Transform(s.way, 4326))::numeric, 5),
                            round(ST_Y(ST_Transform(s.way, 4326))::numeric, 5)
               ORDER BY (s.tourism IS NOT NULL) DESC,
                        (s.historic IS NOT NULL) DESC,
                        (s.shop IS NOT NULL OR s.amenity IS NOT NULL) DESC,
                        s.osm_id
           ) AS duplicate_rank
    FROM source s
    JOIN frequencies f USING (name_key)
)
SELECT osm_id, name, amenity, shop, tourism, historic, "natural", leisure,
       public_transport, railway, place, brand, operator,
       ST_Transform(way, 4326) AS geom,
       same_name_count
FROM ranked
WHERE duplicate_rank = 1
  AND length(name) >= 3
  AND NOT (array_length(regexp_split_to_array(name_key, ' '), 1) = 1
           AND same_name_count >= 10
           AND brand IS NULL AND operator IS NULL)
"""

QUERY = SQL + "; SELECT (SELECT COUNT(*) FROM osm_point), (SELECT COUNT(*) FROM osm_poi_clean);"


def main():
    result = subprocess.run(
        ['docker', 'exec', 'gis_db', 'psql', '-U', 'postgres', '-d', 'osm_audit',
         '-At', '-F', '\t', '-c', QUERY],
        text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    raw, clean = result.stdout.strip().splitlines()[-1].split('\t')
    print(f"osm_point raw={int(raw):,}")
    print(f"osm_poi_clean={int(clean):,}")
    print(f"removed={int(raw) - int(clean):,}")


if __name__ == '__main__':
    main()
