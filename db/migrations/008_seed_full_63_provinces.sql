-- Migration 008: Bổ sung và chuẩn hóa đủ 63 tỉnh/thành phố Việt Nam
-- Giải quyết vấn đề thiếu các tỉnh thành du lịch lớn (Kiên Giang, Quảng Nam, Bình Định, Bà Rịa - Vũng Tàu,...)
-- và gộp các polygon phụ trùng lặp từ OSM.

-- 1. Gộp các ID trùng lặp trong accommodation sang ID chính
UPDATE accommodation SET province_id = 3114 WHERE province_id = 3143; -- Đà Nẵng
UPDATE accommodation SET province_id = 2840 WHERE province_id = 2780; -- TP. Hồ Chí Minh
UPDATE accommodation SET province_id = 1323 WHERE province_id = 1320; -- Hải Phòng
UPDATE accommodation SET province_id = 3058 WHERE province_id = 3075; -- Thừa Thiên Huế
UPDATE accommodation SET province_id = 1702 WHERE province_id = 1704; -- An Giang
UPDATE accommodation SET province_id = 1901 WHERE province_id = 1924; -- Cà Mau
UPDATE accommodation SET province_id = 2031 WHERE province_id = 2240; -- Đồng Tháp
UPDATE accommodation SET province_id = 3377 WHERE province_id = 3369; -- Gia Lai
UPDATE accommodation SET province_id = 2268 WHERE province_id = 2405; -- Hà Tĩnh
UPDATE accommodation SET province_id = 1174 WHERE province_id = 1217; -- Hưng Yên
UPDATE accommodation SET province_id = 1638 WHERE province_id = 3309; -- Khánh Hòa
UPDATE accommodation SET province_id = 2927 WHERE province_id = 3446; -- Lâm Đồng
UPDATE accommodation SET province_id = 537  WHERE province_id = 541;  -- Nghệ An
UPDATE accommodation SET province_id = 866  WHERE province_id = 2448; -- Ninh Bình
UPDATE accommodation SET province_id = 3186 WHERE province_id = 3156; -- Quảng Ngãi
UPDATE accommodation SET province_id = 1334 WHERE province_id = 1338; -- Quảng Ninh
UPDATE accommodation SET province_id = 2486 WHERE province_id = 2502; -- Quảng Trị
UPDATE accommodation SET province_id = 483  WHERE province_id = 550;  -- Thanh Hóa
UPDATE accommodation SET province_id = 2094 WHERE province_id = 2125; -- Vĩnh Long
UPDATE accommodation SET province_id = 1936 WHERE province_id = 1947; -- Cần Thơ
UPDATE accommodation SET province_id = 3426 WHERE province_id = 3430; -- Đắk Lắk

-- Cập nhật tổng số lưu trú sau khi gộp cho các tỉnh chính
UPDATE province_stats SET so_luu_tru = (
    SELECT count(*) FROM accommodation a WHERE a.province_id = province_stats.id
) WHERE id IN (3114, 2840, 1323, 3058, 1702, 1901, 2031, 3377, 2268, 1174, 1638, 2927, 537, 866, 3186, 1334, 2486, 483, 2094, 1936, 3426);

-- 2. Xóa các bản ghi phụ bị trùng tên trong province_stats
DELETE FROM province_stats WHERE id IN (
    2780, 1320, 3143, 1217, 3309, 541, 3156, 1338, 2502, 550,
    1947, 1704, 1924, 2240, 2405, 2448, 3075, 3369, 3430, 3446, 2125
);

-- 3. Chuẩn hóa tên Đồng Nai (trong OSM cũ ghi nhầm Thành phố Đồng Nai)
UPDATE province_stats SET name = 'Tỉnh Đồng Nai' WHERE id = 2786;
UPDATE provinces_clean SET name = 'Tỉnh Đồng Nai' WHERE id = 2786;

-- 4. Bổ sung 29 tỉnh thành còn thiếu vào province_stats và provinces_clean
INSERT INTO province_stats (id, name, lon, lat, so_dia_diem, so_luu_tru)
VALUES
    (5001, 'Tỉnh Bà Rịa - Vũng Tàu', 107.17, 10.54, 0, 0),
    (5002, 'Tỉnh Bắc Giang', 106.19, 21.27, 0, 0),
    (5003, 'Tỉnh Bắc Kạn', 105.83, 22.15, 0, 0),
    (5004, 'Tỉnh Bạc Liêu', 105.72, 9.29, 0, 0),
    (5005, 'Tỉnh Bến Tre', 106.38, 10.24, 0, 0),
    (5006, 'Tỉnh Bình Định', 109.08, 14.17, 0, 0),
    (5007, 'Tỉnh Bình Dương', 106.65, 11.16, 0, 0),
    (5008, 'Tỉnh Bình Phước', 106.91, 11.75, 0, 0),
    (5009, 'Tỉnh Bình Thuận', 108.10, 11.10, 0, 0),
    (5010, 'Tỉnh Đắk Nông', 107.69, 12.00, 0, 0),
    (5011, 'Tỉnh Hà Giang', 104.98, 22.82, 0, 0),
    (5012, 'Tỉnh Hà Nam', 105.92, 20.54, 0, 0),
    (5013, 'Tỉnh Hải Dương', 106.32, 20.94, 0, 0),
    (5014, 'Tỉnh Hậu Giang', 105.47, 9.78, 0, 0),
    (5015, 'Tỉnh Hòa Bình', 105.34, 20.81, 0, 0),
    (5016, 'Tỉnh Kiên Giang', 105.08, 10.01, 0, 0),
    (5017, 'Tỉnh Kon Tum', 107.99, 14.35, 0, 0),
    (5018, 'Tỉnh Long An', 106.41, 10.53, 0, 0),
    (5019, 'Tỉnh Nam Định', 106.17, 20.43, 0, 0),
    (5020, 'Tỉnh Ninh Thuận', 108.99, 11.56, 0, 0),
    (5021, 'Tỉnh Phú Yên', 109.09, 13.09, 0, 0),
    (5022, 'Tỉnh Quảng Bình', 106.60, 17.47, 0, 0),
    (5023, 'Tỉnh Quảng Nam', 108.00, 15.57, 0, 0),
    (5024, 'Tỉnh Sóc Trăng', 105.97, 9.60, 0, 0),
    (5025, 'Tỉnh Thái Bình', 106.34, 20.45, 0, 0),
    (5026, 'Tỉnh Tiền Giang', 106.36, 10.36, 0, 0),
    (5027, 'Tỉnh Trà Vinh', 106.35, 9.93, 0, 0),
    (5028, 'Tỉnh Vĩnh Phúc', 105.60, 21.31, 0, 0),
    (5029, 'Tỉnh Yên Bái', 104.87, 21.72, 0, 0)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    lon = EXCLUDED.lon,
    lat = EXCLUDED.lat;

-- Đồng bộ sang provinces_clean
INSERT INTO provinces_clean (id, name, geom)
SELECT id, name, ST_SetSRID(ST_MakePoint(lon, lat), 4326)
FROM province_stats
WHERE id >= 5001 AND id <= 5029
ON CONFLICT DO NOTHING;
