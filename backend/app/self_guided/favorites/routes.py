"""API danh sách địa điểm yêu thích của khách."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.self_guided.favorites import repository as favorite_repository
from app.shared.schemas.requests import FavoriteRequest

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


def _validate_place_type(place_type: str):
    if place_type not in favorite_repository.BANG_HOP_LE:
        raise HTTPException(status_code=400, detail="place_type không hợp lệ.")


@router.get("")
def list_favorites(current_user: dict = Depends(get_current_user)):
    return {"success": True,
            "favorites": favorite_repository.list_favorites(current_user["id"])}


@router.post("")
def add_favorite(data: FavoriteRequest,
                 current_user: dict = Depends(get_current_user)):
    _validate_place_type(data.place_type)
    new_id = favorite_repository.add_favorite(
        current_user["id"], data.place_type, data.place_id)
    return {"success": True, "id": new_id, "da_co": new_id is None}


@router.delete("/{place_type}/{place_id:path}")
def remove_favorite(place_type: str, place_id: str,
                    current_user: dict = Depends(get_current_user)):
    _validate_place_type(place_type)
    if not favorite_repository.remove_favorite(
            current_user["id"], place_type, place_id):
        raise HTTPException(status_code=404, detail="Không có trong danh sách yêu thích.")
    return {"success": True}
