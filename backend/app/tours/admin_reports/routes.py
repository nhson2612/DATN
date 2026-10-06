"""Các endpoint báo cáo tổng hợp cho quản trị viên."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_admin
from app.self_guided.favorites import repository as engagement_repository

router = APIRouter(prefix="/api/admin", tags=["admin-reports"])


@router.get("/stats")
def stats(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    current_user: dict = Depends(get_current_admin),
):
    """Thống kê theo khoảng ngày; mặc định từ đầu tháng hiện tại đến hôm nay."""
    ngay_cuoi = to_date or date.today()
    ngay_dau = from_date or ngay_cuoi.replace(day=1)
    if ngay_dau > ngay_cuoi:
        raise HTTPException(status_code=422, detail="Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")
    if (ngay_cuoi - ngay_dau).days > 365:
        raise HTTPException(status_code=422, detail="Khoảng thống kê tối đa là 366 ngày")

    so_ngay = (ngay_cuoi - ngay_dau).days + 1
    ngay_dau_ky_truoc = ngay_dau - timedelta(days=so_ngay)
    bao_cao = engagement_repository.thong_ke(
        ngay_dau,
        ngay_cuoi + timedelta(days=1),
        ngay_dau_ky_truoc,
    )
    return {
        "success": True,
        "range": {"from": ngay_dau.isoformat(), "to": ngay_cuoi.isoformat()},
        "comparison_range": {
            "from": ngay_dau_ky_truoc.isoformat(),
            "to": (ngay_dau - timedelta(days=1)).isoformat(),
        },
        **bao_cao,
    }
