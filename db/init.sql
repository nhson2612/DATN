-- Enable PostGIS and pgRouting extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;
-- unaccent: BẮT BUỘC. app/ir.py dùng unaccent(lower(...)) cho mọi phép khớp tên
-- và so sánh text, nên thiếu extension này là toàn bộ agent IR vỡ. Trước đây
-- nó chỉ được thêm bằng tay trên DB đang chạy, volume mới sẽ không có.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Table for Administrative Boundaries (e.g., Districts, Wards of Da Nang)
CREATE TABLE IF NOT EXISTS boundaries (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE,
    name VARCHAR(255),
    admin_level INT,
    geom GEOMETRY(MultiPolygon, 4326)
);
CREATE INDEX IF NOT EXISTS boundaries_geom_idx ON boundaries USING GIST (geom);

-- 2. Table for Accommodations (Hotels, Homestays, Hostels, etc.)
CREATE TABLE IF NOT EXISTS accommodation (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE,
    name VARCHAR(255),
    amenity VARCHAR(100),
    tourism VARCHAR(100),
    price_range VARCHAR(100),
    stars INT,
    address TEXT,
    confidence REAL,                       -- xem ghi chu o bang poi
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS accommodation_geom_idx ON accommodation USING GIST (geom);

-- 3. Table for Points of Interest (POI - Restaurants, Attractions, Cafes, etc.)
CREATE TABLE IF NOT EXISTS poi (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE,
    name VARCHAR(255),
    amenity VARCHAR(100),
    tourism VARCHAR(100),
    description TEXT,
    -- Overture: diem 0..1 cho biet ho tin dia diem nay con ton tai den dau.
    -- 27% ban ghi o VN duoi 0,5 (thuong la page Facebook chua xac minh). Day la
    -- tin hieu duy nhat dung de xep hang va loc rac: `rating` va `review_count`
    -- trong CSDL nay deu chi co MOT gia tri, khong dung duoc.
    confidence REAL,
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS poi_geom_idx ON poi USING GIST (geom);
CREATE INDEX IF NOT EXISTS poi_confidence_idx ON poi(confidence);

-- 4. Table for Roads (Routing network)
CREATE TABLE IF NOT EXISTS roads (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name VARCHAR(255),
    highway VARCHAR(100),
    oneway VARCHAR(10),
    source INT,
    target INT,
    cost DOUBLE PRECISION,
    reverse_cost DOUBLE PRECISION,
    length DOUBLE PRECISION, -- length in meters
    geom GEOMETRY(LineString, 4326)
);
CREATE INDEX IF NOT EXISTS roads_geom_idx ON roads USING GIST (geom);

-- 5. Connected components của mạng đường, vật hoá.
-- main.py cần biết đỉnh nào thuộc component lớn để snap. Gọi
-- pgr_connectedComponents trực tiếp trong truy vấn là O(V+E) trên toàn graph,
-- 2 lần mỗi request /api/route. Bảng này được nạp bởi
-- backend/refresh_road_components.py và PHẢI làm mới sau mỗi lần `roads` đổi.
CREATE TABLE IF NOT EXISTS roads_components (
    node      BIGINT PRIMARY KEY,
    component BIGINT NOT NULL,
    comp_size INT    NOT NULL
);
CREATE INDEX IF NOT EXISTS roads_components_size_idx ON roads_components (comp_size);

-- Index biểu thức trên (geom::geography).
-- app/ir.py luôn sinh ::geography để khoảng cách tính bằng mét, nhưng index
-- gist(geom) là kiểu geometry nên cast làm MẤT index -> ST_DWithin và
-- near_point đều Seq Scan toàn bảng. Ở 3.274 dòng chênh 13ms vs 9.8ms nên
-- không ai thấy; ở quy mô lớn là O(n) vs index-bounded.
CREATE INDEX IF NOT EXISTS poi_geog_idx
    ON poi USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS accommodation_geog_idx
    ON accommodation USING GIST ((geom::geography));

-- ═══════════════════════════════════════════════════════════════════════════
-- Bảng ứng dụng
-- ═══════════════════════════════════════════════════════════════════════════
-- `users` và `itineraries` trước đây được tạo thủ công trên máy dev, không có
-- trong migration nào. Dựng CSDL mới từ file này là thiếu hai bảng, và
-- bootstrap.create_default_users báo lỗi "relation users does not exist" ngay
-- lúc khởi động.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'user',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itineraries (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    duration_days INTEGER DEFAULT 1,
    -- Ngày khởi hành thật, để hiện "Thứ 7, 12/09" thay vì "Ngày 1".
    start_date    DATE,
    -- Điểm đến chính, trước đây nhét vào description dạng "Điểm đến: X".
    destination   VARCHAR(255),
    -- Các mục người dùng tự tạo trong phần Tổng quan, dạng [{key, name}].
    -- Mặc định có sẵn "Địa điểm muốn đi"; người dùng thêm "Nhà hàng", "Cà phê"...
    sections      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Mảng {day, type, id} — chỉ tham chiếu, không lưu tên/toạ độ, để địa điểm
    -- đổi tên hay dời vị trí thì lịch trình cũ vẫn đúng. Chi tiết được tra lại
    -- lúc đọc (itinerary_service.hydrate_stops).
    stops         JSONB NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS itineraries_user_idx ON itineraries(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Nghiệp vụ du lịch
-- ═══════════════════════════════════════════════════════════════════════════

-- Ảnh lấy từ Wikimedia Commons, cache lại để không gọi API mỗi lần hiển thị.
-- `attribution` là bắt buộc: giấy phép Wikimedia yêu cầu ghi nguồn.
CREATE TABLE IF NOT EXISTS place_photos (
    id          SERIAL PRIMARY KEY,
    place_type  VARCHAR(20) NOT NULL,      -- 'poi' | 'accommodation'
    place_id    INTEGER NOT NULL,
    url         TEXT NOT NULL,
    attribution TEXT,
    details     JSONB,                     -- Cached metadata (rating, review count, open status, address)
    fetched_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (place_type, place_id)
);

CREATE TABLE IF NOT EXISTS favorites (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_type VARCHAR(20) NOT NULL,
    place_id   INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, place_type, place_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites(user_id);

-- Yêu cầu đặt chỗ. KHÔNG có thanh toán và KHÔNG có giá: CSDL không có dữ liệu
-- giá phòng hay tình trạng phòng trống, nên hệ thống chỉ nhận yêu cầu rồi để
-- admin liên hệ lại — đúng cách các website du lịch nhỏ ở Việt Nam đang làm.
CREATE TABLE IF NOT EXISTS booking_requests (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    place_type VARCHAR(20) NOT NULL,
    place_id   INTEGER NOT NULL,
    full_name  VARCHAR(255) NOT NULL,
    phone      VARCHAR(50)  NOT NULL,
    email      VARCHAR(255),
    check_in   DATE,
    check_out  DATE,
    guests     INTEGER DEFAULT 1,
    note       TEXT,
    status     VARCHAR(20) DEFAULT 'moi',   -- moi | da_lien_he | huy
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS booking_requests_status_idx ON booking_requests(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- Tour trọn gói
-- ═══════════════════════════════════════════════════════════════════════════
-- Hai kiểu đi du lịch khác hẳn nhau về nghiệp vụ:
--
--   1. ĐI THEO TOUR   — công ty soạn sẵn trọn gói: lịch trình, chỗ ở, giá, ngày
--                       khởi hành. Khách chỉ chọn và đặt. Giá ở đây là dữ liệu
--                       THẬT do admin nhập, khác `price_level` của POI vốn chỉ
--                       là giá trị mặc định.
--   2. ĐI TỰ TÚC      — khách tự tìm địa điểm, tự lập lịch trình (phần còn lại
--                       của hệ thống: /destinations, /places, /itineraries).

CREATE TABLE IF NOT EXISTS tours (
    id            SERIAL PRIMARY KEY,
    slug          VARCHAR(160) NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    summary       TEXT,                    -- mô tả ngắn hiện trên thẻ
    description   TEXT,
    province_id   INTEGER,                 -- điểm đến chính, trỏ tới provinces_clean
    duration_days INTEGER NOT NULL DEFAULT 1,
    price_from    BIGINT,                  -- VND, giá thấp nhất trong các ngày khởi hành
    cover_url     TEXT,
    highlights    JSONB,                   -- ["Bà Nà Hills", "Cầu Vàng", ...]
    -- [{day, title, description, place_ids: [int]}] — nối được sang bảng poi để
    -- vẽ lịch trình lên bản đồ.
    itinerary     JSONB,
    included      TEXT,                    -- giá đã bao gồm những gì
    excluded      TEXT,
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tours_province_idx ON tours(province_id);
CREATE INDEX IF NOT EXISTS tours_active_idx   ON tours(active);

-- Một tour chạy nhiều đợt, mỗi đợt giá và chỗ trống khác nhau.
CREATE TABLE IF NOT EXISTS tour_departures (
    id          SERIAL PRIMARY KEY,
    tour_id     INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    depart_date DATE NOT NULL,
    price       BIGINT,
    seats_total INTEGER DEFAULT 20,
    seats_left  INTEGER DEFAULT 20,
    UNIQUE (tour_id, depart_date)
);
CREATE INDEX IF NOT EXISTS tour_departures_date_idx ON tour_departures(depart_date);

CREATE TABLE IF NOT EXISTS tour_bookings (
    id           SERIAL PRIMARY KEY,
    tour_id      INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    departure_id INTEGER REFERENCES tour_departures(id) ON DELETE SET NULL,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name    VARCHAR(255) NOT NULL,
    phone        VARCHAR(50)  NOT NULL,
    email        VARCHAR(255),
    guests       INTEGER DEFAULT 1,
    note         TEXT,
    total_price  BIGINT,
    status       VARCHAR(20) DEFAULT 'moi',   -- moi | da_lien_he | da_coc | huy
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tour_bookings_status_idx ON tour_bookings(status);
