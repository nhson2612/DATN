"""Truy vấn bảng poi và accommodation. Chỉ SQL, không business logic."""

from app.core.database import execute_query

# 84/94 ranh giới OSM tự cắt nên bắt buộc làm sạch trước ST_Contains.
VALID_BOUNDARY = "ST_CollectionExtract(ST_MakeValid(geom), 3)"

_PLACE_TABLES = ("accommodation",)


def _check_table(table: str) -> str:
    if table not in _PLACE_TABLES:
        raise ValueError(f"bảng '{table}' không hợp lệ, chỉ nhận {_PLACE_TABLES}")
    return table


def get_by_id(table: str, place_id: int):
    _check_table(table)
    rows = execute_query(
        f"SELECT id, name, ST_X(geom) AS lon, ST_Y(geom) AS lat FROM {table} WHERE id = %s",
        (place_id,),
    )
    return rows[0] if rows else None


def all_as_geojson(bbox=None, limit=None):
    """Accommodation dạng GeoJSON FeatureCollection.

    POI không còn nằm trong PostGIS nội bộ; lớp service ghép POI Serper
    vào response bản đồ.

    bbox/limit là BẮT BUỘC ở quy mô toàn quốc: gis_vietnam có 345k địa điểm,
    dựng hết thành một FeatureCollection là ~87 MB JSON và mất ~26s. Trên
    gis_tourism (4.3k dòng) thì không ai để ý nên endpoint này ra đời không có
    giới hạn nào. Giống hệt ca /api/roads.

    LƯU Ý: limit áp cho TỪNG bảng, không phải tổng — limit=5000 trả tối đa
    5000 poi + 5000 accommodation = 10.000 features.
    """
    where = "WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)" if bbox else ""
    lim = "LIMIT %s" if limit else ""
    rows = execute_query(
        f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(f), '[]'::json)
        ) AS geojson
        FROM (
            SELECT json_build_object(
                'type', 'Feature',
                'id', 'accommodation_' || id,
                'geometry', ST_AsGeoJSON(geom)::json,
                'properties', json_build_object(
                    'id', id, 'type', 'accommodation', 'name', name,
                    'amenity', amenity, 'tourism', tourism,
                    'stars', stars, 'price_range', price_range, 'address', address
                )
            ) AS f
            FROM (SELECT * FROM accommodation {where} {lim}) a
        ) sub;
        """,
        tuple((list(bbox) if bbox else []) + ([limit] if limit else [])) or None,
    )
    return rows[0]["geojson"] if rows and rows[0].get("geojson") else None


def create(table: str, data: dict):
    _check_table(table)
    sql = """
        INSERT INTO accommodation (name, amenity, tourism, address, stars,
                                   price_range, geom)
        VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        RETURNING id
    """
    params = (data["name"], data.get("amenity"), data.get("tourism"),
              data.get("address"), data.get("stars"), data.get("price_range"),
              data["lon"], data["lat"])
    rows = execute_query(sql, params)
    return rows[0]["id"] if rows else None


def update(table: str, place_id: int, data: dict):
    _check_table(table)
    sql = """
        UPDATE accommodation SET name = %s, amenity = %s, tourism = %s,
               address = %s, stars = %s, price_range = %s,
               geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        WHERE id = %s RETURNING id
    """
    params = (data["name"], data.get("amenity"), data.get("tourism"),
              data.get("address"), data.get("stars"), data.get("price_range"),
              data["lon"], data["lat"], place_id)
    rows = execute_query(sql, params)
    return rows[0]["id"] if rows else None


def delete(table: str, place_id: int):
    _check_table(table)
    rows = execute_query(f"DELETE FROM {table} WHERE id = %s RETURNING id", (place_id,))
    return rows[0]["id"] if rows else None
