"""Endpoint địa điểm: GeoJSON cho bản đồ + CRUD cho trang quản trị."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_admin
from app.schemas.requests import AccommodationCreateUpdate, POICreateUpdate
from app.services import places_service

router = APIRouter(prefix="/api", tags=["places"])


@router.get("/places")
def get_places_geojson():
    return places_service.all_places_geojson()


def _crud_routes(table: str, path: str, schema):
    @router.post(path, name=f"create_{table}")
    def create(data: schema, current_user: dict = Depends(get_current_admin)):
        new_id = places_service.create_place(table, data.model_dump())
        return {"success": True, "id": new_id}

    @router.put(path + "/{id}", name=f"update_{table}")
    def update(id: int, data: schema, current_user: dict = Depends(get_current_admin)):
        if not places_service.update_place(table, id, data.model_dump()):
            raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm.")
        return {"success": True, "id": id}

    @router.delete(path + "/{id}", name=f"delete_{table}")
    def remove(id: int, current_user: dict = Depends(get_current_admin)):
        if not places_service.delete_place(table, id):
            raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm.")
        return {"success": True, "id": id}


_crud_routes("poi", "/poi", POICreateUpdate)
_crud_routes("accommodation", "/accommodation", AccommodationCreateUpdate)
