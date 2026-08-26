"""Giữ lại để tương thích: mã cũ import `app.auth`.

Nguồn thật là app/core/security.py.
"""

from app.core.security import (  # noqa: F401
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_current_admin,
    get_current_user,
    hash_password,
    security,
    verify_password,
)
