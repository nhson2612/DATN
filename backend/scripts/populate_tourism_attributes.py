import sys
from pathlib import Path

# Cho phep import app.* khi chay script truc tiep
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings

import sys
import random
import psycopg

import os
import sys



DB_CONN = settings.database_url

def enrich_database():
    print("Connecting to PostgreSQL to add columns and enrich data...")
    try:
        with psycopg.connect(DB_CONN) as conn:
            with conn.cursor() as cur:
                # Add columns to poi table if they don't exist
                print("Checking and adding columns to 'poi' table...")
                cur.execute("""
                    ALTER TABLE poi ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 4.0;
                    ALTER TABLE poi ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 10;
                    ALTER TABLE poi ADD COLUMN IF NOT EXISTS price_level VARCHAR(20) DEFAULT 'Trung bình';
                    ALTER TABLE poi ADD COLUMN IF NOT EXISTS climate_label VARCHAR(50) DEFAULT 'Nhiệt đới';
                """)
                
                # Add columns to accommodation table if they don't exist
                print("Checking and adding columns to 'accommodation' table...")
                cur.execute("""
                    ALTER TABLE accommodation ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 4.0;
                    ALTER TABLE accommodation ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 15;
                    ALTER TABLE accommodation ADD COLUMN IF NOT EXISTS price_level VARCHAR(20) DEFAULT 'Trung bình';
                """)
                conn.commit()
                
                # Populate poi table with varied values
                print("Generating realistic ratings, reviews, and price levels for POIs...")
                cur.execute("SELECT id, name FROM poi;")
                pois = cur.fetchall()
                for poi_id, name in pois:
                    # Randomize rating between 3.5 and 5.0
                    rating = round(random.uniform(3.5, 5.0), 1)
                    # Randomize reviews count
                    reviews = random.randint(5, 500)
                    # Determine price level
                    price = random.choice(['Rẻ', 'Trung bình', 'Sang trọng'])
                    
                    # Set default climate label
                    climate = 'Nhiệt đới'
                    # Specific climate labels for high-altitude/forest areas
                    name_lower = name.lower()
                    if any(x in name_lower for x in ['bà nà', 'bà nà hills', 'bàn cờ', 'sơn trà', 'hải vân', 'suối', 'thác', 'rừng']):
                        climate = 'Mát mẻ'
                    elif any(x in name_lower for x in ['biển', 'bãi tắm', 'khánh mỹ', 'mỹ khê']):
                        climate = 'Nắng gió'
                        
                    cur.execute(
                        """
                        UPDATE poi 
                        SET rating = %s, review_count = %s, price_level = %s, climate_label = %s 
                        WHERE id = %s;
                        """,
                        (rating, reviews, price, climate, poi_id)
                    )
                
                # Populate accommodation table with varied values
                print("Generating realistic ratings, reviews, and price levels for accommodations...")
                cur.execute("SELECT id, name, tourism FROM accommodation;")
                accommodations = cur.fetchall()
                for acc_id, name, tourism in accommodations:
                    rating = round(random.uniform(3.0, 5.0), 1)
                    reviews = random.randint(10, 800)
                    
                    # Price level depending on accommodation type
                    if tourism == 'resort' or 'resort' in name.lower() or 'intercontinental' in name.lower():
                        price = 'Sang trọng'
                    elif tourism in ['guest_house', 'hostel', 'motel'] or 'homestay' in name.lower() or 'nhà nghỉ' in name.lower():
                        price = 'Rẻ'
                    else:
                        price = 'Trung bình'
                        
                    cur.execute(
                        """
                        UPDATE accommodation 
                        SET rating = %s, review_count = %s, price_level = %s 
                        WHERE id = %s;
                        """,
                        (rating, reviews, price, acc_id)
                    )
                
                conn.commit()
                print("Enrichment completed successfully!")
                
    except Exception as e:
        print(f"Error enriching database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    enrich_database()
