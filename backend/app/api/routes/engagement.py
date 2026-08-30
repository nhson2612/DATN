"""Yêu thích và yêu cầu đặt chỗ — nghiệp vụ giữ chân người dùng."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.logging import get_logger
from app.core.security import get_current_admin, get_current_user
from app.repositories import engagement_repo
from app.schemas.requests import BookingRequest, FavoriteRequest

logger = get_logger(__name__)

fav_router = APIRouter(prefix="/api/favorites", tags=["favorites"])
booking_router = APIRouter(prefix="/api/booking-requests", tags=["bookings"])


def _kiem_place_type(place_type: str):
    if place_type not in engagement_repo.BANG_HOP_LE:
        raise HTTPException(
            status_code=400,
            detail="place_type phải là 'poi' hoặc 'accommodation'.",
        )


# ── Yêu thích ────────────────────────────────────────────────────────────────

@fav_router.get("")
def list_favorites(current_user: dict = Depends(get_current_user)):
    return {"success": True,
            "favorites": engagement_repo.list_favorites(current_user["id"])}


@fav_router.post("")
def add_favorite(data: FavoriteRequest,
                 current_user: dict = Depends(get_current_user)):
    _kiem_place_type(data.place_type)
    new_id = engagement_repo.add_favorite(
        current_user["id"], data.place_type, data.place_id)
    # new_id là None khi đã có sẵn (ON CONFLICT DO NOTHING) — vẫn trả 200 vì với
    # người dùng thì "đã trong danh sách yêu thích" là kết quả đúng.
    return {"success": True, "id": new_id, "da_co": new_id is None}


@fav_router.delete("/{place_type}/{place_id}")
def remove_favorite(place_type: str, place_id: int,
                    current_user: dict = Depends(get_current_user)):
    _kiem_place_type(place_type)
    if not engagement_repo.remove_favorite(current_user["id"], place_type, place_id):
        raise HTTPException(status_code=404, detail="Không có trong danh sách yêu thích.")
    return {"success": True}


# ── Yêu cầu đặt chỗ ──────────────────────────────────────────────────────────

@booking_router.post("")
def create_booking(data: BookingRequest, current_user: dict = Depends(get_current_user)):
    _kiem_place_type(data.place_type)
    if data.check_in and data.check_out and data.check_out <= data.check_in:
        raise HTTPException(status_code=400, detail="Ngày trả phải sau ngày nhận.")

    new_id = engagement_repo.create_booking(data.model_dump(), current_user["id"])
    logger.info("Yêu cầu đặt chỗ #%s: %s #%s, khách %r",
                new_id, data.place_type, data.place_id, data.full_name)
    return {
        "success": True,
        "id": new_id,
        "message": "Đã ghi nhận yêu cầu. Chúng tôi sẽ liên hệ lại với bạn sớm nhất.",
    }


@booking_router.get("")
def list_bookings(status: str = Query(None, description="moi | da_lien_he | huy"),
                  limit: int = Query(100, ge=1, le=500),
                  current_user: dict = Depends(get_current_admin)):
    return {"success": True, "bookings": engagement_repo.list_bookings(status, limit)}


@booking_router.put("/{booking_id}")
def update_status(booking_id: int,
                  status: str = Query(..., description="moi | da_lien_he | huy"),
                  current_user: dict = Depends(get_current_admin)):
    if status not in ("moi", "da_lien_he", "huy"):
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ.")
    if not engagement_repo.update_booking_status(booking_id, status):
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu.")
    return {"success": True, "id": booking_id, "status": status}
