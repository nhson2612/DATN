-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 004_tour_included_excluded_array.sql
-- Mục đích: Chuyển tours.included / tours.excluded từ TEXT sang JSONB array
-- (list[str]) để khớp highlights, itinerary, cancellation_policy và giúp API
-- trả thẳng mảng, frontend render từng mục thay vì một chuỗi dài.
--
-- Chuyển dữ liệu cũ:
--   - NULL            -> []
--   - Nhiều mục tách bởi xuống dòng / dấu phẩy / chấm phẩy -> mảng từng mục
--   - Tiền tố "- " hoặc "• " (nếu có) được bỏ đi, trim khoảng trắng thừa.
--
-- Ghi chú kỹ thuật: Postgres không cho subquery trong ALTER ... USING nên
-- migration đi qua cột tạm (add -> update -> drop -> rename) trong 1 transaction.
--
-- Idempotent: chỉ convert khi cột còn kiểu text; phần SET DEFAULT/NOT NULL
-- chạy lại nhiều lần vẫn an toàn.
--
-- Chạy:
--   docker exec -i gis_db psql -U postgres -d gis_vietnam \
--     < db/migrations/004_tour_included_excluded_array.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tours'
          AND column_name = 'included'
          AND data_type IN ('text', 'character varying')
    ) THEN
        ALTER TABLE tours ADD COLUMN included_jsonb JSONB;

        UPDATE tours
        SET included_jsonb = COALESCE(
            (
                SELECT jsonb_agg(trim(regexp_replace(x, '^[-•]\s*', '', 'g')))
                FROM unnest(
                    regexp_split_to_array(NULLIF(included, ''), '[,;\n]+')
                ) AS x
                WHERE trim(regexp_replace(x, '^[-•]\s*', '', 'g')) <> ''
            ),
            '[]'::jsonb
        );

        ALTER TABLE tours DROP COLUMN included;
        ALTER TABLE tours RENAME COLUMN included_jsonb TO included;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tours'
          AND column_name = 'excluded'
          AND data_type IN ('text', 'character varying')
    ) THEN
        ALTER TABLE tours ADD COLUMN excluded_jsonb JSONB;

        UPDATE tours
        SET excluded_jsonb = COALESCE(
            (
                SELECT jsonb_agg(trim(regexp_replace(x, '^[-•]\s*', '', 'g')))
                FROM unnest(
                    regexp_split_to_array(NULLIF(excluded, ''), '[,;\n]+')
                ) AS x
                WHERE trim(regexp_replace(x, '^[-•]\s*', '', 'g')) <> ''
            ),
            '[]'::jsonb
        );

        ALTER TABLE tours DROP COLUMN excluded;
        ALTER TABLE tours RENAME COLUMN excluded_jsonb TO excluded;
    END IF;
END $$;

ALTER TABLE tours ALTER COLUMN included SET DEFAULT '[]'::jsonb;
ALTER TABLE tours ALTER COLUMN included SET NOT NULL;
ALTER TABLE tours ALTER COLUMN excluded SET DEFAULT '[]'::jsonb;
ALTER TABLE tours ALTER COLUMN excluded SET NOT NULL;

COMMIT;
