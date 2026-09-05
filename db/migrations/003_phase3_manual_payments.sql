-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 003_phase3_manual_payments.sql
-- Mục đích: Nâng cấp schema cho Phase 3-lite — Thanh toán thủ công / chuyển khoản
-- Bao gồm:
--   1. Tạo bảng `payments` lưu các giao dịch thanh toán (BR-P1..P5):
--      booking_id, method, amount, status, txn_ref, note, confirmed_by, confirmed_at.
--   2. Tạo index theo booking_id và status phục vụ truy vấn & đối soát.
--   3. Ràng buộc nghiệp vụ: Mỗi booking chỉ có tối đa một payment SUCCESS (BR-P1)
--      thông qua partial unique index: WHERE status = 'SUCCESS'.
--
-- RÀNG BUỘC VÀ TÍNH CHẤT:
--   - Idempotent: chạy nhiều lần không gây lỗi (IF NOT EXISTS).
--   - Khóa ngoại booking_id trỏ về tour_bookings(id) ON DELETE CASCADE.
--   - Khóa ngoại confirmed_by trỏ về users(id) ON DELETE SET NULL.
--   - KHÔNG chạy migration tự động lên DB thật; chỉ chạy khi có chỉ đạo qua psql/docker.
--
-- HƯỚNG DẪN CHẠY:
--   - Chạy qua Docker container của dự án:
--       docker exec -i gis_db psql -U postgres -d gis_vietnam < db/migrations/003_phase3_manual_payments.sql
--   - Hoặc chạy trực tiếp qua psql:
--       psql $DATABASE_URL -f db/migrations/003_phase3_manual_payments.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. BẢNG payments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id           BIGSERIAL PRIMARY KEY,
    booking_id   INTEGER NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
    method       VARCHAR(30) NOT NULL, -- CHUYEN_KHOAN | TAI_VAN_PHONG | KHAC
    amount       BIGINT NOT NULL,      -- Số tiền ghi nhận (VND)
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    txn_ref      VARCHAR(100) UNIQUE,  -- Mã giao dịch hệ thống sinh (PM-YYYYMMDD-NNNN)
    note         TEXT,
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'MISMATCH')),
    CHECK (amount >= 0)
);

-- ── 2. CÁC INDEX HỖ TRỢ TRUY VẤN TRA CỨU ───────────────────────────────────
CREATE INDEX IF NOT EXISTS payments_booking_id_idx 
    ON payments(booking_id);

CREATE INDEX IF NOT EXISTS payments_status_idx 
    ON payments(status);

-- ── 3. RÀNG BUỘC NGHIỆP VỤ BR-P1: MỖI BOOKING TỐI ĐA 1 PAYMENT SUCCESS ───────
-- Dùng partial unique index để cho phép nhiều payment PENDING / FAILED / MISMATCH
-- (khách thử thanh toán nhiều lần), nhưng chỉ duy nhất một payment được SUCCESS.
CREATE UNIQUE INDEX IF NOT EXISTS payments_booking_success_unique_idx
    ON payments(booking_id)
    WHERE status = 'SUCCESS';

COMMIT;
