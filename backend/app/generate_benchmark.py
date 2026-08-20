import json
import random
import os
from app.db import execute_query

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
    amenity_res = execute_query("SELECT DISTINCT amenity FROM poi WHERE amenity IS NOT NULL LIMIT 10;")
    amenities = [r["amenity"] for r in amenity_res] if amenity_res else ["cafe", "restaurant", "bar", "fast_food"]
    
    # 4. Fetch stars and price levels for accommodations
    stars = [3, 4, 5]
    price_ranges = ["rẻ", "trung bình", "sang trọng"]
    
    return {
        "wards": wards,
        "pois": pois,
        "amenities": amenities,
        "stars": stars,
        "price_ranges": price_ranges
    }

def generate_benchmark():
    data = fetch_db_entities()
    
    test_cases = []
    qid = 1
    
    # Define templates and corresponding parameters
    # 1. intersects+count
    for _ in range(7):
        ward = random.choice(data["wards"])
        amenity = random.choice(data["amenities"])
        test_cases.append({
            "id": qid,
            "template": "intersects+count",
            "question": f"Có bao nhiêu {amenity} ở {ward}?",
            "target": "poi",
            "difficulty": "Easy"
        })
        qid += 1
        
    # 2. intersects+name
    for _ in range(7):
        ward = random.choice(data["wards"])
        amenity = random.choice(data["amenities"])
        test_cases.append({
            "id": qid,
            "template": "intersects+name",
            "question": f"Liệt kê danh sách các {amenity} nằm ở {ward}",
            "target": "poi",
            "difficulty": "Easy"
        })
        qid += 1

    # 3. range+count
    for _ in range(7):
        poi = random.choice(data["pois"])
        meters = random.choice([500, 1000, 1500, 2000])
        target = random.choice(["poi", "accommodation"])
        label = "địa điểm" if target == "poi" else "nơi lưu trú"
        test_cases.append({
            "id": qid,
            "template": "range+count",
            "question": f"Có bao nhiêu {label} trong vòng {meters}m xung quanh {poi['name']}?",
            "target": target,
            "difficulty": "Medium"
        })
        qid += 1

    # 4. range+name
    for _ in range(7):
        poi = random.choice(data["pois"])
        meters = random.choice([500, 1000, 1500, 2000])
        target = random.choice(["poi", "accommodation"])
        label = "địa điểm du lịch" if target == "poi" else "khách sạn"
        test_cases.append({
            "id": qid,
            "template": "range+name",
            "question": f"Tìm các {label} nằm trong bán kính {meters}m tính từ {poi['name']}",
            "target": target,
            "difficulty": "Medium"
        })
        qid += 1

    # 5. knn+name
    for _ in range(6):
        poi = random.choice(data["pois"])
        # Add random offset to simulate point query
        lon = round(poi["lon"] + random.uniform(-0.01, 0.01), 4)
        lat = round(poi["lat"] + random.uniform(-0.01, 0.01), 4)
        amenity = random.choice(data["amenities"])
        test_cases.append({
            "id": qid,
            "template": "knn+name",
            "question": f"Quán {amenity} nào nằm gần nhất với tọa độ {lon} {lat}?",
            "target": "poi",
            "difficulty": "Medium"
        })
        qid += 1

    # 6. knn+distance
    for _ in range(6):
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.01, 0.01), 4)
        lat = round(poi["lat"] + random.uniform(-0.01, 0.01), 4)
        test_cases.append({
            "id": qid,
            "template": "knn+distance",
            "question": f"Nơi lưu trú gần nhất với vị trí {lon} {lat} cách đó bao nhiêu mét?",
            "target": "accommodation",
            "difficulty": "Hard"
        })
        qid += 1

    # 7. knn:non_spat_filter+name
    for _ in range(5):
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.01, 0.01), 4)
        lat = round(poi["lat"] + random.uniform(-0.01, 0.01), 4)
        star = random.choice(data["stars"])
        test_cases.append({
            "id": qid,
            "template": "knn:non_spat_filter+name",
            "question": f"Khách sạn {star} sao nằm gần nhất với tọa độ {lon} {lat} tên là gì?",
            "target": "accommodation",
            "difficulty": "Hard"
        })
        qid += 1

    # 8. range:non_spat_filter+name
    for _ in range(5):
        poi = random.choice(data["pois"])
        meters = random.choice([1000, 2000])
        price = random.choice(data["price_ranges"])
        test_cases.append({
            "id": qid,
            "template": "range:non_spat_filter+name",
            "question": f"Liệt kê các homestay giá {price} cách {poi['name']} dưới {meters}m",
            "target": "accommodation",
            "difficulty": "Hard"
        })
        qid += 1

    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(test_cases, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated {len(test_cases)} test cases in {OUTPUT_FILE}.")

if __name__ == "__main__":
    generate_benchmark()
