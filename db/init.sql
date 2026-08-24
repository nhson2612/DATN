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
    geom GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS poi_geom_idx ON poi USING GIST (geom);

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
