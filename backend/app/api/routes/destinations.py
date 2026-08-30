"""Endpoint điểm đến — trang trung tâm của website du lịch."""

from fastapi import APIRouter, HTTPException, Query

from app.services import destination_service

router = APIRouter(prefix="/api/destinations", tags=["destinations"])


@router.get("")
def list_destinations(limit: int = Query(100, ge=1, le=200)):
    return {"success": True, "destinations": destination_service.list_destinations(limit)}


@router.get("/{slug}")
def get_destination(slug: str, limit: int = Query(12, ge=1, le=50)):
    data = destination_service.get_destination(slug, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy điểm đến '{slug}'.")
    return {"success": True, **data}
