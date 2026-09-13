-- UC-AD02 — duyệt, từ chối tour.
-- Lý do từ chối phải lưu lại để nhà điều hành biết đường sửa rồi gửi lại (UC-T01/A2).
ALTER TABLE tours ADD COLUMN IF NOT EXISTS reject_reason TEXT;
