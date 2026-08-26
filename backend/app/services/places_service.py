"""Địa điểm: GeoJSON cho bản đồ và CRUD cho trang quản trị."""

from app.repositories import place_repo

EMPTY_COLLECTION = {"type": "FeatureCollection", "features": []}


def all_places_geojson():
    return place_repo.all_as_geojson() or EMPTY_COLLECTION


def create_place(table: str, data: dict):
    return place_repo.create(table, data)


def update_place(table: str, place_id: int, data: dict):
    return place_repo.update(table, place_id, data)


def delete_place(table: str, place_id: int):
    return place_repo.delete(table, place_id)
