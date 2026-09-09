-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 006_phase3_stripe_payments.sql
-- Mục đích: Nâng cấp schema bảng `payments` phục vụ Phase 3 — Stripe Checkout
-- Bao gồm:
--   1. Thêm cột `stripe_session_id` lưu ID của Stripe Checkout Session.
--   2. Thêm cột `stripe_payment_intent_id` lưu Payment Intent từ Stripe.
--   3. Thêm cột `gateway_payload` lưu toàn bộ thông tin phản hồi từ webhook / gateway.
--   4. Thêm cột `needs_refund` đánh dấu các khoản thanh toán cần admin xử lý hoàn tiền
--      (ví dụ: A6/E3 - thanh toán về sau khi đơn đã hết hạn giữ chỗ).
--   5. Partial Unique Index trên `stripe_session_id` và index trên `stripe_payment_intent_id`.
--
-- RÀNG BUỘC VÀ TÍNH CHẤT:
--   - Idempotent: chạy nhiều lần không gây lỗi (IF NOT EXISTS).
--   - KHÔNG tự ý chạy migration lên CSDL thật trong quá trình kiểm thử.
--
-- HƯỚNG DẪN CHẠY:
--   - Chạy qua Docker container:
--       docker exec -i gis_db psql -U postgres -d gis_vietnam < db/migrations/006_phase3_stripe_payments.sql
--   - Hoặc chạy trực tiếp qua psql:
--       psql $DATABASE_URL -f db/migrations/006_phase3_stripe_payments.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payload JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS needs_refund BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_session_unique_idx
    ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_stripe_intent_idx
    ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;
