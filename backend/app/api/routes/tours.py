"""Endpoint tour trọn gói."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_admin, get_current_user
from app.repositories import tour_repo
from app.schemas.requests import TourBookingRequest
from app.services import tour_service

router = APIRouter(prefix="/api/tours", tags=["tours"])


@router.get("")
def list_tours(
    province_id: int = Query(None),
    max_days: int = Query(None, ge=1, le=30),
    max_price: int = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    return {"success": True, **tour_service.list_tours(
        province_id=province_id, max_days=max_days, max_price=max_price,
        page=page, page_size=page_size)}


@router.get("/{slug}")
def get_tour(slug: str):
    tour = tour_service.get_tour(slug)
    if not tour:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour.")
    return {"success": True, "tour": tour}


@router.post("/book")
def book(data: TourBookingRequest,
         current_user: dict = Depends(get_current_user)):
    try:
        kq = tour_service.book(data.model_dump(), current_user["id"])
    except tour_service.HetChoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {
        "success": True, **kq,
        "message": "Đã ghi nhận yêu cầu đặt tour. Chúng tôi sẽ liên hệ để xác nhận.",
    }


@router.get("/admin/bookings")
def list_bookings(status: str = Query(None),
                  limit: int = Query(100, ge=1, le=500),
                  current_user: dict = Depends(get_current_admin)):
    return {"success": True, "bookings": tour_repo.list_bookings(status, limit)}
