-- Hỗ trợ dashboard quản trị theo khoảng ngày, tránh quét toàn bộ lịch sử.
CREATE INDEX IF NOT EXISTS tour_bookings_created_at_idx
    ON tour_bookings(created_at);

CREATE INDEX IF NOT EXISTS payments_status_created_at_idx
    ON payments(status, created_at);

CREATE INDEX IF NOT EXISTS payments_status_effective_at_idx
    ON payments(status, (COALESCE(confirmed_at, created_at)));
