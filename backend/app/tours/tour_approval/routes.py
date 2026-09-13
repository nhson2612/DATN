"""Đường HTTP cho UC-AD02 — gửi duyệt, duyệt và từ chối tour."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_admin, get_current_operator_or_admin
from app.tours.tour_approval import service

router = APIRouter(prefix="/api", tags=["tour-approval"])


class TuChoiRequest(BaseModel):
    reason: str = ""


@router.post("/operator/tours/{tour_id}/submit")
def submit_tour(tour_id: int, current_user: dict = Depends(get_current_operator_or_admin)):
    """Nhà điều hành gửi tour cho admin duyệt."""
    try:
        return {"success": True, "tour": service.gui_duyet_tour(tour_id, current_user)}
    except service.TourApprovalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/admin/tours/pending")
def list_pending_tours(_: dict = Depends(get_current_admin)):
    """Danh sách tour đang chờ duyệt, cho màn duyệt tour của quản trị."""
    return {"success": True, "tours": service.danh_sach_cho_duyet()}


@router.post("/admin/tours/{tour_id}/approve")
def approve_tour(tour_id: int, _: dict = Depends(get_current_admin)):
    try:
        return {"success": True, "tour": service.duyet_tour(tour_id)}
    except service.TourApprovalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/admin/tours/{tour_id}/reject")
def reject_tour(tour_id: int, body: TuChoiRequest, _: dict = Depends(get_current_admin)):
    try:
        return {"success": True, "tour": service.tu_choi_tour(tour_id, body.reason)}
    except service.TourApprovalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
