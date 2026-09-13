"""Endpoint Admin quản lý Tour Operator (Phase 5.1)."""

from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_admin
from app.shared.schemas.requests import OperatorCreate
from app.tours.operator import service as operator_service

router = APIRouter(prefix="/api/admin/operators", tags=["admin-operators"])


@router.post("")
def create_operator(
    data: OperatorCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Admin tạo tài khoản nhà điều hành tour mới (Phase 5.1).

    Liên kết tài khoản User (role='operator') và bản ghi Operators trong một transaction.
    Trả về mã 400 nếu email đã tồn tại.
    """
    op = operator_service.create_operator(data)
    return {
        "success": True,
        "operator": op,
        "message": "Tạo tài khoản nhà điều hành tour thành công.",
    }


@router.get("")
def list_operators(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(get_current_admin),
):
    """Admin xem danh sách các nhà điều hành tour trong hệ thống kèm thông tin tài khoản user."""
    operators = operator_service.list_operators(limit=limit, offset=offset)
    return {
        "success": True,
        "operators": operators,
    }
