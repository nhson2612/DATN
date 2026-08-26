"""Khởi tạo dữ liệu lần đầu."""

from app.core.config import settings
from app.core.database import execute_query
from app.core.security import hash_password
from app.repositories import user_repo


def create_default_users():
    """Tạo admin và user mẫu, CHỈ khi bảng users còn trống.

    Mật khẩu lấy từ cấu hình. Đây là tài khoản tiện cho phát triển — đổi
    SEED_ADMIN_PASSWORD trong .env trước khi chạy ở môi trường thật.
    """
    try:
        res = execute_query("SELECT COUNT(*) FROM users")
        if not res or res[0]["count"] != 0:
            return
        user_repo.create(
            settings.seed_admin_email,
            hash_password(settings.seed_admin_password),
            "Administrator",
            "admin",
        )
        user_repo.create(
            settings.seed_user_email,
            hash_password(settings.seed_user_password),
            "Khách du lịch",
            "user",
        )
        print(
            f"Đã tạo tài khoản mặc định: {settings.seed_admin_email} (admin), "
            f"{settings.seed_user_email} (user)"
        )
    except Exception as e:
        print(f"Không khởi tạo được tài khoản mặc định: {e}")
