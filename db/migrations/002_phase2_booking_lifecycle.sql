-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 002_phase2_booking_lifecycle.sql
-- Mục đích: Nâng cấp schema cho Phase 2 — Vòng đời booking & nhật ký trạng thái
-- Bao gồm:
--   1. Tạo bảng `booking_status_history` lưu nhật ký chuyển trạng thái (BR-L2):
--      booking_id, from_status, to_status, actor_id, reason, created_at.
--   2. Tạo các index cần thiết (booking_id, created_at) phục vụ tra cứu lịch sử.
--
-- RÀNG BUỘC VÀ TÍNH CHẤT:
--   - Idempotent: chạy nhiều lần không gây lỗi (IF NOT EXISTS).
--   - Khóa ngoại booking_id trỏ về tour_bookings(id) ON DELETE CASCADE.
--   - Khóa ngoại actor_id trỏ về users(id) ON DELETE SET NULL.
--
-- HƯỚNG DẪN CHẠY:
--   - Chạy qua Docker container của dự án:
--       docker exec -i gis_db psql -U postgres -d gis_vietnam < db/migrations/002_phase2_booking_lifecycle.sql
--   - Hoặc chạy trực tiếp qua psql:
--       psql $DATABASE_URL -f db/migrations/002_phase2_booking_lifecycle.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. BẢNG booking_status_history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_status_history (
    id          BIGSERIAL PRIMARY KEY,
    booking_id  INTEGER NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. CÁC INDEX HỖ TRỢ TRUY VẤN TRA CỨU ───────────────────────────────────
CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx 
    ON booking_status_history(booking_id);

CREATE INDEX IF NOT EXISTS booking_status_history_created_at_idx 
    ON booking_status_history(created_at);

COMMIT;
