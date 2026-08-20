import json
import random
import os
from app.db import execute_query
from app.ir import compile_ir

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "benchmark_gsqa_auto.json")

def fetch_db_entities():
    """Fetches real spatial and attribute entities from the database to populate templates."""
    print("Fetching real Da Nang entities from database...")
    
    # 1. Fetch wards (boundaries)
    wards_res = execute_query("SELECT name FROM boundaries WHERE name LIKE '%Phường%' ORDER BY ST_Area(geom) DESC LIMIT 15;")
    wards = [r["name"] for r in wards_res] if wards_res else ["Phường Hải Châu I", "Phường Sơn Trà", "Phường Hòa Xuân", "Phường Ngũ Hành Sơn"]
    
    # 2. Fetch landmarks/POIs (points)
    poi_res = execute_query("SELECT name, ST_X(geom) as lon, ST_Y(geom) as lat FROM poi WHERE tourism = 'attraction' AND name IS NOT NULL LIMIT 15;")
    pois = []
    if poi_res:
        for r in poi_res:
            pois.append({"name": r["name"], "lon": round(r["lon"], 4), "lat": round(r["lat"], 4)})
    else:
        pois = [
            {"name": "Cầu Sông Hàn", "lon": 108.225, "lat": 16.072},
            {"name": "Cầu Rồng", "lon": 108.227, "lat": 16.061},
            {"name": "Cầu Trần Thị Lý", "lon": 108.228, "lat": 16.050},
            {"name": "Bãi biển Mỹ Khê", "lon": 108.248, "lat": 16.060}
        ]
        
    # 3. Fetch amenities (POI types)
    amenity_res = execute_query("SELECT DISTINCT amenity FROM poi WHERE amenity IS NOT NULL AND amenity != 'place_of_worship' LIMIT 10;")
    amenities = [r["amenity"] for r in amenity_res] if amenity_res else ["cafe", "restaurant", "bar", "fast_food"]
    
    # 4. Fetch stars and price levels for accommodations
    stars = [3, 4, 5]
    price_ranges = ["Rẻ", "Trung bình", "Sang trọng"]  # Capitalized to match DB price_level
    
    return {
        "wards": wards,
        "pois": pois,
        "amenities": amenities,
        "stars": stars,
        "price_ranges": price_ranges
    }

def get_gold_results(sql, params, aggregate):
    """Executes the gold SQL and returns standard target values (count or list of names)."""
    try:
        rows = execute_query(sql, params)
        if not rows:
            return 0 if aggregate == "count" else []
            
        if aggregate == "count":
            # Extract the first value of the first row
            return list(rows[0].values())[0]
        else:
            return [row["name"] for row in rows if "name" in row]
    except Exception as e:
        print(f"Error executing gold SQL: {e}")
        return 0 if aggregate == "count" else []

def generate_benchmark():
    data = fetch_db_entities()
    
    test_cases = []
    qid = 1
    
    raw_templates = []
    
    # Define templates and corresponding parameters
    # 1. intersects+count
    for _ in range(7):
        ward = random.choice(data["wards"])
        amenity = random.choice(data["amenities"])
        
        ir = {
            "target": "poi",
            "aggregate": "count",
            "where": [
                {"op": "eq", "col": "amenity", "value": amenity},
                {"op": "in_admin", "name": ward}
            ]
        }
        
        raw_templates.append({
            "template": "intersects+count",
            "question": f"Có bao nhiêu {amenity} ở {ward}?",
            "target": "poi",
            "difficulty": "Easy",
            "ir": ir
        })
        
    # 2. intersects+name
    for _ in range(7):
        ward = random.choice(data["wards"])
        amenity = random.choice(data["amenities"])
        
        ir = {
            "target": "poi",
            "select": ["name"],
            "where": [
                {"op": "eq", "col": "amenity", "value": amenity},
                {"op": "in_admin", "name": ward}
            ],
            "limit": 10
        }
        
        raw_templates.append({
            "template": "intersects+name",
            "question": f"Liệt kê danh sách các {amenity} nằm ở {ward}",
            "target": "poi",
            "difficulty": "Easy",
            "ir": ir
        })

    # 3. range+count
    for _ in range(7):
        poi = random.choice(data["pois"])
        meters = random.choice([500, 1000, 1500, 2000])
        target = random.choice(["poi", "accommodation"])
        label = "địa điểm" if target == "poi" else "nơi lưu trú"
        
        ir = {
            "target": target,
            "aggregate": "count",
            "where": [
                {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
            ]
        }
        
        raw_templates.append({
            "template": "range+count",
            "question": f"Có bao nhiêu {label} trong vòng {meters}m xung quanh {poi['name']}?",
            "target": target,
            "difficulty": "Medium",
            "ir": ir
        })

    # 4. range+name
    for _ in range(7):
        poi = random.choice(data["pois"])
        meters = random.choice([500, 1000, 1500, 2000])
        target = random.choice(["poi", "accommodation"])
        label = "địa điểm du lịch" if target == "poi" else "khách sạn"
        
        ir = {
            "target": target,
            "select": ["name"],
            "where": [
                {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
            ],
            "limit": 10
        }
        
        raw_templates.append({
            "template": "range+name",
            "question": f"Tìm các {label} nằm trong bán kính {meters}m tính từ {poi['name']}",
            "target": target,
            "difficulty": "Medium",
            "ir": ir
        })

    # 5. knn+name
    for _ in range(6):
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.005, 0.005), 4)
        lat = round(poi["lat"] + random.uniform(-0.005, 0.005), 4)
        amenity = random.choice(data["amenities"])
        
        ir = {
            "target": "poi",
            "select": ["name"],
            "where": [
                {"op": "eq", "col": "amenity", "value": amenity}
            ],
            "nearest_to": {"lon": lon, "lat": lat},
            "limit": 1
        }
        
        raw_templates.append({
            "template": "knn+name",
            "question": f"Quán {amenity} nào nằm gần nhất với tọa độ {lon} {lat}?",
            "target": "poi",
            "difficulty": "Medium",
            "ir": ir
        })

    # 6. knn+distance
    # Note: In our current ir.py compiler, nearest_to returns the actual records ordered by distance.
    # To answer "how far" (distance), we can select the record.
    for _ in range(6):
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.005, 0.005), 4)
        lat = round(poi["lat"] + random.uniform(-0.005, 0.005), 4)
        
        ir = {
            "target": "accommodation",
            "select": ["name"],
            "nearest_to": {"lon": lon, "lat": lat},
            "limit": 1
        }
        
        raw_templates.append({
            "template": "knn+distance",
            "question": f"Nơi lưu trú gần nhất với vị trí {lon} {lat} tên là gì?",
            "target": "accommodation",
            "difficulty": "Hard",
            "ir": ir
        })

    # 7. knn:non_spat_filter+name
    for _ in range(5):
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.005, 0.005), 4)
        lat = round(poi["lat"] + random.uniform(-0.005, 0.005), 4)
        star = random.choice(data["stars"])
        
        ir = {
            "target": "accommodation",
            "select": ["name"],
            "where": [
                {"op": "eq", "col": "stars", "value": star}
            ],
            "nearest_to": {"lon": lon, "lat": lat},
            "limit": 1
        }
        
        raw_templates.append({
            "template": "knn:non_spat_filter+name",
            "question": f"Khách sạn {star} sao nằm gần nhất với tọa độ {lon} {lat} tên là gì?",
            "target": "accommodation",
            "difficulty": "Hard",
            "ir": ir
        })

    # 8. range:non_spat_filter+name
    for _ in range(5):
        poi = random.choice(data["pois"])
        meters = random.choice([1000, 2000])
        price = random.choice(data["price_ranges"])
        
        ir = {
            "target": "accommodation",
            "select": ["name"],
            "where": [
                {"op": "eq", "col": "price_level", "value": price},
                {"op": "in", "col": "tourism", "value": ["guest_house", "hostel"]},
                {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
            ],
            "limit": 10
        }
        
        raw_templates.append({
            "template": "range:non_spat_filter+name",
            "question": f"Liệt kê các homestay giá {price} cách {poi['name']} dưới {meters}m",
            "target": "accommodation",
            "difficulty": "Hard",
            "ir": ir
        })

    # Process all cases, compiling SQL and fetching gold results
    print("Compiling gold SQL and running query references...")
    for t in raw_templates:
        try:
            sql, params = compile_ir(t["ir"])
            agg = t["ir"].get("aggregate")
            gold_res = get_gold_results(sql, params, agg)
            
            test_cases.append({
                "id": qid,
                "template": t["template"],
                "question": t["question"],
                "target": t["target"],
                "difficulty": t["difficulty"],
                "gold_ir": t["ir"],
                "gold_sql": sql,
                "gold_params": params,
                "gold_results": gold_res
            })
            qid += 1
        except Exception as e:
            print(f"Skipping template {t['template']} due to compilation failure: {e}")

    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(test_cases, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated {len(test_cases)} validated test cases with gold answers in {OUTPUT_FILE}.")

if __name__ == "__main__":
    generate_benchmark()
