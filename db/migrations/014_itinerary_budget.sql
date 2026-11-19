-- Migration 014: Thêm cột budget vào bảng itineraries để lưu ngân sách dự kiến của chuyến đi
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0;
