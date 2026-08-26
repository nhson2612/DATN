"""Endpoint hỏi đáp: bọc mỏng quanh agent IR của phần nghiên cứu.

KHÔNG đặt logic của agent ở đây — ir_agent là đóng góp khoa học của luận văn và
mọi thay đổi trong đó đều dịch số benchmark.
"""

import json

from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.logging import get_logger, log_duration
from app.ir_agent import answer, generate_explanation
from app.schemas.requests import ChatRequest
from app.services import geo_ip_service

router = APIRouter(prefix="/api", tags=["chat"])
logger = get_logger(__name__)


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
    # Người dùng vừa chọn một đơn vị hành chính ở lượt hỏi lại: chèn TÊN ĐẦY ĐỦ
    # vào câu hỏi. Phải nằm trong câu hỏi chứ không nhét thẳng vào IR, vì
    # prune_ungrounded chỉ giữ tên nào thực sự xuất hiện trong câu hỏi — và vì
    # tên đầy đủ khớp chính xác nên check_admin_ambiguity không raise nữa.
    if request.resolved_admin:
        full_question = f"{full_question} (Đơn vị hành chính: {request.resolved_admin})"
        logger.info("Người dùng đã chọn địa giới: %r", request.resolved_admin)
    # Log từng bước: một lượt /api/chat gồm 2 lần gọi LLM (sinh IR, rồi diễn
    # giải kết quả) cộng SQL ở giữa, tổng có thể tới 2 phút. Không log từng bước
    # thì suốt thời gian đó không phân biệt được đang chạy hay đã treo.
    logger.info("Câu hỏi: %r (vị trí %.4f, %.4f)", question[:120], lon, lat)
    with log_duration(logger, "Agent IR sinh SQL + chạy truy vấn"):
        agent_res = answer(full_question)

    llm_calls = agent_res.get("llm_calls")
    # Nhập nhằng địa giới KHÔNG phải lỗi: thiếu thông tin mà chỉ người dùng mới
    # có. Trả 200 kèm danh sách để họ chọn, thay vì để agent đoán bừa — ví dụ
    # "Hà Đông" khớp cả 'Phường Hà Đông' (Hà Nội) lẫn 'Xã Hà Đông' (tỉnh khác),
    # và heuristic cũ chọn theo diện tích lớn nhất nên trúng đúng cái sai.
    if agent_res.get("needs_clarification"):
        candidates = agent_res.get("candidates") or []
        logger.info(
            "Cần người dùng làm rõ %r — %d ứng viên: %s",
            agent_res.get("ambiguous_name"), len(candidates), candidates[:10],
            extra={"ctx_ambiguous": agent_res.get("ambiguous_name"),
                   "ctx_candidates": candidates},
        )
        return {
            "success": True,
            "needs_clarification": True,
            "ambiguous_name": agent_res.get("ambiguous_name"),
            "candidates": candidates,
            "explanation": (
                f"Tên “{agent_res.get('ambiguous_name')}” khớp "
                f"{len(candidates)} đơn vị hành chính. Bạn muốn hỏi ở đâu?"
            ),
            "results": [],
            "sql": "",
            "debug": agent_res["debug"],
        }

    if not agent_res["success"]:
        error_text = agent_res.get("error", "")
        logger.warning(
            "Không sinh được truy vấn sau %s lần gọi LLM: %s",
            llm_calls, error_text[:160],
        )
        # LLM không trả về gì = timeout hoặc lỗi provider. Đây là lỗi hạ tầng,
        # phải trả 504 chứ không phải 200: trước đây timeout 120s vẫn trả 200
        # nên frontend không phân biệt được "hỏng" với "không có kết quả".
        if "LLM không trả về gì" in error_text:
            # Phải lấy model theo provider đang bật: in cứng ollama_model khiến
            # thông báo đổ lỗi cho qwen2.5:7b trong khi thủ phạm là model DeepSeek,
            # và người đọc log đi sai hướng chẩn đoán.
            model = (
                settings.deepseek_model
                if settings.llm_provider.lower() == "deepseek"
                else settings.ollama_model
            )
            raise HTTPException(
                status_code=504,
                detail=(
                    f"Mô hình {model} không phản hồi trong "
                    f"{settings.llm_timeout_sql}s. Tăng LLM_TIMEOUT_SQL hoặc "
                    f"dùng mô hình nhỏ hơn."
                ),
            )
        return {
            "success": False,
            "error": agent_res["error"],
            "debug": agent_res["debug"],
            "sql": agent_res.get("sql", ""),
        }

    ir = agent_res.get("ir") or {}
    if ir.get("target") in (None, "none"):
        logger.info(
            "Agent từ chối trả lời (ngoài phạm vi DB): %s | IR: %s",
            ir.get("reason"), json.dumps(ir, ensure_ascii=False),
            extra={"ctx_ir": ir},
        )
        return {
            "success": True,
            "abstained": True,
            "sql": agent_res["sql"],
            "results": [],
            "explanation": ir.get("reason")
            or "Câu hỏi này nằm ngoài phạm vi dữ liệu của hệ thống.",
            "debug": agent_res["debug"],
        }

    n_rows = len(agent_res["results"])
    # In LUÔN cả IR lẫn SQL, kể cả khi thành công: không có chúng thì "trả 20
    # dòng" không phân biệt được 20 quán đúng món với 20 nhà hàng bất kỳ do
    # thiếu bộ lọc — cùng là 200 OK, cùng là 20 dòng.
    logger.info(
        "IR ok sau %s lần gọi LLM, truy vấn trả %d dòng — IR: %s | SQL: %s",
        llm_calls, n_rows,
        json.dumps(ir, ensure_ascii=False),
        " ".join(agent_res["sql"].split()),
        extra={"ctx_llm_calls": llm_calls, "ctx_rows": n_rows,
               "ctx_ir": ir, "ctx_sql": agent_res["sql"]},
    )
    for step in agent_res.get("debug") or []:
        if step.get("pruned"):
            logger.warning("Điều kiện bị prune (không bám câu hỏi): %s", step["pruned"])
    # Rỗng là thất bại IM LẶNG (200 OK, không kết quả) nên nâng lên WARNING và
    # in lại đầy đủ IR + SQL ngay tại dòng cảnh báo — người đọc log không phải
    # đi ngược lên tìm, và grep WARNING là ra đủ thông tin để chẩn đoán.
    if n_rows == 0:
        logger.warning(
            "Truy vấn chạy được nhưng trả 0 dòng — IR: %s | SQL: %s",
            json.dumps(ir, ensure_ascii=False),
            " ".join(agent_res["sql"].split()),
            extra={"ctx_ir": ir, "ctx_sql": agent_res["sql"]},
        )
    with log_duration(logger, "LLM diễn giải kết quả", rows=n_rows):
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
