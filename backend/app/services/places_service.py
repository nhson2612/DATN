"""Địa điểm: GeoJSON cho bản đồ và CRUD cho trang quản trị."""

from app.repositories import place_repo

EMPTY_COLLECTION = {"type": "FeatureCollection", "features": []}


# Tran mac dinh khi client khong gui limit: du cho ban do thanh pho, va chan
# response 87 MB tren gis_vietnam neu ai do goi /api/places khong tham so.
DEFAULT_PLACE_LIMIT = 5000


def all_places_geojson(bbox=None, limit=None):
    return place_repo.all_as_geojson(
        bbox=bbox, limit=limit or DEFAULT_PLACE_LIMIT
    ) or EMPTY_COLLECTION


def create_place(table: str, data: dict):
    return place_repo.create(table, data)


def update_place(table: str, place_id: int, data: dict):
    return place_repo.update(table, place_id, data)


def delete_place(table: str, place_id: int):
    return place_repo.delete(table, place_id)
