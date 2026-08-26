"""Endpoint định tuyến và mạng đường."""

from fastapi import APIRouter, HTTPException, Query

from app.repositories import road_repo
from app.schemas.requests import RouteRequest
from app.services import routing_service

router = APIRouter(prefix="/api", tags=["routing"])


@router.post("/route")
def route(request: RouteRequest):
    try:
        result = routing_service.find_route(
            request.start_lon, request.start_lat, request.end_lon, request.end_lat
        )
    except routing_service.SnapTooFarError as e:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{e.which} cách mạng lưới đường bộ quá xa ({e.distance_m:.0f}m). "
                "Vui lòng chọn vị trí gần đường giao thông."
            ),
        )
    except routing_service.NoRouteError as e:
        raise HTTPException(status_code=404, detail=str(e))

    for row in result["path"]:
        if row.get("geom"):
            import json

            try:
                row["geom"] = json.loads(row["geom"])
            except ValueError:
                pass
    return {"success": True, **result}


@router.get("/roads")
def get_roads_geojson(
    min_lon: float = Query(None, description="Bbox: kinh độ nhỏ nhất"),
    min_lat: float = Query(None, description="Bbox: vĩ độ nhỏ nhất"),
    max_lon: float = Query(None, description="Bbox: kinh độ lớn nhất"),
    max_lat: float = Query(None, description="Bbox: vĩ độ lớn nhất"),
    tolerance: float = Query(None, ge=0.0, le=0.01),
    limit: int = Query(None, ge=1, le=100000),
):
    """Mạng đường dạng GeoJSON, CHỈ để vẽ bản đồ.

    Tuyệt đối không dùng dữ liệu đã giản lược này cho định tuyến — pgr_dijkstra
    đọc trực tiếp roads.geom nên không bị ảnh hưởng.
    """
    bbox_vals = [min_lon, min_lat, max_lon, max_lat]
    bbox = tuple(bbox_vals) if all(v is not None for v in bbox_vals) else None
    try:
        data = road_repo.network_as_geojson(bbox=bbox, tolerance=tolerance, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roads: {e}")
    return data or {"type": "FeatureCollection", "features": []}
