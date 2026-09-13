"""Nghiệp vụ quản trị Tour Operator (Phase 5.1).

Tách biệt logic nghiệp vụ khỏi HTTP API và SQL repository.
"""

from fastapi import HTTPException

from app.core.database import transaction
from app.core.security import hash_password
from app.shared.accounts import repository as user_repo
from app.tours.operator import repository as operator_repo
from app.shared.schemas.requests import OperatorCreate


def create_operator(data: OperatorCreate) -> dict:
    """Admin tạo tài khoản Tour Operator (User role='operator' + bản ghi bảng operators).

    Đảm bảo tính nguyên tử (atomic): tạo cả hai trong cùng một transaction.
    Từ chối (400) nếu email đã tồn tại.
    """
    if user_repo.email_exists(data.email):
        raise HTTPException(status_code=400, detail="Email đã được sử dụng.")

    hashed_pwd = hash_password(data.password)

    with transaction() as tx:
        user_id = user_repo.create(
            email=data.email,
            hashed_password=hashed_pwd,
            full_name=data.full_name,
            role="operator",
            tx=tx,
        )
        op_id = operator_repo.create_operator(
            user_id=user_id,
            company_name=data.company_name,
            tax_code=data.tax_code,
            commission_rate=data.commission_rate or 0.10,
            status=data.status or "ACTIVE",
            tx=tx,
        )

    return {
        "id": op_id,
        "user_id": user_id,
        "email": data.email,
        "full_name": data.full_name,
        "company_name": data.company_name,
        "tax_code": data.tax_code,
        "commission_rate": data.commission_rate or 0.10,
        "status": data.status or "ACTIVE",
    }


def list_operators(limit: int = 100, offset: int = 0) -> list[dict]:
    """Danh sách các Tour Operator kèm thông tin tài khoản người dùng."""
    return operator_repo.list_operators(limit=limit, offset=offset)
