from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from app.db import execute_query
from app.ir_agent import answer, generate_explanation

app = FastAPI(title="GIS + LLM Da Nang Tourism API")

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str

class RouteRequest(BaseModel):
    start_lon: float
    start_lat: float
    end_lon: float
    end_lat: float

@app.get("/")
def read_root():
    return {"status": "ok", "message": "GIS + LLM Tourism API for Da Nang is running"}

@app.post("/api/chat")
def chat(request: ChatRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
        
    print(f"Processing question: {question}")
    agent_res = answer(question)
    
    if not agent_res["success"]:
        return {
            "success": False,
            "error": agent_res["error"],
            "debug": agent_res["debug"],
            "sql": agent_res.get("sql", "")
        }
        
    # Câu hỏi ngoài phạm vi DB: compile_ir sinh "SELECT NULL WHERE FALSE" nên
    # results luôn rỗng, và generate_explanation sẽ rơi vào nhánh mặc định
    # "không tìm thấy dữ liệu". Phải trả "reason" của model ra, nếu không người
    # dùng không phân biệt được "ngoài phạm vi" với "có tìm mà không thấy".
    ir = agent_res.get("ir") or {}
    if ir.get("target") in (None, "none"):
        return {
            "success": True,
            "abstained": True,
            "sql": agent_res["sql"],
            "results": [],
            "explanation": ir.get("reason")
                or "Câu hỏi này nằm ngoài phạm vi dữ liệu của hệ thống.",
            "debug": agent_res["debug"],
        }

    # Generate natural language explanation of results
    explanation = generate_explanation(question, agent_res["sql"], agent_res["results"])
    
    # Check if results contain geometries, convert them to standard GeoJSON dict if returned as string
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
        # Find nearest start node that is part of the giant connected component (comp_size > 100)
        start_node_query = """
            WITH components AS (
                SELECT node, component, count(*) OVER (PARTITION BY component) as comp_size
                FROM pgr_connectedComponents('SELECT id, source, target, cost, reverse_cost FROM roads')
            )
            SELECT v.id,
                   ST_X(v.the_geom) as lon,
                   ST_Y(v.the_geom) as lat,
                   ST_Distance(v.the_geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) as dist_m
            FROM roads_vertices_pgr v
            JOIN components c ON v.id = c.node
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
        
        # Max snapping distance threshold in meters (1.5 km)
        MAX_SNAP_DISTANCE_METERS = 1500
        
        if start_dist > MAX_SNAP_DISTANCE_METERS:
            raise HTTPException(
                status_code=400, 
                detail=f"Điểm bắt đầu cách mạng lưới đường bộ quá xa ({start_dist:.0f}m). Vui lòng chọn vị trí trong phạm vi Đà Nẵng và gần đường giao thông."
            )
        
        # Find nearest end node that is part of the giant connected component (comp_size > 100)
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
        
        # Execute pgRouting with directed := false for tourism demo stability
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
        
        # Parse geometries
        for row in path_res:
            if row.get("geom"):
                try:
                    row["geom"] = json.loads(row["geom"])
                except ValueError:
                    pass
                    
        # Sum the lengths of all segments + snap walk distances to get correct total distance
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
    min_lon: float = Query(None, description="Bbox: kinh độ nhỏ nhất"),
    min_lat: float = Query(None, description="Bbox: vĩ độ nhỏ nhất"),
    max_lon: float = Query(None, description="Bbox: kinh độ lớn nhất"),
    max_lat: float = Query(None, description="Bbox: vĩ độ lớn nhất"),
    tolerance: float = Query(0.00005, ge=0.0, le=0.01,
                             description="Dung sai ST_SimplifyPreserveTopology (độ). 0 = không giản lược"),
    limit: int = Query(20000, ge=1, le=100000),
):
    """Mạng lưới đường dạng GeoJSON, CHỈ để vẽ lên bản đồ.

    Trả cả bảng không giản lược cho ra ~3.9 MB trong một response duy nhất, và
    frontend gọi nó ở mỗi `map.on('load')`. Nên:
      - lọc theo bbox khi client truyền vào (dùng được index GIST trên geom),
      - giản lược hình học bằng ST_SimplifyPreserveTopology,
      - luôn có LIMIT.
    Tuyệt đối KHÔNG dùng dữ liệu giản lược này cho định tuyến — pgr_dijkstra
    vẫn đọc trực tiếp roads.geom nên không bị ảnh hưởng.
    """
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
