from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
import jwt
from app.core.config import settings
from app.core.database import execute_query

# Cau hinh JWT lay tu core.config. Truoc day SECRET_KEY co fallback cung nam
# trong code va da push len GitHub — ai doc repo cung tu ky duoc token admin.
# Nay config.py bat buoc phai co JWT_SECRET va tu choi dung lai gia tri da lo.
SECRET_KEY = settings.jwt_secret
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

security = HTTPBearer()

def hash_password(password: str) -> str:
    # hash using bcrypt directly
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # verify using bcrypt directly
    pwd_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user_query = "SELECT id, email, full_name, role FROM users WHERE email = %s LIMIT 1"
    user_res = execute_query(user_query, (email,))
    if not user_res:
        raise credentials_exception
    return user_res[0]

def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không có quyền truy cập chức năng này (Yêu cầu quyền Admin)"
        )
    return current_user


def get_current_operator(current_user: dict = Depends(get_current_user)) -> dict:
    """Xác thực người dùng là Tour Operator đang ở trạng thái ACTIVE (Phase 5.1).

    Trả về dict người dùng kèm operator_id và company_name.
    Chặn truy cập chéo hoặc tài khoản không phải operator / bị khoá.
    """
    if current_user.get("role") != "operator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không có quyền nhà điều hành tour (Yêu cầu quyền Operator)",
        )
    op_res = execute_query(
        "SELECT id, company_name, tax_code, commission_rate, status "
        "FROM operators WHERE user_id = %s LIMIT 1",
        (current_user["id"],),
    )
    if not op_res or op_res[0].get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản nhà điều hành tour chưa được kích hoạt hoặc đã bị khóa",
        )
    op = op_res[0]
    return {
        **current_user,
        "operator_id": op["id"],
        "company_name": op["company_name"],
        "commission_rate": op.get("commission_rate"),
        "operator_status": op.get("status"),
        "is_admin": False,
    }


def get_current_operator_or_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Helper cho phép cả Operator đang active và Admin cùng thao tác trên các endpoint quản lý tour."""
    role = current_user.get("role")
    if role == "admin":
        return {**current_user, "operator_id": None, "is_admin": True}
    if role == "operator":
        return get_current_operator(current_user=current_user)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tài khoản không có quyền thực hiện thao tác này (Yêu cầu quyền Operator hoặc Admin)",
    )

