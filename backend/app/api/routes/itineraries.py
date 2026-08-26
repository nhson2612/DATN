"""Endpoint lịch trình: CRUD của người dùng + gợi ý bằng LLM."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.repositories import itinerary_repo
from app.schemas.requests import ItineraryCreateUpdate, RecommendRequest
from app.services import itinerary_service

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])


def _require_owned(itinerary_id: int, user_id: int):
    if not itinerary_repo.owned_by(itinerary_id, user_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch trình.")


@router.get("")
def list_itineraries(current_user: dict = Depends(get_current_user)):
    return {"success": True, "itineraries": itinerary_repo.list_for_user(current_user["id"])}


@router.post("")
def create_itinerary(
    data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)
):
    new_id = itinerary_repo.create(
        current_user["id"], data.name, data.description, data.duration_days, data.stops
    )
    return {"success": True, "id": new_id}


@router.put("/{id}")
def update_itinerary(
    id: int, data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)
):
    _require_owned(id, current_user["id"])
    itinerary_repo.update(id, data.name, data.description, data.duration_days, data.stops)
    return {"success": True, "id": id}


@router.delete("/{id}")
def delete_itinerary(id: int, current_user: dict = Depends(get_current_user)):
    _require_owned(id, current_user["id"])
    itinerary_repo.delete(id)
    return {"success": True, "id": id}


@router.post("/recommend")
def recommend(request: RecommendRequest):
    try:
        result = itinerary_service.recommend(
            request.duration_days, request.preferences, request.budget
        )
    except itinerary_service.LLMUnavailableError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except itinerary_service.NoUsableItineraryError as e:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Mô hình không tạo được lịch trình dùng được: {len(e.dropped)} hoạt "
                "động bị loại vì không khớp danh sách địa điểm. Hãy thử lại hoặc "
                "dùng mô hình lớn hơn."
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Mô hình trả JSON không hợp lệ: {e}")
    return {"success": True, **result}
