import re
from app.db import execute_query
from app.core.config import settings
from app.llm_adapter import query_llm

SYSTEM_PROMPT = """You are an expert PostGIS and Spatial SQL generator for a Vietnam tourism database.
Your task is to generate PostgreSQL + PostGIS SQL queries to answer natural language questions about tourism in Da Nang.

DATABASE SCHEMA:
1. `boundaries` (District/administrative boundaries)
   - `id` (SERIAL PRIMARY KEY)
   - `name` (VARCHAR, name of the district/boundary, e.g. 'Hải Châu', 'Sơn Trà')
   - `admin_level` (INT, 4 = city boundary, 6 = district boundary)
   - `geom` (GEOMETRY(MultiPolygon, 4326)) - EPSG:4326 (coordinates in degrees)

2. `accommodation` (Hotels, Homestays, Guest houses, Resorts)
   - `id` (SERIAL PRIMARY KEY)
   - `name` (VARCHAR, name of the place)
   - `amenity` (VARCHAR, e.g. 'hotel', 'resort')
   - `tourism` (VARCHAR, e.g. 'hotel', 'guest_house', 'hostel')
   - `price_range` (VARCHAR)
   - `stars` (INT, 0 to 5)
   - `address` (TEXT)
   - `rating` (NUMERIC(3,1), rating from 1.0 to 5.0, e.g. 4.5)
   - `review_count` (INT, number of reviews, e.g. 150)
   - `price_level` (VARCHAR, values: 'Rẻ', 'Trung bình', 'Sang trọng')
   - `geom` (GEOMETRY(Point, 4326))

3. `poi` (Points of Interest - Restaurants, Cafes, Attractions, Viewpoints)
   - `id` (SERIAL PRIMARY KEY)
   - `name` (VARCHAR)
   - `amenity` (VARCHAR, e.g. 'restaurant', 'cafe', 'bar')
   - `tourism` (VARCHAR, e.g. 'attraction', 'viewpoint', 'museum')
   - `description` (TEXT, contains details or cuisine type)
   - `rating` (NUMERIC(3,1), rating from 1.0 to 5.0, e.g. 4.7)
   - `review_count` (INT, number of reviews, e.g. 240)
   - `price_level` (VARCHAR, values: 'Rẻ', 'Trung bình', 'Sang trọng')
   - `climate_label` (VARCHAR, values: 'Mát mẻ', 'Nắng gió', 'Nhiệt đới') - used for questions about climate/cool places!
   - `geom` (GEOMETRY(Point, 4326))

4. `roads` (Road network for routing)
   - `id` (SERIAL PRIMARY KEY)
   - `name` (VARCHAR, street name)
   - `highway` (VARCHAR, e.g. 'primary', 'secondary', 'tertiary')
   - `oneway` (VARCHAR, 'yes', 'no')
   - `source` (INT, source node ID for pgRouting)
   - `target` (INT, target node ID for pgRouting)
   - `cost` (DOUBLE PRECISION, travel cost/length in meters)
   - `reverse_cost` (DOUBLE PRECISION, reverse travel cost in meters)
   - `length` (DOUBLE PRECISION, length in meters)
   - `geom` (GEOMETRY(LineString, 4326))

5. `roads_vertices_pgr` (Nodes in the road network)
   - `id` (INT)
   - `the_geom` (GEOMETRY(Point, 4326))

CRITICAL RULES:
1. DO NOT create tables like `hotel`, `homestay`, `restaurant`, `cafe`, `street`. These tables DO NOT exist! 
   - All hotels/homestays are in the `accommodation` table.
   - All restaurants, cafes, attractions, viewpoints, beaches are in the `poi` table.
   - All streets are in the `roads` table.
2. DONT USE raw ST_Distance(geom_a, geom_b) < X or ST_DWithin(geom_a, geom_b, X) where X is in meters if the geometry is EPSG:4326. EPSG:4326 is in DEGREES!
   - To query in METERS, ALWAYS cast geometries to geography: `ST_DWithin(geom_a::geography, geom_b::geography, X)` or use `ST_Transform(geom_a, 3406)` (3406 is VN-2000 UTM Zone 49N for Da Nang, in meters).
   - E.g. "within 500m of a beach": `ST_DWithin(a.geom::geography, b.geom::geography, 500)`
3. To query about "khí hậu mát mẻ", "địa điểm mát nhất", or "nơi mát mẻ", filter `climate_label = 'Mát mẻ'` on the `poi` table.
4. To query about "giá rẻ", filter `price_level = 'Rẻ'`. For "sang trọng" or "xa hoa", filter `price_level = 'Sang trọng'`.
5. To query about "đánh giá tốt", "rating cao", or "nổi tiếng", ORDER BY rating DESC, review_count DESC or filter rating >= 4.5.
6. To return geometry in JSON format for the map, wrap in `ST_AsGeoJSON(geom)`.

FEW-SHOT EXAMPLES:
Example 1: Tìm các địa điểm du lịch mát mẻ ở Đà Nẵng
SQL: SELECT name, rating, climate_label, ST_AsGeoJSON(geom) as geom FROM poi WHERE climate_label = 'Mát mẻ';

Example 2: Tìm quán cafe giá rẻ có đánh giá tốt (từ 4.5 sao trở lên)
SQL: SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom FROM poi WHERE amenity = 'cafe' AND price_level = 'Rẻ' AND rating >= 4.5;

Example 3: Tìm homestay ở quận Sơn Trà được đánh giá cao nhất
SQL: SELECT name, address, rating, ST_AsGeoJSON(geom) as geom FROM accommodation WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom) ORDER BY rating DESC LIMIT 10;

Example 4: Tìm khách sạn 3 sao cách biển dưới 500m
SQL: SELECT name, stars, address, ST_AsGeoJSON(geom) as geom FROM accommodation WHERE tourism = 'hotel' AND stars = 3 AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%biển%' OR tourism = 'beach' OR amenity = 'beach'), 500);

OUTPUT FORMAT:
- Return ONLY the raw SQL query.
- Do NOT wrap it in ```sql ... ``` code block formatting.
- Do NOT write any introduction or explanation. Only the SQL string.
"""

def query_ollama(prompt, system_prompt=None):
    return query_llm(prompt, system_prompt, timeout=settings.llm_timeout_explain)

def crs_guard(sql):
    """
    Scans the SQL query and automatically fixes common CRS errors:
    1. ST_Distance(a, b) < 500 -> ST_DWithin(a::geography, b::geography, 500)
    2. ST_DWithin(a, b, 500) -> ST_DWithin(a::geography, b::geography, 500)
    Ensures calculations are done in meters, not degrees!
    """
    original = sql
    
    # 1. Fix raw ST_Distance comparisons with numbers > 1
    # ST_Distance(a.geom, b.geom) < 500 -> ST_DWithin(a.geom::geography, b.geom::geography, 500)
    distance_pattern = r"ST_Distance\(([^,]+),\s*([^)]+)\)\s*([<>=]+)\s*(\d+(?:\.\d+)?)"
    def replace_distance(match):
        geom1 = match.group(1).strip()
        geom2 = match.group(2).strip()
        op = match.group(3).strip()
        val = float(match.group(4))
        
        # If the distance value is large (e.g. > 1), it's likely meant to be meters
        if val > 1.0 and op in ["<", "<="]:
            # Convert geom to geography if not already casted
            g1 = geom1 if "geography" in geom1 else f"{geom1}::geography"
            g2 = geom2 if "geography" in geom2 else f"{geom2}::geography"
            return f"ST_DWithin({g1}, {g2}, {val})"
        return match.group(0)
        
    sql = re.sub(distance_pattern, replace_distance, sql, flags=re.IGNORECASE)
    
    # 2. Fix ST_DWithin missing geography cast when distance parameter > 1
    # ST_DWithin(a.geom, b.geom, 500) -> ST_DWithin(a.geom::geography, b.geom::geography, 500)
    dwithin_pattern = r"ST_DWithin\(([^,]+),\s*([^,]+),\s*(\d+(?:\.\d+)?)\)"
    def replace_dwithin(match):
        geom1 = match.group(1).strip()
        geom2 = match.group(2).strip()
        val = float(match.group(3))
        
        if val > 1.0:
            g1 = geom1 if "geography" in geom1 else f"{geom1}::geography"
            g2 = geom2 if "geography" in geom2 else f"{geom2}::geography"
            return f"ST_DWithin({g1}, {g2}, {val})"
        return match.group(0)
        
    sql = re.sub(dwithin_pattern, replace_dwithin, sql, flags=re.IGNORECASE)
    
    # Clean up markdown formatting if the model still returned it
    sql = sql.replace("```sql", "").replace("```", "").strip()
    
    if sql != original:
        print(f"CRS Guard activated: Modified SQL query to enforce meters unit.")
    
    return sql

def self_correct_loop(vietnamese_question):
    debug_logs = []
    # Dem so lan goi LLM MOT CACH TUONG MINH. Truoc day benchmark suy ra tu
    # len(debug), nhung ham nay ghi 1 entry cho lan sinh dau + 1 entry moi lan
    # thu chay, nen len(debug) luon = so lan goi + 1 -> bao cao lech +1.
    llm_calls = 0
    
    # Initial SQL generation prompt
    prompt = f"Generate a PostGIS SQL query to answer this question: '{vietnamese_question}'"
    raw_sql = query_ollama(prompt, system_prompt=SYSTEM_PROMPT)
    llm_calls += 1
    raw_sql = raw_sql.replace("```sql", "").replace("```", "").strip()
    sql = crs_guard(raw_sql)
    
    debug_logs.append({
        "step": "initial_generation",
        "raw_sql": raw_sql,
        "sql": sql
    })
    
    # Try execution and self-correction loop
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            print(f"Testing SQL query (Attempt {attempt+1})...")
            if not sql.strip().upper().startswith("SELECT"):
                raise ValueError("Query is not a SELECT statement.")
                
            results = execute_query(sql)
            
            debug_logs.append({
                "step": f"execution_attempt_{attempt+1}",
                "status": "success",
                "sql": sql
            })
            
            return {
                "success": True,
                "sql": sql,
                "raw_sql": raw_sql,        # ban tho cua dung lan sinh ra `sql`
                "results": results,
                "llm_calls": llm_calls,
                "debug": debug_logs
            }
            
        except Exception as e:
            error_message = str(e)
            print(f"Database error on Attempt {attempt+1}: {error_message}")
            
            debug_logs.append({
                "step": f"execution_attempt_{attempt+1}",
                "status": "failed",
                "error": error_message,
                "sql": sql
            })
            
            if attempt == max_attempts - 1:
                break
                
            # Formulate the error correction prompt
            correction_prompt = f"""You generated this SQL query for the question: "{vietnamese_question}"
SQL: {sql}
 
Running this query failed with the following database error:
{error_message}
 
Please correct the SQL query to fix the error. Remember:
- Do not use tables or columns that do not exist in the schema.
- Pay attention to geography casting for distance calculations.
- Return ONLY the raw SQL query, no markdown syntax, no explanations.
"""
            new_raw_sql = query_ollama(correction_prompt, system_prompt=SYSTEM_PROMPT)
            llm_calls += 1
            new_raw_sql = new_raw_sql.replace("```sql", "").replace("```", "").strip()
            # Cap nhat raw_sql theo lan sinh moi nhat, va ghi lai vao debug —
            # truoc day ban tho cua cac lan sua khong duoc luu o dau ca, nen
            # check_crs_violation chi soi duoc lan dau.
            raw_sql = new_raw_sql
            sql = crs_guard(new_raw_sql)
            debug_logs.append({
                "step": f"correction_{attempt+1}",
                "raw_sql": new_raw_sql,
                "sql": sql
            })
            
    return {
        "success": False,
        "sql": sql,
        "raw_sql": raw_sql,
        "error": "Failed to generate valid SQL query after multiple attempts.",
        "llm_calls": llm_calls,
        "debug": debug_logs
    }

def generate_explanation(vietnamese_question, sql, results):
    if not results:
        return "Không tìm thấy dữ liệu nào phù hợp với yêu cầu của bạn."
        
    # Standardize results to a compact JSON string to save LLM context
    # Limit number of records sent to prevent context overflow
    truncated_results = results[:20]
    
    prompt = f"""Dựa vào kết quả truy vấn cơ sở dữ liệu dưới đây, hãy viết một câu trả lời tự nhiên bằng tiếng Việt cho câu hỏi: "{vietnamese_question}"

CÂU LỆNH SQL ĐÃ CHẠY:
{sql}

KẾT QUẢ TRUY VẤN (JSON):
{truncated_results}

Yêu cầu:
- Trả lời ngắn gọn, lịch sự, tập trung vào thông tin người dùng hỏi.
- Nếu là danh sách địa điểm, hãy liệt kê rõ tên và các thông tin liên quan (như số sao, loại hình, địa chỉ) từ kết quả.
- Nếu là đường đi (pgRouting), hãy chỉ dẫn rõ các tên đường cần đi qua.
"""
    explanation = query_ollama(prompt)
    return explanation
