-- Migration 009: Lưu trữ vĩnh viễn kết quả Serper Places & Maps API
-- Đảm bảo không gọi lại API bên ngoài đối với dữ liệu đã lấy, tiết kiệm quota và tăng tốc độ tối đa.

CREATE TABLE IF NOT EXISTS serper_places_cache (
    id SERIAL PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    api_type VARCHAR(50) NOT NULL, -- 'places' | 'maps' | 'search'
    query_text TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    radius_m INT,
    raw_response JSONB,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serper_places_cache_key ON serper_places_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_serper_places_cache_query ON serper_places_cache(query_text);

-- Kho lưu trữ vĩnh viễn từng địa điểm POI để truy xuất chi tiết mà không cần gọi lại
CREATE TABLE IF NOT EXISTS serper_places_store (
    id TEXT PRIMARY KEY, -- 'serper:...'
    cid VARCHAR(100),
    name TEXT NOT NULL,
    category TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    address TEXT,
    rating NUMERIC(3, 1),
    review_count INT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serper_places_store_cid ON serper_places_store(cid);
CREATE INDEX IF NOT EXISTS idx_serper_places_store_coords ON serper_places_store(lat, lon);
CREATE INDEX IF NOT EXISTS idx_serper_places_store_name ON serper_places_store(name);
