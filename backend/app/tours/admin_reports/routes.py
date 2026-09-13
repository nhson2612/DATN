"""Các endpoint báo cáo tổng hợp cho quản trị viên."""

from fastapi import APIRouter, Depends

from app.core.security import get_current_admin
from app.self_guided.favorites import repository as engagement_repository

router = APIRouter(prefix="/api/admin", tags=["admin-reports"])


@router.get("/stats")
def stats(current_user: dict = Depends(get_current_admin)):
    return {"success": True, "stats": engagement_repository.thong_ke()}
