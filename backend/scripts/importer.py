import sys
from pathlib import Path

# Cho phep import app.* khi chay script truc tiep
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings

import json
import sys
import time
import requests
import psycopg

# Database connection string
import os
import sys



DB_CONN = settings.database_url
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter"
]

def run_query(query):
    print("Executing Overpass query...")
    headers = {
        "User-Agent": "TourismGISApp/1.0 (nhson2612@gmail.com)",
        "Referer": "https://github.com/nhson2612/datn"
    }
    
    for attempt in range(3):
        for url in OVERPASS_MIRRORS:
            try:
                print(f"Trying Overpass mirror: {url} (Attempt {attempt+1})")
                response = requests.post(url, data={"data": query}, headers=headers, timeout=90)
                if response.status_code == 429:
                    print("Rate limit hit (429). Sleeping 10 seconds before trying next mirror...")
                    time.sleep(10)
                    continue
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Mirror {url} failed: {e}")
                time.sleep(2)
        print("All mirrors failed for this attempt. Sleeping 15 seconds...")
        time.sleep(15)
    return None

# ---- Danh sach loai dia diem PHUC VU DU LICH ----
# Khong liet ke tuy tien 9 dong nhu ban cu (bo mat karaoke, bai bien, chua...),
# cung khong lay sach moi thu OSM co (keo theo ghe da, truong hoc, tiem giat la,
# van phong cong ty — rac voi ung dung du lich). Whitelist theo 6 nhom nhu cau
# that cua khach du lich.
TOURIST_TAGS = {
    # 1. Cho o
    "tourism": ["hotel", "guest_house", "hostel", "motel", "resort", "apartment",
                "chalet", "camp_site", "caravan_site",
                # 3. Diem tham quan
                "attraction", "viewpoint", "museum", "theme_park", "gallery",
                "artwork", "zoo", "aquarium", "picnic_site", "information"],
    # 2. An uong  +  4. Vui choi  +  5. Di lai  +  6. Mua sam
    "amenity": ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court",
                "ice_cream", "biergarten",
                "karaoke_box", "nightclub", "cinema", "theatre", "casino",
                "place_of_worship", "marketplace", "fountain",
                "bus_station", "ferry_terminal", "taxi", "car_rental",
                "bicycle_rental", "motorcycle_rental", "fuel", "parking"],
    "leisure": ["beach_resort", "water_park", "swimming_pool", "park", "garden",
                "nature_reserve", "marina", "sports_centre", "fitness_centre",
                "amusement_arcade", "escape_game", "bowling_alley", "golf_course"],
    "shop": ["mall", "department_store", "supermarket", "gift", "souvenir",
             "convenience", "travel_agency", "art", "craft", "antiques",
             "jewelry", "clothes", "bakery", "confectionery", "greengrocer"],
    "historic": ["monument", "memorial", "ruins", "castle", "archaeological_site",
                 "city_gate", "fort", "tomb", "wayside_shrine"],
    "natural": ["beach", "peak", "cave_entrance", "waterfall", "hot_spring",
                "spring", "bay", "cliff", "volcano"],
    "aeroway": ["aerodrome", "terminal"],
    "railway": ["station", "halt"],
}


def _tourist_query(bbox):
    """Sinh Overpass QL cho mot bbox: chi cac loai trong TOURIST_TAGS.

    Dung `nwr` chu khong phai `node`: OSM ve khach san lon, cong vien, bai bien
    thanh way/relation, ban cu chi lay `node` nen mat sach nhung cai do.
    `out center tags` tra ve mot diem dai dien cho way/relation.
    """
    parts = []
    for key, vals in TOURIST_TAGS.items():
        rx = "|".join(vals)
        parts.append(f'  nwr["{key}"~"^({rx})$"]({bbox});')
    body = "\n".join(parts)
    return f"[out:json][timeout:240];\n(\n{body}\n);\nout center tags;"


def import_boundaries(conn):
    print("Fetching boundaries for Da Nang...")
    query = """
    [out:json];
    area["name"="Thành phố Đà Nẵng"]->.a;
    (
      relation["admin_level"="4"](area.a);
      relation["admin_level"="6"](area.a);
    );
    out geom;
    """
    data = run_query(query)
    if not data or "elements" not in data:
        print("No boundary data found.")
        return

    with conn.cursor() as cur:
        count = 0
        for elem in data["elements"]:
            if elem["type"] == "relation":
                osm_id = elem["id"]
                name = elem.get("tags", {}).get("name", f"District {osm_id}")
                admin_level = int(elem.get("tags", {}).get("admin_level", 6))
                
                # Stitch relation ways to create a simple polygon
                # For simplicity, we can extract the outline points from members and form a polygon.
                # If there are multiple ways, we can aggregate their coords.
                coords = []
                for member in elem.get("members", []):
                    if member["type"] == "way" and "geometry" in member:
                        # Extract coordinates
                        way_coords = [(pt["lon"], pt["lat"]) for pt in member["geometry"]]
                        coords.extend(way_coords)
                
                if len(coords) < 4:
                    continue
                
                # Close the polygon if not closed
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                
                # Construct WKT Polygon
                wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in coords])
                wkt = f"MULTIPOLYGON((({wkt_coords})))"
                
                try:
                    cur.execute(
                        """
                        INSERT INTO boundaries (osm_id, name, admin_level, geom)
                        VALUES (%s, %s, %s, ST_GeomFromText(%s, 4326))
                        ON CONFLICT (osm_id) DO UPDATE 
                        SET name = EXCLUDED.name, admin_level = EXCLUDED.admin_level, geom = EXCLUDED.geom;
                        """,
                        (osm_id, name, admin_level, wkt)
                    )
                    count += 1
                except Exception as e:
                    # Ignore geometry stitching errors if polygon is invalid
                    conn.rollback()
                    continue
        conn.commit()
        print(f"Imported {count} boundaries.")

def import_accommodations(conn):
    print("Fetching accommodations...")
    query = """
    [out:json];
    area["name"="Thành phố Đà Nẵng"]->.a;
    (
      node["tourism"="hotel"](area.a);
      node["tourism"="guest_house"](area.a);
      node["tourism"="hostel"](area.a);
      node["tourism"="motel"](area.a);
      node["tourism"="resort"](area.a);
      node["tourism"="apartment"](area.a);
    );
    out body;
    """
    data = run_query(query)
    if not data or "elements" not in data:
        print("No accommodation data found.")
        return

    with conn.cursor() as cur:
        count = 0
        for elem in data["elements"]:
            if elem["type"] == "node":
                osm_id = elem["id"]
                lat = elem["lat"]
                lon = elem["lon"]
                tags = elem.get("tags", {})
                name = tags.get("name", f"Accommodation {osm_id}")
                amenity = tags.get("amenity")
                tourism = tags.get("tourism")
                price_range = tags.get("price_range")
                stars_str = tags.get("stars", "0")
                try:
                    stars = int("".join(filter(str.isdigit, stars_str)))
                except ValueError:
                    stars = 0
                address = tags.get("addr:full") or tags.get("addr:street", "")
                
                cur.execute(
                    """
                    INSERT INTO accommodation (osm_id, name, amenity, tourism, price_range, stars, address, tags, geom)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                    ON CONFLICT (osm_id) DO UPDATE
                    SET name = EXCLUDED.name, amenity = EXCLUDED.amenity, tourism = EXCLUDED.tourism, 
                        price_range = EXCLUDED.price_range, stars = EXCLUDED.stars, address = EXCLUDED.address,
                        tags = EXCLUDED.tags, geom = EXCLUDED.geom;
                    """,
                    (osm_id, name, amenity, tourism, price_range, stars, address,
                     json.dumps(tags, ensure_ascii=False), lon, lat)
                )
                count += 1
        conn.commit()
        print(f"Imported {count} accommodations.")

def import_pois(conn):
    print("Fetching POIs...")
    # KHONG liet ke tung loai. Danh sach cu chi co 9 dong nen moi thu ngoai do
    # bien mat khoi DB: do trong bbox trung tam Da Nang, OSM co 150 loai khac
    # nhau (amenity/leisure/shop) trong khi DB chi giu 6. karaoke_box, pharmacy,
    # atm, bank, convenience, massage, hairdresser... deu bi vut. Hau qua: hoi
    # "quan karaoke" thi LLM khong co gia tri hop le nao de dung, no bia ra mot
    # cai roi truy van tra 0 dong — that bai im lang, va moi lan them mot loai
    # lai phai sua 4 cho (query, cot DB, BANG MAPPING, prompt).
    query = """
    [out:json][timeout:180];
    area["name"="Thành phố Đà Nẵng"]->.a;
    (
      node["amenity"](area.a);
      node["tourism"](area.a);
      node["leisure"](area.a);
      node["shop"](area.a);
    );
    out body;
    """
    data = run_query(query)
    if not data or "elements" not in data:
        print("No POI data found.")
        return

    with conn.cursor() as cur:
        count = 0
        for elem in data["elements"]:
            if elem["type"] == "node":
                osm_id = elem["id"]
                lat = elem["lat"]
                lon = elem["lon"]
                tags = elem.get("tags", {})
                name = tags.get("name", f"POI {osm_id}")
                # shop/leisure khong co cot rieng. Do vao `amenity` de van loc
                # duoc bang mot cot duy nhat — gia tri goc luon con nguyen trong
                # `tags` neu can phan biet nguon.
                amenity = (tags.get("amenity") or tags.get("shop")
                           or tags.get("leisure"))
                tourism = tags.get("tourism")
                description = tags.get("description") or tags.get("cuisine", "")
                # Giu NGUYEN toan bo tag OSM vao cot jsonb `tags`.
                # Truoc day chi 4 khoa duoc doc (name/amenity/tourism/cuisine) roi
                # bo ca dict, nen moi lan can them mot thuoc tinh — mon an, gio mo
                # cua, so nha, so dien thoai, thuong hieu — lai phai them mot cot
                # moi hoac di duong vong (LIKE tren `name`). Luu het mot lan thi
                # truy van bang tags->>'cuisine', tags->>'addr:street', ... ma
                # khong phai doi schema nua.
                cur.execute(
                    """
                    INSERT INTO poi (osm_id, name, amenity, tourism, description, tags, geom)
                    VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                    ON CONFLICT (osm_id) DO UPDATE
                    SET name = EXCLUDED.name, amenity = EXCLUDED.amenity, tourism = EXCLUDED.tourism, 
                        description = EXCLUDED.description, tags = EXCLUDED.tags,
                        geom = EXCLUDED.geom;
                    """,
                    (osm_id, name, amenity, tourism, description,
                     json.dumps(tags, ensure_ascii=False), lon, lat)
                )
                count += 1
        conn.commit()
        print(f"Imported {count} POIs.")

def import_roads(conn):
    print("Fetching major roads...")
    highway_types = ["motorway", "trunk", "primary", "secondary", "tertiary"]
    
    with conn.cursor() as cur:
        # Clear previous roads to build topology from scratch
        cur.execute("TRUNCATE TABLE roads RESTART IDENTITY CASCADE;")
        conn.commit()
        
        count = 0
        for hw_type in highway_types:
            print(f"Fetching {hw_type} roads...")
            query = f"""
            [out:json][timeout:180];
            area["name"="Thành phố Đà Nẵng"]->.a;
            (
              way["highway"="{hw_type}"](area.a);
            );
            out geom;
            """
            data = run_query(query)
            if not data or "elements" not in data:
                print(f"No {hw_type} road data found or query failed.")
                continue
                
            for elem in data["elements"]:
                if elem["type"] == "way" and "geometry" in elem:
                    osm_id = elem["id"]
                    tags = elem.get("tags", {})
                    name = tags.get("name", f"Road {osm_id}")
                    highway = tags.get("highway")
                    oneway = tags.get("oneway", "no")
                    
                    # Build WKT LineString
                    coords = [(pt["lon"], pt["lat"]) for pt in elem["geometry"]]
                    if len(coords) < 2:
                        continue
                    
                    wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in coords])
                    wkt = f"LINESTRING({wkt_coords})"
                    
                    cur.execute(
                        """
                        INSERT INTO roads (osm_id, name, highway, oneway, geom)
                        VALUES (%s, %s, %s, %s, ST_GeomFromText(%s, 4326));
                        """,
                        (osm_id, name, highway, oneway, wkt)
                    )
                    count += 1
            conn.commit()
            print(f"Imported {count} road segments so far.")
            time.sleep(1)
            
        if count == 0:
            print("No roads were imported. Cannot build topology.")
            return

        # Calculate lengths and routing costs
        print("Calculating lengths and routing costs...")
        cur.execute("UPDATE roads SET length = ST_Length(geom::geography);")
        cur.execute("""
            UPDATE roads 
            SET cost = CASE WHEN oneway = '-1' THEN -1 ELSE length END,
                reverse_cost = CASE WHEN oneway IN ('yes', '1', 'true') THEN -1 ELSE length END;
        """)
        conn.commit()
        
        # Build pgRouting topology
        print("Building pgRouting topology (this might take a few moments)...")
        cur.execute("SELECT pgr_createTopology('roads', 0.00001, 'geom', 'id');")
        conn.commit()
        print("pgRouting topology built successfully!")

def main():
    start_time = time.time()
    print("Connecting to PostgreSQL...")
    try:
        with psycopg.connect(DB_CONN) as conn:
            import_accommodations(conn)
            import_pois(conn)
            import_roads(conn)
            import_boundaries(conn)
        print(f"All data imported successfully in {time.time() - start_time:.2f} seconds!")
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
