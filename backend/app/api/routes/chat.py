"""Endpoint hỏi đáp: bọc mỏng quanh agent IR của phần nghiên cứu.

KHÔNG đặt logic của agent ở đây — ir_agent là đóng góp khoa học của luận văn và
mọi thay đổi trong đó đều dịch số benchmark.
"""

import json

from fastapi import APIRouter, HTTPException, Request

from app.ir_agent import answer, generate_explanation
from app.schemas.requests import ChatRequest
from app.services import geo_ip_service

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(request: ChatRequest, raw_req: Request):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    lon, lat = request.user_lon, request.user_lat
    if lon is None or lat is None:
        lon, lat = geo_ip_service.coords_from_ip(geo_ip_service.get_client_ip(raw_req))

    full_question = (
        f"{question} (Vị trí hiện tại của tôi: "
        f"kinh độ = {lon:.6f}, vĩ độ = {lat:.6f})"
    )
    agent_res = answer(full_question)

    if not agent_res["success"]:
        return {
            "success": False,
            "error": agent_res["error"],
            "debug": agent_res["debug"],
            "sql": agent_res.get("sql", ""),
        }

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

    explanation = generate_explanation(
        full_question, agent_res["sql"], agent_res["results"]
    )
    for row in agent_res["results"]:
        for col, val in list(row.items()):
            if isinstance(val, str) and val.startswith(('{"type"', '{"coordinates"')):
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
        "debug": agent_res["debug"],
    }
