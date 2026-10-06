-- Thông tin vận hành và phân loại tour do operator nhập khi tạo tour.
ALTER TABLE tours
    ADD COLUMN IF NOT EXISTS transportation JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS departure_location TEXT,
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Dữ liệu cũ vẫn phải có giá trị sử dụng được; không để tour tồn tại với mảng rỗng.
UPDATE tours
SET transportation = '["Xe du lịch"]'::jsonb
WHERE transportation IS NULL OR transportation = '[]'::jsonb;

UPDATE tours
SET departure_location = 'Theo điểm hẹn của nhà điều hành'
WHERE NULLIF(BTRIM(departure_location), '') IS NULL;

UPDATE tours
SET tags = jsonb_build_array(
    'Tour trọn gói',
    CASE
        WHEN duration_days > 1 THEN duration_days::text || 'N' || (duration_days - 1)::text || 'Đ'
        ELSE 'Trong ngày'
    END
)
WHERE tags IS NULL OR tags = '[]'::jsonb;

ALTER TABLE tours
    DROP CONSTRAINT IF EXISTS tours_transportation_array_check,
    ADD CONSTRAINT tours_transportation_array_check
        CHECK (jsonb_typeof(transportation) = 'array'),
    DROP CONSTRAINT IF EXISTS tours_tags_array_check,
    ADD CONSTRAINT tours_tags_array_check
        CHECK (jsonb_typeof(tags) = 'array');
