import sys
from pathlib import Path

# Cho phep import app.* khi chay script truc tiep
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings

import sys
import time
import requests
import psycopg

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
    
    for attempt in range(4):
        for url in OVERPASS_MIRRORS:
            try:
                print(f"Trying Overpass mirror: {url} (Attempt {attempt+1})")
                response = requests.post(url, data={"data": query}, headers=headers, timeout=90)
                if response.status_code == 429:
                    print("Rate limit hit (429). Sleeping 20 seconds...")
                    time.sleep(20)
                    continue
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Mirror {url} failed: {e}")
                time.sleep(3)
        print("All mirrors failed for this attempt. Sleeping 30 seconds...")
        time.sleep(30)
    return None

def import_primary_roads():
    print("Connecting to PostgreSQL...")
    try:
        with psycopg.connect(DB_CONN) as conn:
            with conn.cursor() as cur:
                # Check if primary roads already exist (to avoid duplicates)
                cur.execute("SELECT count(*) FROM roads WHERE highway = 'primary';")
                count_exists = cur.fetchone()[0]
                if count_exists > 0:
                    print(f"Primary roads already exist in database ({count_exists} segments). Skipping import.")
                    return
                
                print("Fetching primary roads from Overpass...")
                query = """
                [out:json][timeout:180];
                area["name"="Thành phố Đà Nẵng"]->.a;
                (
                  way["highway"="primary"](area.a);
                );
                out geom;
                """
                data = run_query(query)
                if not data or "elements" not in data:
                    print("Failed to fetch primary roads.")
                    return
                
                count = 0
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
                print(f"Imported {count} primary road segments.")
                
                # Recalculate lengths and routing costs for all roads
                print("Calculating lengths and routing costs for all roads...")
                cur.execute("UPDATE roads SET length = ST_Length(geom::geography);")
                cur.execute("""
                    UPDATE roads 
                    SET cost = CASE WHEN oneway = '-1' THEN -1 ELSE length END,
                        reverse_cost = CASE WHEN oneway IN ('yes', '1', 'true') THEN -1 ELSE length END;
                """)
                conn.commit()
                
                # Rebuild pgRouting topology
                print("Rebuilding pgRouting topology...")
                # Truncate topology first to recreate it cleanly
                cur.execute("SELECT pgr_createTopology('roads', 0.00001, 'geom', 'id', 'true');")
                conn.commit()
                print("pgRouting topology built successfully!")
                
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import_primary_roads()
