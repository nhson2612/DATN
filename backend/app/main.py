from fastapi import FastAPI, HTTPException, Query, Request, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import requests
from app.db import execute_query
from app.ir_agent import answer, generate_explanation
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin
)

app = FastAPI(title="GIS + LLM Da Nang Tourism API")

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to create default users
@app.on_event("startup")
def create_default_users():
    try:
        res = execute_query("SELECT COUNT(*) FROM users")
        if res and res[0]["count"] == 0:
            admin_pass = hash_password("admin")
            user_pass = hash_password("123456")
            execute_query(
                "INSERT INTO users (email, hashed_password, full_name, role) VALUES (%s, %s, %s, %s)",
                ("admin@gmail.com", admin_pass, "Administrator", "admin")
            )
            execute_query(
                "INSERT INTO users (email, hashed_password, full_name, role) VALUES (%s, %s, %s, %s)",
                ("user@gmail.com", user_pass, "Khách du lịch", "user")
            )
            print("Default users initialized: admin@gmail.com (admin) and user@gmail.com (123456)")
    except Exception as e:
        print(f"Error initializing default users: {e}")

# Request / Response Schemas
class ChatRequest(BaseModel):
    question: str
    user_lon: Optional[float] = None
    user_lat: Optional[float] = None

class RouteRequest(BaseModel):
    start_lon: float
    start_lat: float
    end_lon: float
    end_lat: float

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class POICreateUpdate(BaseModel):
    name: str
    amenity: Optional[str] = None
    tourism: Optional[str] = None
    description: Optional[str] = None
    lon: float
    lat: float

class AccommodationCreateUpdate(BaseModel):
    name: str
    amenity: Optional[str] = None
    tourism: Optional[str] = None
    price_range: Optional[str] = None
    stars: Optional[int] = None
    address: Optional[str] = None
    lon: float
    lat: float

class ItineraryCreateUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_days: int = 1
    stops: List[dict]

class RecommendRequest(BaseModel):
    duration_days: int
    preferences: str
    budget: str

# Helper Functions
def get_client_ip(request: Request):
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
    return request.client.host

def get_coords_from_ip(ip: str):
    if ip in ("127.0.0.1", "localhost", "::1") or ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172.16."):
        return 108.206, 16.047
    try:
        url = f"http://ip-api.com/json/{ip}"
        res = requests.get(url, timeout=3)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                return data.get("lon"), data.get("lat")
    except Exception as e:
        print(f"Error resolving IP geolocation: {e}")
    return 108.206, 16.047

def populate_itinerary_details(itinerary):
    stops = itinerary.get("stops", [])
    if isinstance(stops, str):
        try:
            stops = json.loads(stops)
        except:
            stops = []
    populated_stops = []
    for stop in stops:
        if not isinstance(stop, dict):
            continue
        stop_id = stop.get("id")
        stop_type = stop.get("type")
        day = stop.get("day", 1)
        
        detail = None
        if stop_type == 'poi':
            res = execute_query(
                "SELECT id, name, amenity, tourism, description, ST_X(geom) as lon, ST_Y(geom) as lat FROM poi WHERE id = %s", 
                (stop_id,)
            )
            if res:
                detail = res[0]
        elif stop_type == 'accommodation':
            res = execute_query(
                "SELECT id, name, amenity, tourism, price_range, stars, address, ST_X(geom) as lon, ST_Y(geom) as lat FROM accommodation WHERE id = %s", 
                (stop_id,)
            )
            if res:
                detail = res[0]
                
        if detail:
            populated_stops.append({
                "day": day,
                "type": stop_type,
                "id": stop_id,
                "name": detail.get("name"),
                "lon": detail.get("lon"),
                "lat": detail.get("lat"),
                "details": detail
            })
    itinerary["stops_details"] = populated_stops
    return itinerary

def get_recommendation_candidates(preferences: str, budget: str):
    pref_lower = preferences.lower()
    price_val = 'Trung bình'
    if 'rẻ' in budget.lower() or 'tiết kiệm' in budget.lower():
        price_val = 'Rẻ'
    elif 'sang' in budget.lower() or 'cao' in budget.lower() or 'đắt' in budget.lower():
        price_val = 'Sang trọng'
        
    acc_query = """
        SELECT id, name, amenity, tourism, price_level, rating, review_count, ST_X(geom) as lon, ST_Y(geom) as lat
        FROM accommodation
        WHERE price_level = %s OR price_level = 'Trung bình'
        ORDER BY rating DESC, review_count DESC
        LIMIT 15
    """
    accs = execute_query(acc_query, (price_val,))
    
    att_query = """
        SELECT id, name, amenity, tourism, price_level, rating, review_count, climate_label, ST_X(geom) as lon, ST_Y(geom) as lat
        FROM poi
        WHERE tourism IN ('attraction', 'viewpoint', 'museum', 'theme_park')
           OR amenity = 'place_of_worship'
        ORDER BY rating DESC, review_count DESC
        LIMIT 25
    """
    atts = execute_query(att_query)
    
    seafood_filter = ""
    if "hải sản" in pref_lower or "seafood" in pref_lower or "cá" in pref_lower:
        seafood_filter = "AND (name ILIKE '%hải sản%' OR name ILIKE '%seafood%')"
        
    rest_query = f"""
        SELECT id, name, amenity, tourism, price_level, rating, review_count, ST_X(geom) as lon, ST_Y(geom) as lat
        FROM poi
        WHERE (amenity IN ('restaurant', 'cafe', 'pub', 'bar', 'fast_food'))
          {seafood_filter}
        ORDER BY rating DESC, review_count DESC
        LIMIT 25
    """
    rests = execute_query(rest_query)
    
    candidates = []
    for a in accs:
        candidates.append({
            "id": a["id"],
            "type": "accommodation",
            "name": a["name"],
            "category": a["tourism"] or a["amenity"] or "hotel",
            "rating": float(a["rating"]),
            "price_level": a["price_level"],
            "lon": a["lon"],
            "lat": a["lat"]
        })
    for a in atts:
        candidates.append({
            "id": a["id"],
            "type": "poi",
            "name": a["name"],
            "category": a["tourism"] or a["amenity"] or "attraction",
            "rating": float(a["rating"]),
            "price_level": a["price_level"],
            "lon": a["lon"],
            "lat": a["lat"]
        })
    for a in rests:
        candidates.append({
            "id": a["id"],
            "type": "poi",
            "name": a["name"],
            "category": a["amenity"] or "restaurant",
            "rating": float(a["rating"]),
            "price_level": a["price_level"],
            "lon": a["lon"],
            "lat": a["lat"]
        })
        
    return candidates

# Core Endpoints
@app.get("/")
def read_root():
    return {"status": "ok", "message": "GIS + LLM Da Nang Tourism API is running"}

@app.post("/api/auth/register")
def register(data: UserRegister):
    exists = execute_query("SELECT id FROM users WHERE email = %s LIMIT 1", (data.email,))
    if exists:
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng")
    
    hashed = hash_password(data.password)
    execute_query(
        "INSERT INTO users (email, hashed_password, full_name, role) VALUES (%s, %s, %s, %s)",
        (data.email, hashed, data.full_name, "user")
    )
    return {"success": True, "message": "Đăng ký tài khoản thành công!"}

@app.post("/api/auth/login")
def login(data: UserLogin):
    user_res = execute_query(
        "SELECT id, email, hashed_password, full_name, role FROM users WHERE email = %s LIMIT 1",
        (data.email,)
    )
    if not user_res:
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")
    
    user = user_res[0]
    if not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")
        
    token = create_access_token({"sub": user["email"]})
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "user": current_user}

@app.post("/api/chat")
def chat(request: ChatRequest, raw_req: Request):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
        
    lon = request.user_lon
    lat = request.user_lat
    if lon is None or lat is None:
        ip = get_client_ip(raw_req)
        lon, lat = get_coords_from_ip(ip)
        
    full_question = f"{question} (Vị trí hiện tại của tôi: kinh độ = {lon:.6f}, vĩ độ = {lat:.6f})"
    print(f"Processing question: {full_question}")
    agent_res = answer(full_question)
    
    if not agent_res["success"]:
        return {
            "success": False,
            "error": agent_res["error"],
            "debug": agent_res["debug"],
            "sql": agent_res.get("sql", "")
        }
        
    ir = agent_res.get("ir") or {}
    if ir.get("target") in (None, "none"):
        return {
            "success": True,
            "abstained": True,
            "sql": agent_res["sql"],
            "results": [],
            "explanation": ir.get("reason") or "Câu hỏi này nằm ngoài phạm vi dữ liệu của hệ thống.",
            "debug": agent_res["debug"],
        }

    explanation = generate_explanation(full_question, agent_res["sql"], agent_res["results"])
    
    for row in agent_res["results"]:
        for col, val in list(row.items()):
            if isinstance(val, str) and (val.startswith('{"type"') or val.startswith('{"coordinates"')):
                try:
                    row[col] = json.loads(val)
                except ValueError:
                    pass
                    
    return {
        "success": True,
        "abstained": False,
        "sql": agent_res["sql"],
        "results": agent_res["results"],
        "explanation": explanation,
        "debug": agent_res["debug"]
    }

@app.post("/api/route")
def route(request: RouteRequest):
    try:
        # Đọc component từ bảng đã vật hoá, KHÔNG gọi pgr_connectedComponents ở
        # đây. Hàm đó là O(V+E) trên toàn graph và câu này chạy 2 lần mỗi
        # request (start + end), tức 2 lần quét cả mạng đường cho một lần bấm
        # chỉ đường. Làm mới bảng bằng backend/refresh_road_components.py sau
        # mỗi lần `roads` thay đổi.
        start_node_query = """
            SELECT v.id,
                   ST_X(v.the_geom) as lon,
                   ST_Y(v.the_geom) as lat,
                   ST_Distance(v.the_geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) as dist_m
            FROM roads_vertices_pgr v
            JOIN roads_components c ON c.node = v.id
            WHERE c.comp_size > 100
            ORDER BY v.the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            LIMIT 1;
        """
        start_res = execute_query(start_node_query, (request.start_lon, request.start_lat, request.start_lon, request.start_lat))
        if not start_res:
            raise HTTPException(status_code=404, detail="Start vertex not found in main network component")
        
        start_node = start_res[0]["id"]
        start_dist = start_res[0]["dist_m"]
        start_snap_lon = start_res[0]["lon"]
        start_snap_lat = start_res[0]["lat"]
        
        MAX_SNAP_DISTANCE_METERS = 1500
        
        if start_dist > MAX_SNAP_DISTANCE_METERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Điểm bắt đầu cách mạng lưới đường bộ quá xa ({start_dist:.0f}m). Vui lòng chọn vị trí trong phạm vi Đà Nẵng và gần đường giao thông."
            )
        
        end_res = execute_query(start_node_query, (request.end_lon, request.end_lat, request.end_lon, request.end_lat))
        if not end_res:
            raise HTTPException(status_code=404, detail="End vertex not found in main network component")
            
        end_node = end_res[0]["id"]
        end_dist = end_res[0]["dist_m"]
        end_snap_lon = end_res[0]["lon"]
        end_snap_lat = end_res[0]["lat"]
        
        if end_dist > MAX_SNAP_DISTANCE_METERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Điểm kết thúc cách mạng lưới đường bộ quá xa ({end_dist:.0f}m). Vui lòng chọn vị trí trong phạm vi Đà Nẵng và gần đường giao thông."
            )
        
        print(f"Calculating routing path from node {start_node} to {end_node}...")
        
        routing_query = """
            SELECT 
                d.seq, 
                d.node, 
                d.edge, 
                d.cost as segment_length_m, 
                d.agg_cost as total_length_m, 
                r.name as street_name, 
                ST_AsGeoJSON(r.geom) as geom
            FROM pgr_dijkstra(
                'SELECT id, source, target, cost, reverse_cost FROM roads', 
                %s, 
                %s, 
                directed := false
            ) d
            JOIN roads r ON d.edge = r.id
            ORDER BY d.seq;
        """
        path_res = execute_query(routing_query, (start_node, end_node))
        
        for row in path_res:
            if row.get("geom"):
                try:
                    row["geom"] = json.loads(row["geom"])
                except ValueError:
                    pass
                    
        network_distance = sum(row["segment_length_m"] for row in path_res) if path_res else 0.0
        total_distance = network_distance + start_dist + end_dist
        
        return {
            "success": True,
            "start_node": start_node,
            "end_node": end_node,
            "start_snap_lon": start_snap_lon,
            "start_snap_lat": start_snap_lat,
            "end_snap_lon": end_snap_lon,
            "end_snap_lat": end_snap_lat,
            "total_distance_meters": total_distance,
            "path": path_res
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {str(e)}")

@app.get("/api/roads")
def get_roads_geojson(
    min_lon: float = Query(None),
    min_lat: float = Query(None),
    max_lon: float = Query(None),
    max_lat: float = Query(None),
    tolerance: float = Query(0.00005, ge=0.0, le=0.01),
    limit: int = Query(20000, ge=1, le=100000),
):
    try:
        bbox_vals = [min_lon, min_lat, max_lon, max_lat]
        use_bbox = all(v is not None for v in bbox_vals)
        geom_expr = ("ST_SimplifyPreserveTopology(geom, %s)" if tolerance > 0 else "geom")
        where_sql = ""
        params = []
        if tolerance > 0:
            params.append(tolerance)
        if use_bbox:
            where_sql = "WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
            params.extend(bbox_vals)
        params.append(limit)

        geojson_query = f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(f), '[]'::json)
            ) AS geojson
            FROM (
                SELECT json_build_object(
                    'type', 'Feature',
                    'id', id,
                    'geometry', ST_AsGeoJSON({geom_expr})::json,
                    'properties', json_build_object('name', name, 'highway', highway)
                ) AS f
                FROM roads
                {where_sql}
                LIMIT %s
            ) sub;
        """
        res = execute_query(geojson_query, tuple(params))
        if res and res[0].get("geojson"):
            return res[0]["geojson"]
        return {"type": "FeatureCollection", "features": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roads: {str(e)}")

@app.get("/api/places")
def get_places_geojson():
    try:
        query = """
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(f), '[]'::json)
            ) AS geojson
            FROM (
                SELECT json_build_object(
                    'type', 'Feature',
                    'id', 'poi_' || id,
                    'geometry', ST_AsGeoJSON(geom)::json,
                    'properties', json_build_object(
                        'id', id,
                        'type', 'poi',
                        'name', name,
                        'amenity', amenity,
                        'tourism', tourism,
                        'description', description
                    )
                ) AS f
                FROM poi
                
                UNION ALL
                
                SELECT json_build_object(
                    'type', 'Feature',
                    'id', 'accommodation_' || id,
                    'geometry', ST_AsGeoJSON(geom)::json,
                    'properties', json_build_object(
                        'id', id,
                        'type', 'accommodation',
                        'name', name,
                        'amenity', amenity,
                        'tourism', tourism,
                        'stars', stars,
                        'price_range', price_range,
                        'address', address
                    )
                ) AS f
                FROM accommodation
            ) sub;
        """
        res = execute_query(query)
        if res and res[0].get("geojson"):
            return res[0]["geojson"]
        return {"type": "FeatureCollection", "features": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching places: {str(e)}")

# POI CRUD Endpoints
@app.post("/api/poi")
def create_poi(data: POICreateUpdate, current_user: dict = Depends(get_current_admin)):
    try:
        execute_query(
            """
            INSERT INTO poi (name, amenity, tourism, description, geom) 
            VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            """,
            (data.name, data.amenity, data.tourism, data.description, data.lon, data.lat)
        )
        return {"success": True, "message": "Thêm địa điểm du lịch thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating POI: {str(e)}")

@app.put("/api/poi/{id}")
def update_poi(id: int, data: POICreateUpdate, current_user: dict = Depends(get_current_admin)):
    try:
        exists = execute_query("SELECT id FROM poi WHERE id = %s", (id,))
        if not exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm")
        execute_query(
            """
            UPDATE poi 
            SET name = %s, amenity = %s, tourism = %s, description = %s, geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            WHERE id = %s
            """,
            (data.name, data.amenity, data.tourism, data.description, data.lon, data.lat, id)
        )
        return {"success": True, "message": "Cập nhật địa điểm thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating POI: {str(e)}")

@app.delete("/api/poi/{id}")
def delete_poi(id: int, current_user: dict = Depends(get_current_admin)):
    try:
        exists = execute_query("SELECT id FROM poi WHERE id = %s", (id,))
        if not exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm")
        execute_query("DELETE FROM poi WHERE id = %s", (id,))
        return {"success": True, "message": "Xóa địa điểm thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting POI: {str(e)}")

# Accommodation CRUD Endpoints
@app.post("/api/accommodation")
def create_accommodation(data: AccommodationCreateUpdate, current_user: dict = Depends(get_current_admin)):
    try:
        execute_query(
            """
            INSERT INTO accommodation (name, amenity, tourism, price_range, stars, address, geom) 
            VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            """,
            (data.name, data.amenity, data.tourism, data.price_range, data.stars, data.address, data.lon, data.lat)
        )
        return {"success": True, "message": "Thêm khách sạn thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating accommodation: {str(e)}")

@app.put("/api/accommodation/{id}")
def update_accommodation(id: int, data: AccommodationCreateUpdate, current_user: dict = Depends(get_current_admin)):
    try:
        exists = execute_query("SELECT id FROM accommodation WHERE id = %s", (id,))
        if not exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách sạn")
        execute_query(
            """
            UPDATE accommodation 
            SET name = %s, amenity = %s, tourism = %s, price_range = %s, stars = %s, address = %s, geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            WHERE id = %s
            """,
            (data.name, data.amenity, data.tourism, data.price_range, data.stars, data.address, data.lon, data.lat, id)
        )
        return {"success": True, "message": "Cập nhật khách sạn thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating accommodation: {str(e)}")

@app.delete("/api/accommodation/{id}")
def delete_accommodation(id: int, current_user: dict = Depends(get_current_admin)):
    try:
        exists = execute_query("SELECT id FROM accommodation WHERE id = %s", (id,))
        if not exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách sạn")
        execute_query("DELETE FROM accommodation WHERE id = %s", (id,))
        return {"success": True, "message": "Xóa khách sạn thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting accommodation: {str(e)}")

# Itineraries CRUD Endpoints
@app.get("/api/itineraries")
def get_itineraries(current_user: dict = Depends(get_current_user)):
    try:
        res = execute_query(
            "SELECT id, user_id, name, description, duration_days, stops, created_at FROM itineraries WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["id"],)
        )
        for itin in res:
            populate_itinerary_details(itin)
        return {"success": True, "itineraries": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching itineraries: {str(e)}")

@app.post("/api/itineraries")
def create_itinerary(data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)):
    try:
        execute_query(
            """
            INSERT INTO itineraries (user_id, name, description, duration_days, stops)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (current_user["id"], data.name, data.description, data.duration_days, json.dumps(data.stops))
        )
        return {"success": True, "message": "Lưu lịch trình thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving itinerary: {str(e)}")

@app.put("/api/itineraries/{id}")
def update_itinerary(id: int, data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)):
    try:
        exists = execute_query("SELECT id FROM itineraries WHERE id = %s AND user_id = %s", (id, current_user["id"]))
        if not exists:
            raise HTTPException(status_code=403, detail="Bạn không có quyền sửa lịch trình này hoặc lịch trình không tồn tại")
        execute_query(
            """
            UPDATE itineraries
            SET name = %s, description = %s, duration_days = %s, stops = %s
            WHERE id = %s
            """,
            (data.name, data.description, data.duration_days, json.dumps(data.stops), id)
        )
        return {"success": True, "message": "Cập nhật lịch trình thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating itinerary: {str(e)}")

@app.delete("/api/itineraries/{id}")
def delete_itinerary(id: int, current_user: dict = Depends(get_current_user)):
    try:
        exists = execute_query("SELECT id FROM itineraries WHERE id = %s AND user_id = %s", (id, current_user["id"]))
        if not exists:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xóa lịch trình này hoặc lịch trình không tồn tại")
        execute_query("DELETE FROM itineraries WHERE id = %s", (id,))
        return {"success": True, "message": "Xóa lịch trình thành công!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting itinerary: {str(e)}")

# AI Recommendation Endpoint
@app.post("/api/itineraries/recommend")
def recommend_itinerary(request: RecommendRequest):
    try:
        candidates = get_recommendation_candidates(request.preferences, request.budget)
        candidates_json = json.dumps(candidates, ensure_ascii=False)
        
        from app.ir_agent import OLLAMA_MODEL, OLLAMA_URL
        prompt = f"""Bạn là chuyên gia thiết kế lịch trình du lịch Đà Nẵng chuyên nghiệp.
Hãy lập một lịch trình chi tiết {request.duration_days} ngày dựa trên sở thích và ngân sách của du khách.

YÊU CẦU CỦA DU KHÁCH:
- Số ngày: {request.duration_days} ngày
- Sở thích: {request.preferences}
- Ngân sách: {request.budget}

DANH SÁCH ĐỊA ĐIỂM CÓ SẴN (Chỉ chọn các địa điểm từ danh sách này):
{candidates_json}

QUY TẮC BẮT BUỘC:
1. Mỗi ngày lập kế hoạch cho đúng 3 hoạt động (Sáng, Trưa, Chiều).
2. Chỉ sử dụng các địa điểm có trong "DANH SÁCH ĐỊA ĐIỂM CÓ SẴN" ở trên. Đối chiếu chính xác `id` và `type` ("poi" hoặc "accommodation"). Không tự bịa địa điểm khác.
3. Chọn khách sạn (type: accommodation) phù hợp để ở qua đêm (hoặc check-in vào ngày đầu tiên).
4. Phân chia các địa điểm trong một ngày sao cho gần nhau về mặt địa lý (dựa trên kinh độ `lon` và vĩ độ `lat` được cung cấp) để tiện di chuyển.
5. Định dạng đầu ra BẮT BUỘC phải là chuỗi JSON hợp lệ theo cấu trúc mẫu sau (Không trả thêm giải thích, không markdown, không ```json):
{{
  "explanation": "Tóm tắt ngắn gọn lý do thiết kế lịch trình này và lời khuyên...",
  "days": [
    {{
      "day": 1,
      "title": "Ngày 1: Khám phá Trung tâm & Biển Mỹ Khê",
      "activities": [
        {{
          "time": "Sáng",
          "place_id": 123,
          "place_type": "poi",
          "description": "Tham quan cầu Rồng và bảo tàng Chăm."
        }},
        ...
      ]
    }}
  ]
}}
"""
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        raw_res = response.json().get("response", "").strip()
        
        result = json.loads(raw_res)
        days = result.get("days", [])
        
        for day in days:
            coords = []
            activities_with_details = []
            for act in day.get("activities", []):
                place_id = act.get("place_id")
                place_type = act.get("place_type")
                if not place_id or not place_type:
                    continue
                
                table = "poi" if place_type == "poi" else "accommodation"
                res = execute_query(
                    f"SELECT id, name, ST_X(geom) as lon, ST_Y(geom) as lat FROM {table} WHERE id = %s",
                    (place_id,)
                )
                if res:
                    lon = res[0]["lon"]
                    lat = res[0]["lat"]
                    name = res[0]["name"]
                    coords.append((lon, lat))
                    act["name"] = name
                    act["lon"] = lon
                    act["lat"] = lat
                    activities_with_details.append(act)
            
            day["activities"] = activities_with_details
            
            day_features = []
            for i in range(len(coords) - 1):
                start_lon, start_lat = coords[i]
                end_lon, end_lat = coords[i+1]
                
                start_node_res = execute_query(
                    "SELECT id FROM roads_vertices_pgr ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1",
                    (start_lon, start_lat)
                )
                end_node_res = execute_query(
                    "SELECT id FROM roads_vertices_pgr ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1",
                    (end_lon, end_lat)
                )
                
                if start_node_res and end_node_res:
                    sn = start_node_res[0]["id"]
                    en = end_node_res[0]["id"]
                    
                    routing_query = """
                        SELECT ST_AsGeoJSON(r.geom) as geom
                        FROM pgr_dijkstra(
                            'SELECT id, source, target, cost, reverse_cost FROM roads', 
                            %s, 
                            %s, 
                            directed := false
                        ) d
                        JOIN roads r ON d.edge = r.id
                        ORDER BY d.seq;
                    """
                    path_res = execute_query(routing_query, (sn, en))
                    for row in path_res:
                        if row.get("geom"):
                            day_features.append({
                                "type": "Feature",
                                "geometry": json.loads(row["geom"]),
                                "properties": {}
                            })
            
            day["route_geojson"] = {
                "type": "FeatureCollection",
                "features": day_features
            }
            
        return {
            "success": True,
            "explanation": result.get("explanation", ""),
            "days": days
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Recommendation error: {str(e)}")
