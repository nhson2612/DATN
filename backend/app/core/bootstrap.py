"""Khởi tạo dữ liệu lần đầu."""

from app.core.config import settings
from app.core.database import execute_query
from app.core.logging import get_logger
from app.core.security import hash_password
from app.repositories import enrichment_repo, user_repo

logger = get_logger(__name__)


def ensure_db_schema():
    """Nâng cấp schema nhẹ trên DB cũ khi khởi động (idempotent)."""
    try:
        execute_query("ALTER TABLE place_photos ADD COLUMN IF NOT EXISTS details JSONB;")
        enrichment_repo.ensure_schema()
    except Exception as e:
        logger.warning("Không thể nâng cấp schema: %s", e)


def create_default_users():
    """Tạo admin và user mẫu, CHỈ khi bảng users còn trống.

    Mật khẩu lấy từ cấu hình. Đây là tài khoản tiện cho phát triển — đổi
    SEED_ADMIN_PASSWORD trong .env trước khi chạy ở môi trường thật.
    """
    ensure_db_schema()
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
        logger.info(
            "Đã tạo tài khoản mặc định: %s (admin), %s (user)",
            settings.seed_admin_email, settings.seed_user_email,
        )
    except Exception as e:
        logger.error("Không khởi tạo được tài khoản mặc định: %s", e, exc_info=True)
