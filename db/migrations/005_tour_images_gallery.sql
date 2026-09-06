-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 005_tour_images_gallery.sql
-- Mục đích: Thêm cột images (JSONB array các URL ảnh) cho bảng tours để hỗ trợ
-- gallery nhiều ảnh trên giao diện chi tiết tour (TourDetail).
-- Cột cover_url được giữ nguyên làm ảnh đại diện chính / fallback.
--
-- Đồng bộ dữ liệu cũ:
--   Nếu tour có cover_url và images đang rỗng ('[]'), khởi tạo images = jsonb_build_array(cover_url).
--
-- Idempotent: chạy lại nhiều lần không lỗi (ADD COLUMN IF NOT EXISTS).
--
-- Chạy:
--   docker exec -i gis_db psql -U postgres -d gis_vietnam \
--     < db/migrations/005_tour_images_gallery.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE tours ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';

-- Khởi tạo mảng images chứa cover_url cho các bản ghi đã có cover_url nhưng images đang rỗng
UPDATE tours
SET images = jsonb_build_array(cover_url)
WHERE (images IS NULL OR images = '[]'::jsonb)
  AND cover_url IS NOT NULL
  AND cover_url <> '';

COMMIT;
