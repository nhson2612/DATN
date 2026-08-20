from fastapi import FastAPI, HTTPException
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
            SELECT v.id 
            FROM roads_vertices_pgr v
            JOIN components c ON v.id = c.node
            WHERE c.comp_size > 100
            ORDER BY v.the_geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) 
            LIMIT 1;
        """
        start_res = execute_query(start_node_query, (request.start_lon, request.start_lat))
        if not start_res:
            raise HTTPException(status_code=404, detail="Start vertex not found in main network component")
        start_node = start_res[0]["id"]
        
        # Find nearest end node that is part of the giant connected component (comp_size > 100)
        end_res = execute_query(start_node_query, (request.end_lon, request.end_lat))
        if not end_res:
            raise HTTPException(status_code=404, detail="End vertex not found in main network component")
        end_node = end_res[0]["id"]
        
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
                    
        total_distance = path_res[-1]["total_length_m"] if path_res else 0.0
        
        return {
            "success": True,
            "start_node": start_node,
            "end_node": end_node,
            "total_distance_meters": total_distance,
            "path": path_res
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {str(e)}")
