"""Địa điểm: GeoJSON cho bản đồ và CRUD cho trang quản trị."""

from app.core.config import settings
from app.shared.places import repository as place_repo
from app.shared.places import serper as serper_service

EMPTY_COLLECTION = {"type": "FeatureCollection", "features": []}

# Trần mặc định khi client không gửi limit: đủ cho một khung nhìn thành phố, và
# chặn response 87 MB trên gis_vietnam nếu ai đó gọi /api/places không tham số.
DEFAULT_PLACE_LIMIT = 5000

# Số POI lấy thêm từ Serper cho khung nhìn. Google trả tối đa 20 mỗi lượt nên
# lớp POI trên bản đồ mỏng hơn hẳn so với provider cũ — chấp nhận được vì không
# màn hình nào của web còn gọi endpoint này.
SERPER_POI_LIMIT = 20


def all_places_geojson(bbox=None, limit=None):
    """Chỗ lưu trú đọc từ CSDL nội bộ, POI lấy thêm từ Serper theo khung nhìn."""
    collection = place_repo.all_as_geojson(
        bbox=bbox, limit=limit or DEFAULT_PLACE_LIMIT
    ) or {"type": "FeatureCollection", "features": []}

    if bbox:
        min_lon, min_lat, max_lon, max_lat = bbox
        center_lon, center_lat = (min_lon + max_lon) / 2, (min_lat + max_lat) / 2
        radius = max(1000, int(max(max_lon - min_lon, max_lat - min_lat) * 111_000 / 2))
        radius = min(radius, settings.serper_search_radius_m)
    else:
        center_lon, center_lat = settings.default_lon, settings.default_lat
        radius = settings.serper_search_radius_m

    try:
        rows = serper_service.search_maps(
            "địa điểm du lịch", center_lat, center_lon,
            radius_m=radius, limit=SERPER_POI_LIMIT)
    except (serper_service.SerperConfigurationError,
            serper_service.SerperTransientError):
        rows = []

    for row in rows:
        collection["features"].append({
            "type": "Feature",
            "id": row["id"],
            "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
            "properties": {
                "id": row["id"], "type": "serper", "name": row["name"],
                "category": row.get("category"), "address": row.get("dia_chi"),
            },
        })
    return collection


def create_place(table: str, data: dict):
    return place_repo.create(table, data)


def update_place(table: str, place_id: int, data: dict):
    return place_repo.update(table, place_id, data)


def delete_place(table: str, place_id: int):
    return place_repo.delete(table, place_id)
