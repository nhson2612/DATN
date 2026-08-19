-- Enable PostGIS and pgRouting extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

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
