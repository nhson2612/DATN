import json
import random
import os
from app.db import execute_query
from app.gold_templates import get_gold_sql_and_params

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "benchmark_gsqa_auto.json")

AMENITY_MAP = {
    "cafe": ["quán cà phê", "quán cafe", "tiệm cà phê", "cửa hàng cafe"],
    "restaurant": ["nhà hàng", "quán ăn", "tiệm ăn"],
    "bar": ["quán bar", "quán rượu", "bar"],
    "fast_food": ["cửa hàng đồ ăn nhanh", "quán ăn nhanh", "tiệm ăn nhanh", "quán fast food"],
    "marketplace": ["chợ", "trung tâm thương mại", "khu mua sắm"],
    "ferry_terminal": ["bến phà", "bến tàu", "bến tàu thủy"],
    "community_centre": ["nhà văn hóa", "trung tâm cộng đồng", "nhà sinh hoạt cộng đồng"]
}

L0_QUESTIONS = [
    "Thời tiết ở Đà Nẵng ngày mai như thế nào?",
    "Giá vé cáp treo Bà Nà hiện tại là bao nhiêu?",
    "Quán cà phê Cộng ở đường Bạch Đằng giờ này có đông khách không?",
    "Cho tôi biết lịch trình xe buýt từ Đà Nẵng đi Hội An hôm nay.",
    "Bảo tàng Chăm mở cửa lúc mấy giờ?",
    "Lễ hội pháo hoa quốc tế Đà Nẵng diễn ra vào ngày nào năm nay?",
    "Khách sạn Mường Thanh có còn phòng trống vào tối nay không?",
    "Đường Bạch Đằng hiện tại có bị tắc đường không?",
    "Nhà hàng ẩm thực Trần có ngon không?",
    "Có sự kiện ca nhạc nào diễn ra ở Công viên Châu Á tối nay không?",
    "Giá phòng trung bình của homestay ở Sơn Trà năm 2026 là bao nhiêu?",
    "Tôi muốn đặt bàn trước cho 5 người ở nhà hàng chay Hoa Sen.",
    "Quán bar Golden Pine có quy định trang phục gì không?",
    "Tình trạng triều cường ở bãi biển Mỹ Khê hôm nay thế nào?",
    "Thông tin liên hệ số điện thoại của UBND thành phố Đà Nẵng là gì?"
]

def fetch_db_entities():
    """Fetches real spatial and attribute entities from the database deterministically."""
    print("Fetching unique entities in Da Nang bounding box...")
    
    # 1. Fetch unique level 6 boundaries (wards) in Da Nang
    wards = execute_query("""
        SELECT id, name
        FROM boundaries b
        WHERE admin_level = 6
          AND (SELECT count(*) FROM boundaries
               WHERE unaccent(lower(name)) = unaccent(lower(b.name))) = 1
          AND ST_Within(geom, ST_MakeEnvelope(107.95, 15.95, 108.35, 16.20, 4326))
        ORDER BY name;
    """)
    
    # 2. Fetch unique POIs (landmarks) in Da Nang BBox (no auto-generated names)
    pois = execute_query("""
        SELECT id, name, ST_X(geom) as lon, ST_Y(geom) as lat
        FROM poi p
        WHERE name IS NOT NULL
          AND name !~ '^(POI|Accommodation|Road) [0-9]+$'
          -- Phai chuan hoa: "name = p.name" phan biet dau VA phan biet dang
          -- Unicode, nen "Bánh mì" vs "Banh Mi" va NFD vs NFC deu lot qua ->
          -- sinh ra case thoai hoa (T021 co 4 POI khop, T078 co 2).
          AND (SELECT count(*) FROM poi
               WHERE unaccent(lower(name)) = unaccent(lower(p.name))) = 1
          -- Ten qua ngan thuong la danh tu chung ("Bánh mì"), khong phai dia danh
          AND length(p.name) >= 6
          AND ST_Within(geom, ST_MakeEnvelope(107.95, 15.95, 108.35, 16.20, 4326))
        ORDER BY name;
    """)
    
    return {
        "wards": wards,
        "pois": pois
    }

def run_gold_query(sql, params):
    try:
        return execute_query(sql, params) or []
    except Exception as e:
        print(f"Error executing gold query: {e}")
        return []

def try_generate_case(template_type, data):
    """
    Attempts to generate a single valid test case for a template.
    Returns case dict if valid and non-degenerate, else None.
    """
    # 1. intersects+count
    if template_type == "intersects+count":
        ward = random.choice(data["wards"])
        amenity = random.choice(list(AMENITY_MAP.keys()))
        amenity_vn = random.choice(AMENITY_MAP[amenity])
        
        sql, params = get_gold_sql_and_params("intersects+count", "poi", [amenity, ward["id"]])
        results = run_gold_query(sql, params)
        
        # Check non-degenerate threshold: count >= 3
        count = int(list(results[0].values())[0]) if results else 0
        if count < 3:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Easy",
            "question": f"Có bao nhiêu {amenity_vn} ở {ward['name']}?",
            "target": "poi",
            "answerable": True,
            "ref_entities": [{"table": "boundaries", "id": ward["id"], "name": ward["name"]}],
            "gold_ir": {
                "target": "poi",
                "aggregate": "count",
                "where": [
                    {"op": "eq", "col": "amenity", "value": amenity},
                    {"op": "in_admin", "name": ward["name"]}
                ]
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["total"],
            "ordered": False
        }

    # 2. intersects+name
    elif template_type == "intersects+name":
        ward = random.choice(data["wards"])
        amenity = random.choice(list(AMENITY_MAP.keys()))
        amenity_vn = random.choice(AMENITY_MAP[amenity])
        
        sql, params = get_gold_sql_and_params("intersects+name", "poi", [amenity, ward["id"]])
        results = run_gold_query(sql, params)
        
        # Check non-degenerate threshold: list >= 3
        if len(results) < 3:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Easy",
            "question": f"Liệt kê tất cả {amenity_vn} nằm ở {ward['name']}",
            "target": "poi",
            "answerable": True,
            "ref_entities": [{"table": "boundaries", "id": ward["id"], "name": ward["name"]}],
            "gold_ir": {
                "target": "poi",
                "select": ["name"],
                "where": [
                    {"op": "eq", "col": "amenity", "value": amenity},
                    {"op": "in_admin", "name": ward["name"]}
                ]
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": False
        }

    # 3. range+count
    elif template_type == "range+count":
        poi = random.choice(data["pois"])
        target = random.choice(["poi", "accommodation"])
        label = "địa điểm" if target == "poi" else "nơi lưu trú"
        meters = random.choice([500, 1000, 1500, 2000])
        
        sql, params = get_gold_sql_and_params("range+count", target, [poi["id"], float(meters)])
        results = run_gold_query(sql, params)
        
        count = int(list(results[0].values())[0]) if results else 0
        if count < 3:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Medium",
            "question": f"Có bao nhiêu {label} trong vòng {meters}m xung quanh {poi['name']}?",
            "target": target,
            "answerable": True,
            "ref_entities": [{"table": "poi", "id": poi["id"], "name": poi["name"]}],
            "gold_ir": {
                "target": target,
                "aggregate": "count",
                "where": [
                    {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
                ]
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["total"],
            "ordered": False
        }

    # 4. range+name
    elif template_type == "range+name":
        poi = random.choice(data["pois"])
        target = random.choice(["poi", "accommodation"])
        # Gold template khong he filter theo `tourism`, nen nhan phai trung tinh.
        # Ghi "khach san" se buoc agent them tourism='hotel' theo dung luat trong
        # prompt, roi bi gold phat — tuc phat dung hanh vi tuan chuan.
        label = "địa điểm" if target == "poi" else "nơi lưu trú"
        meters = random.choice([500, 1000, 1500, 2000])
        
        sql, params = get_gold_sql_and_params("range+name", target, [poi["id"], float(meters)])
        results = run_gold_query(sql, params)
        
        if len(results) < 3:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Medium",
            "question": f"Liệt kê tất cả {label} nằm trong bán kính {meters}m tính từ {poi['name']}",
            "target": target,
            "answerable": True,
            "ref_entities": [{"table": "poi", "id": poi["id"], "name": poi["name"]}],
            "gold_ir": {
                "target": target,
                "select": ["name"],
                "where": [
                    {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
                ]
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": False
        }

    # 5. knn+name
    elif template_type == "knn+name":
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.003, 0.003), 4)
        lat = round(poi["lat"] + random.uniform(-0.003, 0.003), 4)
        amenity = random.choice(list(AMENITY_MAP.keys()))
        amenity_vn = random.choice(AMENITY_MAP[amenity])
        
        sql, params = get_gold_sql_and_params("knn+name", "poi", [amenity, lon, lat, 1])
        results = run_gold_query(sql, params)
        
        if len(results) != 1:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Medium",
            # Khong hardcode "Quan " o dau: amenity_vn da chua san danh tu
            # ("cho", "ben tau", "nha van hoa"), ghep vao thanh "Quan cho".
            "question": f"{amenity_vn[0].upper()}{amenity_vn[1:]} nào nằm gần nhất với tọa độ {lon} {lat}?",
            "target": "poi",
            "answerable": True,
            "ref_entities": [],
            "gold_ir": {
                "target": "poi",
                "select": ["name"],
                "where": [
                    {"op": "eq", "col": "amenity", "value": amenity}
                ],
                "nearest_to": {"lon": lon, "lat": lat},
                "limit": 1
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": True
        }

    # 6. knn+distance
    elif template_type == "knn+distance":
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.003, 0.003), 4)
        lat = round(poi["lat"] + random.uniform(-0.003, 0.003), 4)
        
        sql, params = get_gold_sql_and_params("knn+distance", "accommodation", [lon, lat, 1])
        results = run_gold_query(sql, params)
        
        if len(results) != 1:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Hard",
            "question": f"Nơi lưu trú gần nhất với vị trí {lon} {lat} tên là gì?",
            "target": "accommodation",
            "answerable": True,
            "ref_entities": [],
            "gold_ir": {
                "target": "accommodation",
                "select": ["name"],
                "nearest_to": {"lon": lon, "lat": lat},
                "limit": 1
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": True
        }

    # 7. knn:non_spat_filter+name
    elif template_type == "knn:non_spat_filter+name":
        poi = random.choice(data["pois"])
        lon = round(poi["lon"] + random.uniform(-0.003, 0.003), 4)
        lat = round(poi["lat"] + random.uniform(-0.003, 0.003), 4)
        rating = random.choice([4.0, 4.2, 4.5])
        
        sql, params = get_gold_sql_and_params("knn:non_spat_filter+name", "accommodation", [float(rating), lon, lat, 1])
        results = run_gold_query(sql, params)
        
        if len(results) != 1:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Hard",
            "question": f"Nơi lưu trú có đánh giá từ {rating} trở lên nằm gần nhất với tọa độ {lon} {lat} tên là gì?",
            "target": "accommodation",
            "answerable": True,
            "ref_entities": [],
            "gold_ir": {
                "target": "accommodation",
                "select": ["name"],
                "where": [
                    {"op": "gte", "col": "rating", "value": rating}
                ],
                "nearest_to": {"lon": lon, "lat": lat},
                "limit": 1
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": True
        }

    # 8. range:non_spat_filter+name
    elif template_type == "range:non_spat_filter+name":
        poi = random.choice(data["pois"])
        price_level = random.choice(["Rẻ", "Trung bình", "Sang trọng"])
        price_vn = price_level.lower()
        meters = random.choice([1000, 2000])
        
        sql, params = get_gold_sql_and_params("range:non_spat_filter+name", "accommodation", [price_level, poi["id"], float(meters)])
        results = run_gold_query(sql, params)
        
        if len(results) < 3:
            return None
            
        return {
            "template": template_type,
            "difficulty": "Hard",
            # Gold filter la tourism IN ('guest_house','hostel'). "homestay" khong
            # co trong bang MAPPING cua prompt, nen dung dung tu vung anh xa duoc.
            "question": f"Liệt kê tất cả nhà khách hoặc nhà trọ giá {price_vn} cách {poi['name']} dưới {meters}m",
            "target": "accommodation",
            "answerable": True,
            "ref_entities": [{"table": "poi", "id": poi["id"], "name": poi["name"]}],
            "gold_ir": {
                "target": "accommodation",
                "select": ["name"],
                "where": [
                    {"op": "eq", "col": "price_level", "value": price_level},
                    {"op": "in", "col": "tourism", "value": ["guest_house", "hostel"]},
                    {"op": "within_distance", "meters": meters, "ref": {"table": "poi", "name": poi["name"]}}
                ]
            },
            "gold_sql": sql,
            "gold_params": params,
            "gold_results": results,
            "key_cols": ["name"],
            "ordered": False
        }

    return None

def generate_benchmark():
    random.seed(42)  # Secure deterministic generation
    data = fetch_db_entities()
    
    categories = [
        "intersects+count",
        "intersects+name",
        "range+count",
        "range+name",
        "knn+name",
        "knn+distance",
        "knn:non_spat_filter+name",
        "range:non_spat_filter+name"
    ]
    
    cases_by_category = {cat: [] for cat in categories}
    
    print("Generating non-degenerate test cases...")
    for cat in categories:
        attempts = 0
        while len(cases_by_category[cat]) < 17 and attempts < 1000:
            attempts += 1
            case = try_generate_case(cat, data)
            if case:
                cases_by_category[cat].append(case)
        print(f"Generated {len(cases_by_category[cat])} cases for {cat} in {attempts} attempts.")
        if len(cases_by_category[cat]) < 17:
            print(f"Warning: could only generate {len(cases_by_category[cat])} cases for {cat}.")

    # Generate unanswerable (L0) cases
    l0_cases = []
    for q in L0_QUESTIONS:
        l0_cases.append({
            "template": "unanswerable",
            "difficulty": "Hard",
            "question": q,
            "target": None,
            "answerable": False,
            "ref_entities": [],
            "gold_ir": {
                "target": None,
                "reason": "Không có dữ liệu trong DB để trả lời câu hỏi này."
            },
            "gold_sql": "SELECT NULL WHERE FALSE",
            "gold_params": [],
            "gold_results": [],
            "key_cols": [],
            "ordered": False
        })
    print(f"Generated {len(l0_cases)} unanswerable (L0) cases.")

    # Distribute splits: pool (11), dev (40), test (100)
    # pool: 1 from each category (8 total) + 3 from L0 = 11
    # dev:  4 from each category (32 total) + 8 from L0 = 40
    # test: remaining 12 from each category (96 total) + 4 from L0 = 100
    
    pool_cases = []
    dev_cases = []
    test_cases = []
    
    for cat in categories:
        cat_list = cases_by_category[cat]
        # Distribute
        pool_cases.extend(cat_list[0:1])
        dev_cases.extend(cat_list[1:5])
        test_cases.extend(cat_list[5:17])
        
    # 15 cau L0: 3 vao pool, 8 vao dev, 4 vao test. Truoc day code dung
    # L0_QUESTIONS[:14] nen am tham bo mat cau thu 15; gio dung ca 15 va don
    # cau du vao pool de kich thuoc tap test giu nguyen 100.
    pool_cases.extend(l0_cases[0:3])
    dev_cases.extend(l0_cases[3:11])
    test_cases.extend(l0_cases[11:15])
    
    # Set split label and unified ID
    qid = 1
    final_dataset = []
    
    for case in pool_cases:
        case["id"] = f"T{qid:03d}"
        case["split"] = "pool"
        final_dataset.append(case)
        qid += 1
        
    for case in dev_cases:
        case["id"] = f"T{qid:03d}"
        case["split"] = "dev"
        final_dataset.append(case)
        qid += 1
        
    for case in test_cases:
        case["id"] = f"T{qid:03d}"
        case["split"] = "test"
        final_dataset.append(case)
        qid += 1

    print(f"Total dataset size: {len(final_dataset)} cases.")
    print(f"Pool size: {len(pool_cases)}")
    print(f"Dev size: {len(dev_cases)}")
    print(f"Test size: {len(test_cases)}")

    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully generated new benchmark dataset at {OUTPUT_FILE}.")

if __name__ == "__main__":
    generate_benchmark()
