"""Truy vấn bảng poi và accommodation. Chỉ SQL, không business logic."""

from app.core.database import execute_query

# 84/94 ranh giới OSM tự cắt nên bắt buộc làm sạch trước ST_Contains.
VALID_BOUNDARY = "ST_CollectionExtract(ST_MakeValid(geom), 3)"

_PLACE_TABLES = ("poi", "accommodation")


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


def all_as_geojson():
    """Toàn bộ poi + accommodation dạng GeoJSON FeatureCollection."""
    rows = execute_query(
        f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(f), '[]'::json)
        ) AS geojson
        FROM (
            SELECT json_build_object(
                'type', 'Feature',
                'id', 'poi_' || id,
                'geometry', ST_AsGeoJSON(geom)::json,
                'properties', json_build_object(
                    'id', id, 'type', 'poi', 'name', name,
                    'amenity', amenity, 'tourism', tourism,
                    'description', description
                )
            ) AS f
            FROM poi
            UNION ALL
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
            FROM accommodation
        ) sub;
        """
    )
    return rows[0]["geojson"] if rows and rows[0].get("geojson") else None


def create(table: str, data: dict):
    _check_table(table)
    if table == "poi":
        sql = """
            INSERT INTO poi (name, amenity, tourism, description, geom)
            VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            RETURNING id
        """
        params = (data["name"], data.get("amenity"), data.get("tourism"),
                  data.get("description"), data["lon"], data["lat"])
    else:
        sql = """
            INSERT INTO accommodation (name, amenity, tourism, address, stars, geom)
            VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            RETURNING id
        """
        params = (data["name"], data.get("amenity"), data.get("tourism"),
                  data.get("address"), data.get("stars"), data["lon"], data["lat"])
    rows = execute_query(sql, params)
    return rows[0]["id"] if rows else None


def update(table: str, place_id: int, data: dict):
    _check_table(table)
    if table == "poi":
        sql = """
            UPDATE poi SET name = %s, amenity = %s, tourism = %s, description = %s,
                           geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            WHERE id = %s RETURNING id
        """
        params = (data["name"], data.get("amenity"), data.get("tourism"),
                  data.get("description"), data["lon"], data["lat"], place_id)
    else:
        sql = """
            UPDATE accommodation SET name = %s, amenity = %s, tourism = %s,
                   address = %s, stars = %s,
                   geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            WHERE id = %s RETURNING id
        """
        params = (data["name"], data.get("amenity"), data.get("tourism"),
                  data.get("address"), data.get("stars"), data["lon"], data["lat"], place_id)
    rows = execute_query(sql, params)
    return rows[0]["id"] if rows else None


def delete(table: str, place_id: int):
    _check_table(table)
    rows = execute_query(f"DELETE FROM {table} WHERE id = %s RETURNING id", (place_id,))
    return rows[0]["id"] if rows else None
