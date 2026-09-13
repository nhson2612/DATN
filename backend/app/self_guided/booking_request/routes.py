"""API yêu cầu đặt chỗ cho địa điểm."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.logging import get_logger
from app.core.security import get_current_admin, get_current_user
from app.self_guided.favorites import repository as booking_repository
from app.shared.schemas.requests import BookingRequest

logger = get_logger(__name__)
router = APIRouter(prefix="/api/booking-requests", tags=["bookings"])


def _validate_place_type(place_type: str):
    if place_type not in booking_repository.BANG_HOP_LE:
        raise HTTPException(status_code=400, detail="place_type không hợp lệ.")


@router.post("")
def create_booking(data: BookingRequest,
                   current_user: dict = Depends(get_current_user)):
    _validate_place_type(data.place_type)
    if data.check_in and data.check_out and data.check_out <= data.check_in:
        raise HTTPException(status_code=400, detail="Ngày trả phải sau ngày nhận.")
    new_id = booking_repository.create_booking(data.model_dump(), current_user["id"])
    logger.info("Yêu cầu đặt chỗ #%s: %s #%s, khách %r",
                new_id, data.place_type, data.place_id, data.full_name)
    return {"success": True, "id": new_id,
            "message": "Đã ghi nhận yêu cầu. Chúng tôi sẽ liên hệ lại với bạn sớm nhất."}


@router.get("")
def list_bookings(status: str = Query(None),
                  limit: int = Query(100, ge=1, le=500),
                  current_user: dict = Depends(get_current_admin)):
    return {"success": True,
            "bookings": booking_repository.list_bookings(status, limit)}


@router.put("/{booking_id}")
def update_status(booking_id: int,
                  status: str = Query(...),
                  current_user: dict = Depends(get_current_admin)):
    if status not in ("moi", "da_lien_he", "huy"):
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ.")
    if not booking_repository.update_booking_status(booking_id, status):
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu.")
    return {"success": True, "id": booking_id, "status": status}
