"""
Tầng LLM: câu hỏi tiếng Việt -> IR (JSON) -> SQL.

Khác với app/agent.py (LLM sinh thẳng SQL), ở đây LLM chỉ điền một cấu trúc
JSON có từ vựng đóng. Việc này dễ hơn nhiều với model nhỏ, và mọi lỗi cú pháp
hay lỗi hệ toạ độ đều bị loại bỏ ở tầng biên dịch.
"""

import json
import os
import requests

from app.db import execute_query
from app.ir import compile_ir, IRError, TABLES

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

IR_SYSTEM_PROMPT = """Bạn là trợ lý chuyển câu hỏi du lịch Đà Nẵng thành một đối tượng JSON đại diện (IR).
Chỉ trả về JSON, không giải thích, không markdown.

CẤU TRÚC JSON:
{
  "target": "poi" hoặc "accommodation",
  "select": ["name"],                             // KHÔNG dùng khi hỏi đếm số lượng
  "aggregate": "count",                           // CHỈ dùng khi hỏi 'bao nhiêu', 'số lượng', 'đếm'
  "where": [                                      // Chứa tất cả bộ lọc điều kiện
    {"op": "eq", "col": "amenity", "value": "cafe"},
    {"op": "gte", "col": "rating", "value": 4.5},
    {"op": "in_admin", "name": "Sơn Trà"},        // lọc địa giới hành chính (phường/quận)
    {"op": "within_distance", "meters": 500, "ref": {"table": "poi", "name": "Non Nuoc Beach"}}
  ],
  "nearest_to": {"lon": 108.2, "lat": 16.0},      // CHỈ dùng khi hỏi 'gần nhất' hoặc tọa độ cụ thể
  "limit": 10                                     // mặc định là 10, nếu tìm 'gần nhất' thì limit là 1
}

LƯU Ý QUAN TRỌNG:
1. KHÔNG tự ý thêm trường "nearest_to" nếu câu hỏi không chứa từ "gần nhất" hoặc một cặp tọa độ số thực.
2. Nếu câu hỏi yêu cầu đếm ("Có bao nhiêu..."), bạn BẮT BUỘC phải dùng "aggregate": "count" và BỎ TRƯỜNG "select".
3. Với các câu hỏi lọc địa giới (ví dụ: ở Phường Sơn Trà, ở Sơn Trà, tại Ngũ Hành Sơn), bạn BẮT BUỘC dùng op "in_admin".
4. Chỉ sử dụng các cột thực tế: rating, stars, price_level, amenity, tourism.

VÍ DỤ
Hỏi: Có bao nhiêu quán cafe ở Phường Sơn Trà?
{"target":"poi","aggregate":"count","where":[{"op":"eq","col":"amenity","value":"cafe"},{"op":"in_admin","name":"Phường Sơn Trà"}]}

Hỏi: Khách sạn 5 sao gần nhất với tọa độ 108.22 16.06
{"target":"accommodation","select":["name"],"where":[{"op":"eq","col":"stars","value":5}],"nearest_to":{"lon":108.22,"lat":16.06},"limit":1}
"""


def query_ollama_json(prompt, system_prompt):
    """Gọi Ollama ở chế độ ép định dạng JSON."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "format": "json",          # Ollama ép model sinh JSON hợp lệ
        "options": {"temperature": 0},
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        return response.json().get("response", "").strip()
    except Exception as e:
        print(f"Ollama API error: {e}")
        return ""


def question_to_sql(question, max_attempts=3):
    """
    Trả về dict:
      {"success": bool, "ir": ..., "sql": ..., "params": ..., "debug": [...]}
    Vòng lặp sửa lỗi ở đây chỉ chạy khi IR sai cấu trúc — SQL sinh ra
    từ IR hợp lệ thì luôn chạy được, nên không cần retry vì lỗi cú pháp.
    """
    debug = []
    prompt = f"Hỏi: {question}"

    for attempt in range(max_attempts):
        raw = query_ollama_json(prompt, IR_SYSTEM_PROMPT)
        if not raw:
            debug.append({"attempt": attempt + 1, "error": "LLM không trả về gì"})
            break

        try:
            ir = json.loads(raw)
        except ValueError as e:
            debug.append({"attempt": attempt + 1, "raw": raw, "error": f"JSON hỏng: {e}"})
            prompt = f"Hỏi: {question}\n\nLần trước bạn trả về JSON hỏng. Chỉ trả về JSON hợp lệ."
            continue

        try:
            sql, params = compile_ir(ir)
        except IRError as e:
            debug.append({"attempt": attempt + 1, "ir": ir, "error": str(e)})
            # Phản hồi lỗi cụ thể cho LLM — đây là điểm khác biệt so với
            # sinh SQL trực tiếp: thông báo lỗi ngắn, rõ, và luôn đúng trọng tâm.
            prompt = (
                f"Hỏi: {question}\n\n"
                f"JSON lần trước bị lỗi: {e}\n"
                f"Hãy sửa lại và chỉ trả về JSON."
            )
            continue

        debug.append({"attempt": attempt + 1, "ir": ir, "status": "ok"})
        return {"success": True, "ir": ir, "sql": sql, "params": params, "debug": debug}

    return {
        "success": False,
        "error": "Không tạo được truy vấn hợp lệ từ câu hỏi.",
        "debug": debug,
    }


def answer(question):
    """Chạy trọn: câu hỏi -> IR -> SQL -> kết quả."""
    res = question_to_sql(question)
    if not res["success"]:
        return res

    rows = execute_query(res["sql"], res["params"])
    for row in rows or []:
        if isinstance(row.get("geom"), str):
            try:
                row["geom"] = json.loads(row["geom"])
            except ValueError:
                pass

    res["results"] = rows or []
    return res


def query_ollama(prompt, system_prompt=None):
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }
    if system_prompt:
        payload["system"] = system_prompt
        
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=90)
        response.raise_for_status()
        return response.json().get("response", "").strip()
    except Exception as e:
        print(f"Ollama API error: {e}")
        return ""


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

