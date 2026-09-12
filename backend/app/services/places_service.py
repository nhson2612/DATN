"""Địa điểm: GeoJSON cho bản đồ và CRUD cho trang quản trị."""

from app.core.config import settings
from app.repositories import place_repo
from app.services import trackasia_service

EMPTY_COLLECTION = {"type": "FeatureCollection", "features": []}


# Tran mac dinh khi client khong gui limit: du cho ban do thanh pho, va chan
# response 87 MB tren gis_vietnam neu ai do goi /api/places khong tham so.
DEFAULT_PLACE_LIMIT = 5000


def all_places_geojson(bbox=None, limit=None):
    accommodation = place_repo.all_as_geojson(
        bbox=bbox, limit=limit or DEFAULT_PLACE_LIMIT
    ) or {"type": "FeatureCollection", "features": []}

    if bbox:
        min_lon, min_lat, max_lon, max_lat = bbox
        center_lon, center_lat = (min_lon + max_lon) / 2, (min_lat + max_lat) / 2
        radius = min(
            settings.trackasia_search_radius_m,
            max(1000, int(max(max_lon - min_lon, max_lat - min_lat) * 111_000 / 2)),
        )
    else:
        center_lon, center_lat = settings.default_lon, settings.default_lat
        radius = settings.trackasia_search_radius_m

    try:
        rows = trackasia_service.nearby_places(
            center_lat, center_lon, radius, limit or DEFAULT_PLACE_LIMIT)
    except (trackasia_service.TrackAsiaConfigurationError,
            trackasia_service.TrackAsiaTransientError):
        rows = []

    for row in rows:
        accommodation["features"].append({
            "type": "Feature",
            "id": row["id"],
            "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
            "properties": {
                "id": row["id"], "type": "trackasia", "name": row["name"],
                "category": row.get("category"), "address": row.get("dia_chi"),
            },
        })
    return accommodation


def create_place(table: str, data: dict):
    return place_repo.create(table, data)


def update_place(table: str, place_id: int, data: dict):
    return place_repo.update(table, place_id, data)


def delete_place(table: str, place_id: int):
    return place_repo.delete(table, place_id)
