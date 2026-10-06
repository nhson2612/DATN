-- Hoàn thiện các tour cũ được tạo trước khi wizard yêu cầu đủ dữ liệu.
-- Chỉ ghi vào trường NULL/rỗng; không thay đổi nội dung người dùng đã nhập.

WITH source AS (
    SELECT * FROM tours WHERE slug = 'da-nang-3n2d' LIMIT 1
)
UPDATE tours AS target
SET province_id = COALESCE(target.province_id, source.province_id),
    description = COALESCE(NULLIF(BTRIM(target.description), ''), target.summary, source.description),
    cover_url = COALESCE(NULLIF(BTRIM(target.cover_url), ''), source.cover_url),
    images = CASE
        WHEN target.images IS NULL OR target.images = '[]'::jsonb THEN source.images
        ELSE target.images
    END,
    highlights = CASE
        WHEN target.highlights IS NULL OR target.highlights = '[]'::jsonb THEN source.highlights
        ELSE target.highlights
    END,
    itinerary = CASE
        WHEN target.itinerary IS NOT NULL AND target.itinerary <> '[]'::jsonb THEN target.itinerary
        WHEN target.duration_days = 2 THEN jsonb_build_array(source.itinerary->0, source.itinerary->1)
        ELSE source.itinerary
    END,
    included = CASE
        WHEN target.included IS NULL OR target.included = '[]'::jsonb THEN source.included
        ELSE target.included
    END,
    excluded = CASE
        WHEN target.excluded IS NULL OR target.excluded = '[]'::jsonb THEN source.excluded
        ELSE target.excluded
    END,
    cancellation_policy = CASE
        WHEN target.cancellation_policy IS NULL OR target.cancellation_policy = '[]'::jsonb
            THEN source.cancellation_policy
        ELSE target.cancellation_policy
    END
FROM source
WHERE target.slug IN ('tour-thu-nghiem', 'tour-bam-nut')
  AND (
      target.province_id IS NULL
      OR NULLIF(BTRIM(target.description), '') IS NULL
      OR NULLIF(BTRIM(target.cover_url), '') IS NULL
      OR target.images IS NULL OR target.images = '[]'::jsonb
      OR target.highlights IS NULL OR target.highlights = '[]'::jsonb
      OR target.itinerary IS NULL OR target.itinerary = '[]'::jsonb
      OR target.included IS NULL OR target.included = '[]'::jsonb
      OR target.excluded IS NULL OR target.excluded = '[]'::jsonb
      OR target.cancellation_policy IS NULL OR target.cancellation_policy = '[]'::jsonb
  );

-- Các tour khác chỉ còn thiếu dữ liệu dịch vụ hoặc giá; dùng bộ mặc định nhất quán.
WITH source AS (
    SELECT included, excluded, cancellation_policy
    FROM tours
    WHERE slug = 'da-nang-3n2d'
    LIMIT 1
)
UPDATE tours AS target
SET included = CASE
        WHEN target.included IS NULL OR target.included = '[]'::jsonb THEN source.included
        ELSE target.included
    END,
    excluded = CASE
        WHEN target.excluded IS NULL OR target.excluded = '[]'::jsonb THEN source.excluded
        ELSE target.excluded
    END,
    cancellation_policy = CASE
        WHEN target.cancellation_policy IS NULL OR target.cancellation_policy = '[]'::jsonb
            THEN source.cancellation_policy
        ELSE target.cancellation_policy
    END
FROM source
WHERE target.included IS NULL OR target.included = '[]'::jsonb
   OR target.excluded IS NULL OR target.excluded = '[]'::jsonb
   OR target.cancellation_policy IS NULL OR target.cancellation_policy = '[]'::jsonb;

UPDATE tours
SET price_from = 1500000
WHERE price_from IS NULL OR price_from <= 0;
