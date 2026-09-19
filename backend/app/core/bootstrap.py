"""Khởi tạo dữ liệu lần đầu."""

from app.core.config import settings
from app.core.database import execute_query
from app.core.logging import get_logger
from app.core.security import hash_password
from app.shared.accounts import repository as user_repo
from app.shared.enrichment import repository as enrichment_repo

logger = get_logger(__name__)


def ensure_db_schema():
    """Nâng cấp schema nhẹ trên DB cũ khi khởi động (idempotent)."""
    try:
        execute_query("ALTER TABLE place_photos ADD COLUMN IF NOT EXISTS details JSONB;")
        execute_query("ALTER TABLE place_photos ALTER COLUMN place_id TYPE VARCHAR(512) USING place_id::text;")
        execute_query("ALTER TABLE favorites ALTER COLUMN place_id TYPE VARCHAR(512) USING place_id::text;")
        # Các tham chiếu provider là trung lập để lịch sử thanh toán không bị
        # khóa vào một cổng duy nhất.
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(30);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(100);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(100);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_request_id VARCHAR(100);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payload JSONB;")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS needs_refund BOOLEAN NOT NULL DEFAULT FALSE;")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(255);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_request_id VARCHAR(100);")
        execute_query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_payload JSONB;")
        execute_query("CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_unique_idx ON payments(provider, provider_order_id) WHERE provider_order_id IS NOT NULL;")
        execute_query("""CREATE TABLE IF NOT EXISTS booking_passengers (
            id BIGSERIAL PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
            sequence_no INTEGER NOT NULL, full_name VARCHAR(255) NOT NULL, phone VARCHAR(50), email VARCHAR(255),
            UNIQUE (booking_id, sequence_no))""")
        execute_query("CREATE INDEX IF NOT EXISTS booking_passengers_booking_idx ON booking_passengers(booking_id);")
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
