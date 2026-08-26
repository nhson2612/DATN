"""Truy vấn mạng đường và định tuyến pgRouting."""

from app.core.config import settings
from app.core.database import execute_query

EDGE_SQL = "SELECT id, source, target, cost, reverse_cost FROM roads"

# Đọc component từ bảng đã vật hoá, KHÔNG gọi pgr_connectedComponents trong
# truy vấn: hàm đó là O(V+E) trên toàn graph và câu snap chạy 2 lần mỗi request.
# Đo được: Function Scan 6.341 dòng 17,7ms -> Index Scan 1 dòng 0,239ms.
_SNAP_SQL = """
    SELECT v.id,
           ST_X(v.the_geom) AS lon,
           ST_Y(v.the_geom) AS lat,
           ST_Distance(v.the_geom::geography,
                       ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS dist_m
    FROM roads_vertices_pgr v
    JOIN roads_components c ON c.node = v.id
    WHERE c.comp_size > %s
    ORDER BY v.the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
    LIMIT 1;
"""

_ROUTE_SQL = """
    SELECT d.seq, d.node, d.edge,
           d.cost AS segment_length_m,
           d.agg_cost AS total_length_m,
           r.name AS street_name,
           ST_AsGeoJSON(r.geom) AS geom
    FROM pgr_dijkstra(%s, %s, %s, directed := {directed}) d
    JOIN roads r ON d.edge = r.id
    ORDER BY d.seq;
"""


def snap_to_network(lon: float, lat: float):
    """Đỉnh gần nhất thuộc component đủ lớn, kèm khoảng cách snap."""
    rows = execute_query(
        _SNAP_SQL, (lon, lat, settings.min_component_size, lon, lat)
    )
    return rows[0] if rows else None


def shortest_path(start_node: int, end_node: int, *, directed: bool):
    return execute_query(
        _ROUTE_SQL.format(directed="true" if directed else "false"),
        (EDGE_SQL, start_node, end_node),
    ) or []


def geometry_only(start_node: int, end_node: int, *, directed: bool):
    sql = """
        SELECT ST_AsGeoJSON(r.geom) AS geom
        FROM pgr_dijkstra(%s, %s, %s, directed := {directed}) d
        JOIN roads r ON d.edge = r.id
        ORDER BY d.seq;
    """.format(directed="true" if directed else "false")
    return execute_query(sql, (EDGE_SQL, start_node, end_node)) or []


def network_as_geojson(bbox=None, tolerance=None, limit=None):
    """Mạng đường dạng GeoJSON — CHỈ để vẽ, không dùng cho định tuyến."""
    tolerance = settings.roads_simplify_tolerance if tolerance is None else tolerance
    limit = settings.roads_feature_limit if limit is None else limit

    geom_expr = "ST_SimplifyPreserveTopology(geom, %s)" if tolerance > 0 else "geom"
    params = []
    if tolerance > 0:
        params.append(tolerance)
    where_sql = ""
    if bbox:
        where_sql = "WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
        params.extend(bbox)
    params.append(limit)

    rows = execute_query(
        f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(f), '[]'::json)
        ) AS geojson
        FROM (
            SELECT json_build_object(
                'type', 'Feature', 'id', id,
                'geometry', ST_AsGeoJSON({geom_expr})::json,
                'properties', json_build_object('name', name, 'highway', highway)
            ) AS f
            FROM roads {where_sql} LIMIT %s
        ) sub;
        """,
        tuple(params),
    )
    return rows[0]["geojson"] if rows and rows[0].get("geojson") else None
