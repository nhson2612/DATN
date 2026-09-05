-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 001_p0_phase1_tour_sales.sql
-- Mục đích: Nâng cấp schema cho P0 + Phase 1 — Nghiệp vụ bán tour
-- Bao gồm:
--   1. Tạo bảng operators (nhà cung cấp tour).
--   2. Bổ sung operator_id, cancellation_policy, status cho tours.
--   3. Đổi price -> list_price; thêm sale_price, sale_starts_at, sale_ends_at,
--      status, min_pax và các CHECK constraints cho tour_departures.
--   4. Bổ sung code, hold_expires_at, seats_released, unit_list_price,
--      unit_sale_price và chuẩn hoá status cho tour_bookings.
--
-- HƯỚNG DẪN CHẠY:
--   - Chạy qua docker compose (khi cần áp dụng vào DB phát triển):
--       docker exec -i gis_db psql -U postgres -d gis_vietnam < db/migrations/001_p0_phase1_tour_sales.sql
--   - Hoặc chạy qua Makefile:
--       psql $DATABASE_URL -f db/migrations/001_p0_phase1_tour_sales.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. BẢNG operators ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name    VARCHAR(255) NOT NULL,
    tax_code        VARCHAR(50),
    commission_rate NUMERIC(4, 2) DEFAULT 0.10,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'))
);
CREATE INDEX IF NOT EXISTS operators_user_id_idx ON operators(user_id);


-- ── 2. NÂNG CẤP BẢNG tours ─────────────────────────────────────────────────
DO $$
BEGIN
    -- Thêm operator_id nếu chưa có
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tours' AND column_name = 'operator_id'
    ) THEN
        ALTER TABLE tours ADD COLUMN operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL;
    END IF;

    -- Thêm cancellation_policy (JSONB) nếu chưa có
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tours' AND column_name = 'cancellation_policy'
    ) THEN
        ALTER TABLE tours ADD COLUMN cancellation_policy JSONB;
    END IF;

    -- Thêm status nếu chưa có
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tours' AND column_name = 'status'
    ) THEN
        ALTER TABLE tours ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
        -- Đồng bộ trạng thái ban đầu dựa vào cờ active
        UPDATE tours SET status = CASE WHEN active = FALSE THEN 'INACTIVE' ELSE 'ACTIVE' END;
    END IF;
END $$;

-- Ràng buộc CHECK cho status của tours
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tours_status_check'
    ) THEN
        ALTER TABLE tours ADD CONSTRAINT tours_status_check
            CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS tours_status_idx ON tours(status);


-- ── 3. NÂNG CẤP BẢNG tour_departures ────────────────────────────────────────
DO $$
BEGIN
    -- Đổi tên cột price -> list_price nếu cột price đang tồn tại
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'price'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'list_price'
    ) THEN
        ALTER TABLE tour_departures RENAME COLUMN price TO list_price;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'list_price'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN list_price BIGINT NOT NULL DEFAULT 0;
    END IF;

    -- Thêm sale_price
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'sale_price'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN sale_price BIGINT;
    END IF;

    -- Thêm sale_starts_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'sale_starts_at'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN sale_starts_at TIMESTAMPTZ;
    END IF;

    -- Thêm sale_ends_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'sale_ends_at'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN sale_ends_at TIMESTAMPTZ;
    END IF;

    -- Thêm status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'status'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'OPEN';
    END IF;

    -- Thêm min_pax
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_departures' AND column_name = 'min_pax'
    ) THEN
        ALTER TABLE tour_departures ADD COLUMN min_pax INTEGER DEFAULT 1;
    END IF;
END $$;

-- Các CHECK constraints cho tour_departures
DO $$
BEGIN
    -- seats_left BETWEEN 0 AND seats_total
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_departures_seats_check'
    ) THEN
        ALTER TABLE tour_departures ADD CONSTRAINT tour_departures_seats_check
            CHECK (seats_left BETWEEN 0 AND seats_total);
    END IF;

    -- sale_price IS NULL OR (sale_price > 0 AND sale_price < list_price)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_departures_sale_price_check'
    ) THEN
        ALTER TABLE tour_departures ADD CONSTRAINT tour_departures_sale_price_check
            CHECK (sale_price IS NULL OR (sale_price > 0 AND sale_price < list_price));
    END IF;

    -- status hợp lệ
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_departures_status_check'
    ) THEN
        ALTER TABLE tour_departures ADD CONSTRAINT tour_departures_status_check
            CHECK (status IN ('OPEN', 'FULL', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS tour_departures_status_idx ON tour_departures(status);


-- ── 4. NÂNG CẤP BẢNG tour_bookings ──────────────────────────────────────────
DO $$
BEGIN
    -- Thêm code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_bookings' AND column_name = 'code'
    ) THEN
        ALTER TABLE tour_bookings ADD COLUMN code VARCHAR(50);
        -- Sinh mã cho các booking cũ nếu có
        UPDATE tour_bookings SET code = 'TB-' || id WHERE code IS NULL;
        ALTER TABLE tour_bookings ADD CONSTRAINT tour_bookings_code_unique UNIQUE (code);
    END IF;

    -- Thêm unit_list_price (snapshot giá gốc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_bookings' AND column_name = 'unit_list_price'
    ) THEN
        ALTER TABLE tour_bookings ADD COLUMN unit_list_price BIGINT;
    END IF;

    -- Thêm unit_sale_price (snapshot giá khuyến mãi)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_bookings' AND column_name = 'unit_sale_price'
    ) THEN
        ALTER TABLE tour_bookings ADD COLUMN unit_sale_price BIGINT;
    END IF;

    -- Thêm hold_expires_at (hạn giữ chỗ, mặc định 30 phút sau khi đặt)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_bookings' AND column_name = 'hold_expires_at'
    ) THEN
        ALTER TABLE tour_bookings ADD COLUMN hold_expires_at TIMESTAMPTZ;
    END IF;

    -- Thêm seats_released (cờ chống nhả chỗ 2 lần)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tour_bookings' AND column_name = 'seats_released'
    ) THEN
        ALTER TABLE tour_bookings ADD COLUMN seats_released BOOLEAN DEFAULT FALSE;
    END IF;

    -- Đổi kiểu và mapping status cũ sang status mới
    -- Cũ: moi | da_lien_he | da_coc | huy
    -- Mới: PENDING_PAYMENT | PAID | PARTIALLY_PAID | CONFIRMED | EXPIRED | CANCELLED_BY_CUSTOMER | CANCELLED_BY_OPERATOR | COMPLETED | REFUNDED | NO_SHOW
    ALTER TABLE tour_bookings ALTER COLUMN status TYPE VARCHAR(30);
    ALTER TABLE tour_bookings ALTER COLUMN status SET DEFAULT 'PENDING_PAYMENT';

    UPDATE tour_bookings SET status = 'PENDING_PAYMENT' WHERE status = 'moi';
    UPDATE tour_bookings SET status = 'CONFIRMED' WHERE status = 'da_lien_he';
    UPDATE tour_bookings SET status = 'PARTIALLY_PAID' WHERE status = 'da_coc';
    UPDATE tour_bookings SET status = 'CANCELLED_BY_CUSTOMER' WHERE status = 'huy';
END $$;

-- CHECK constraint cho status của tour_bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_bookings_status_check'
    ) THEN
        ALTER TABLE tour_bookings ADD CONSTRAINT tour_bookings_status_check
            CHECK (status IN (
                'PENDING_PAYMENT', 'PAID', 'PARTIALLY_PAID', 'CONFIRMED',
                'EXPIRED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_OPERATOR',
                'COMPLETED', 'REFUNDED', 'NO_SHOW'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS tour_bookings_code_idx ON tour_bookings(code);

COMMIT;
