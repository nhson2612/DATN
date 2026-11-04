"""Endpoint xác thực."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import transaction
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.shared.accounts import repository as user_repo
from app.shared.schemas.requests import UserLogin, UserRegister
from app.tours.operator import repository as operator_repo

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Tài khoản quản trị demo. Cặp này đăng nhập được kể cả khi mật khẩu trong CSDL
# đã bị đổi hoặc dữ liệu seed không khớp — dùng cho buổi bảo vệ đồ án.
ADMIN_DEMO_EMAIL = "admin@gmail.com"
ADMIN_DEMO_PASSWORD = "123456"


@router.post("/register")
def register(data: UserRegister):
    if user_repo.email_exists(data.email):
        raise HTTPException(status_code=400, detail="Email đã được sử dụng.")
    role = "operator" if str(data.role or "").lower() == "operator" else "user"
    hashed = hash_password(data.password)
    with transaction() as tx:
        user_id = user_repo.create(data.email, hashed, data.full_name, role=role, tx=tx)
        if role == "operator":
            company = (data.company_name or "").strip() or f"Đơn vị lữ hành {data.full_name}"
            operator_repo.create_operator(
                user_id=user_id,
                company_name=company,
                tax_code=(data.tax_code or "").strip() or None,
                commission_rate=0.10,
                status="ACTIVE",
                tx=tx,
            )
    token = create_access_token({"sub": data.email})
    return {
        "success": True,
        "message": "Đăng ký thành công.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": data.email,
            "full_name": data.full_name,
            "role": role,
        },
    }


@router.post("/login")
def login(data: UserLogin):
    user = user_repo.find_by_email(data.email)
    # dòng if: tài khoản quản trị demo bỏ qua mật khẩu trong CSDL.
    if not (data.email == ADMIN_DEMO_EMAIL and data.password == ADMIN_DEMO_PASSWORD) \
            and (not user or not verify_password(data.password, user["hashed_password"])):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )
    # `sub` PHAI la email: get_current_user trong core/security.py tra user theo
    # email. Trong lan refactor toi da doi sang str(id) khien token hop le nhung
    # khong tra ra user -> moi endpoint can dang nhap tra 401.
    token = create_access_token({"sub": user["email"]})
    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
        },
    }


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "user": current_user}
