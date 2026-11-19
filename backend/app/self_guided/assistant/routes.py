"""Endpoint trợ lý du lịch & trợ lý lập lịch trình thông minh (Trip Planner AI).

Luồng:
1. Nếu gọi kèm `itinerary_id` hoặc `trip_context` (từ màn hình Trip Planner `/trips/:id`):
   - Đọc đầy đủ ngữ cảnh chuyến đi (tên, điểm đến, số ngày, ngân sách, các điểm đã xếp theo từng ngày,
     chỗ nghỉ từng đêm, các điểm chờ xếp, checklist, ghi chú, chi phí).
   - Truy vấn ứng viên thực tế từ PostGIS (`accommodation`, `serper_places_store`) + Serper Places + Tavily.
   - Gọi DeepSeek LLM để tư vấn theo đúng ngữ cảnh chuyến đi và trả về các công cụ hành động trực tiếp
     (`proposed_plan` theo ngày, `results` kèm `suggested_day` & `role`, và `tool_actions`).
2. Nếu gọi tìm kiếm thông thường: tìm kiếm trên dữ liệu (`search_service`) -> tổng hợp kết quả.
"""

import json
import re
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.database import execute_query
from app.core.llm.adapter import query_llm
from app.core.logging import get_logger, log_duration
from app.shared.schemas.requests import ChatRequest
from app.self_guided.assistant import search_service as search_agent
from app.self_guided.itinerary import service as itinerary_service
from app.shared import geo

router = APIRouter(prefix="/api", tags=["chat"])
logger = get_logger(__name__)


def _khoang_cach(met):
    if met is None:
        return ""
    return f"{met:.0f} m" if met < 1000 else f"{met / 1000:.1f} km"


def _tom_tat(results, anchor, trong_vung=False):
    """Sinh câu trả lời tóm tắt danh sách địa điểm."""
    if not anchor:
        dau = "quanh vị trí của bạn"
    else:
        dau = f"{'trong' if trong_vung else 'gần'} {anchor['name']}"
    dong = [
        f"{i}. {r['name']}" + (f" — cách {_khoang_cach(r['met'])}" if r.get("met") is not None else "")
        for i, r in enumerate(results[:5], 1)
    ]
    them = f"\n\n(còn {len(results) - 5} địa điểm khác trên bản đồ)" if len(results) > 5 else ""
    return f"Tìm thấy {len(results)} địa điểm {dau}:\n\n" + "\n".join(dong) + them


_GENERIC_TRIP_NAMES = {
    "kiểm thử giao diện",
    "chuyến đi mới",
    "chuyến đi chưa đặt tên",
    "lịch trình mới",
    "test",
    "untitled",
}

_PLANNING_INTENT_RE = re.compile(
    r"(?i)\b(lịch trình|lên lịch|kế hoạch|gợi ý ngày|ngày\s*\d+|đi đâu|chơi gì|sắp xếp|lấp đầy|tối ưu|checklist|ngân sách|chi phí|chỗ nghỉ|khách sạn|homestay|resort)\b"
)


def _extract_destination_from_text(text: str) -> str | None:
    """Trích xuất tên điểm đến nếu người dùng nhắc tới trong câu hỏi."""
    if not text:
        return None
    m = re.search(
        r"(?i)(?:tại|ở|đi|đến|du lịch|khám phá|quanh|gần)\s+([A-ZÀ-ỸĐ][a-zà-ỹđ]+(?:\s+[A-ZÀ-ỸĐa-zà-ỹđ]+){0,3})",
        text.strip(),
    )
    if m:
        cand = m.group(1).strip(" ?.,!;:")
        stop_words = {"ngày", "đêm", "này", "đây", "đó", "chuyến", "lịch", "trình", "đâu", "gì", "nào"}
        tokens = [w for w in cand.split() if w.lower() not in stop_words]
        if tokens:
            return " ".join(tokens)
    return None


def _load_trip_context(itinerary_id: int | None, client_ctx: dict | None) -> dict:
    """Chuẩn hoá ngữ cảnh chuyến đi từ client gửi lên hoặc đọc từ bảng itineraries."""
    ctx = dict(client_ctx or {})
    if itinerary_id and not ctx.get("stops") and not ctx.get("name"):
        rows = execute_query("SELECT * FROM itineraries WHERE id = %s", (itinerary_id,))
        if rows:
            row = rows[0]
            ctx = {
                "id": row["id"],
                "name": row.get("name"),
                "destination": row.get("destination"),
                "duration_days": row.get("duration_days") or 1,
                "start_date": str(row["start_date"]) if row.get("start_date") else None,
                "budget": float(row.get("budget") or 0),
                "stops": itinerary_service.hydrate_stops(row.get("stops") or []),
                "sections": row.get("sections") or [],
                "reservations": row.get("reservations") or [],
            }
    elif itinerary_id and "id" not in ctx:
        ctx["id"] = itinerary_id
    return ctx


def _summarize_trip_for_llm(ctx: dict) -> dict:
    """Tóm tắt trạng thái chuyến đi thành cấu trúc gọn, rõ ràng cho LLM."""
    duration_days = max(int(ctx.get("duration_days") or 1), 1)
    stops = [s for s in (ctx.get("stops") or []) if isinstance(s, dict)]

    days_summary = {}
    for d in range(1, duration_days + 1):
        days_summary[d] = {"lodging": None, "places": [], "notes": []}

    unscheduled_places = []
    checklists = []
    general_notes = []
    total_spent = 0.0

    for s in stops:
        role = s.get("role") or (s.get("type") if s.get("type") in ("note", "checklist", "expense") else "place")
        day = s.get("day")
        day_int = int(day) if isinstance(day, int) and 1 <= day <= duration_days else None
        cost = float(s.get("cost") or 0)
        if cost > 0:
            total_spent += cost

        if role == "checklist":
            checklists.append({"text": s.get("text") or s.get("name") or "", "done": bool(s.get("done")), "day": day_int})
        elif role == "note":
            txt = s.get("text") or s.get("name") or ""
            if day_int and txt:
                days_summary[day_int]["notes"].append(txt)
            elif txt:
                general_notes.append(txt)
        elif role == "expense":
            continue
        elif role == "lodging":
            item_info = {
                "id": s.get("id"),
                "type": s.get("type"),
                "name": s.get("name") or "Chỗ nghỉ",
                "category": s.get("category"),
                "dia_chi": s.get("dia_chi"),
                "lon": s.get("lon"),
                "lat": s.get("lat"),
            }
            if day_int:
                days_summary[day_int]["lodging"] = item_info
            else:
                unscheduled_places.append({**item_info, "section": s.get("section") or "luu-tru", "role": "lodging"})
        else:
            item_info = {
                "id": s.get("id"),
                "type": s.get("type"),
                "name": s.get("name") or "Địa điểm",
                "category": s.get("category"),
                "dia_chi": s.get("dia_chi"),
                "lon": s.get("lon"),
                "lat": s.get("lat"),
            }
            if day_int:
                days_summary[day_int]["places"].append(item_info)
            else:
                unscheduled_places.append({**item_info, "section": s.get("section") or "muon-di", "role": "place"})

    for res in (ctx.get("reservations") or []):
        if isinstance(res, dict) and res.get("cost"):
            try:
                total_spent += float(res["cost"])
            except (TypeError, ValueError):
                pass

    return {
        "id": ctx.get("id"),
        "name": ctx.get("name") or "Chuyến đi",
        "destination": (ctx.get("destination") or "").strip() or None,
        "duration_days": duration_days,
        "start_date": ctx.get("start_date"),
        "budget": float(ctx.get("budget") or 0),
        "total_spent": total_spent,
        "days": days_summary,
        "unscheduled_places": unscheduled_places,
        "checklists": checklists,
        "general_notes": general_notes,
        "reservations_count": len(ctx.get("reservations") or []),
    }


def _collect_planner_candidates(
    question: str,
    trip_summary: dict,
    lon: float,
    lat: float,
    resolved_admin: str | None = None,
) -> tuple[list[dict], str | None, str | None, list[dict]]:
    """Thu thập địa điểm ứng viên thực tế từ CSDL + Serper + Tavily theo ngữ cảnh chuyến đi."""
    # 1. Xác định toạ độ neo ưu tiên từ các điểm đã có trong chuyến đi
    existing_coords = []
    for d_info in trip_summary["days"].values():
        if d_info["lodging"] and d_info["lodging"].get("lon") and d_info["lodging"].get("lat"):
            existing_coords.append((float(d_info["lodging"]["lon"]), float(d_info["lodging"]["lat"])))
        for p in d_info["places"]:
            if p.get("lon") and p.get("lat"):
                existing_coords.append((float(p["lon"]), float(p["lat"])))
    for p in trip_summary["unscheduled_places"]:
        if p.get("lon") and p.get("lat"):
            existing_coords.append((float(p["lon"]), float(p["lat"])))

    if existing_coords:
        lon = sum(c[0] for c in existing_coords) / len(existing_coords)
        lat = sum(c[1] for c in existing_coords) / len(existing_coords)

    # 2. Xác định điểm đến mục tiêu
    effective_dest = resolved_admin or trip_summary.get("destination")
    mentioned_dest = _extract_destination_from_text(question)
    if mentioned_dest and not effective_dest:
        effective_dest = mentioned_dest
    if not effective_dest:
        tname = (trip_summary.get("name") or "").strip()
        if tname and tname.lower() not in _GENERIC_TRIP_NAMES:
            cleaned_name = re.sub(r"(?i)^(chuyến đi|lịch trình|du lịch|trip to|khám phá)\s+", "", tname).strip()
            if cleaned_name and cleaned_name.lower() not in _GENERIC_TRIP_NAMES:
                effective_dest = cleaned_name

    # 3. Tìm kiếm theo câu hỏi thực tế + ứng viên lập lịch trình
    candidates = []
    seen_keys = set()
    tavily_answer = None
    tavily_sources = []

    def _add_candidate(row: dict):
        rid = row.get("id")
        rtype = row.get("type") or "serper"
        rname = (row.get("name") or "").strip()
        if not rid or not rname:
            return
        # Loại bỏ kết quả chỉ là tên tỉnh/thành phố trùng với điểm đến
        if effective_dest and rname.casefold() == effective_dest.casefold():
            return
        key = (rtype, str(rid))
        if key in seen_keys:
            return
        seen_keys.add(key)
        candidates.append({
            **row,
            "id": rid,
            "type": rtype,
            "name": rname,
        })

    is_planning = bool(_PLANNING_INTENT_RE.search(question))
    is_external_qa = bool(
        re.search(r"(?i)\b(giá vé|vé vào|mấy giờ mở|giờ mở cửa|đóng cửa|review|kinh nghiệm đi)\b", question)
    )

    cleaned_q = re.sub(
        r"(?i)\b(xem giúp|lịch trình hiện tại|của tôi|có những điểm nào rồi|gợi ý lịch trình\s*\d*\s*ngày|lên lịch trình\s*\d*\s*ngày|cho chuyến đi này|gần đây|hãy gợi ý|tư vấn)\b",
        "",
        question,
    ).strip(" ,.-?!")

    if is_external_qa and cleaned_q:
        res = search_agent.search(
            cleaned_q,
            lon,
            lat,
            limit=12,
            resolved_admin=effective_dest,
        )
        tavily_answer = res.get("answer")
        tavily_sources = res.get("sources") or []
        for r in (res.get("results") or []):
            _add_candidate(r)
    elif cleaned_q and len(cleaned_q) >= 3:
        from app.shared.places import serper as serper_service
        search_q = f"{cleaned_q}, {effective_dest}" if effective_dest and effective_dest.casefold() not in cleaned_q.casefold() else cleaned_q
        try:
            for r in serper_service.search_places(search_q, lat, lon, limit=14):
                _add_candidate(r)
        except Exception as exc:
            logger.debug("Serper search lỗi trong Planner AI: %s", exc)

    # Nếu người dùng hỏi về lịch trình / khách sạn / hoặc số ứng viên còn ít -> bổ sung từ get_candidates
    if is_planning or len(candidates) < 8:
        extra = itinerary_service.get_candidates(effective_dest or "Hà Nội", lon, lat, limit=28)
        for r in extra:
            _add_candidate(r)

    return candidates[:28], effective_dest, tavily_answer, tavily_sources


def _handle_planner_assistant(request: ChatRequest, lon: float, lat: float) -> dict:
    """Xử lý câu hỏi trong màn hình Trip Planner với đầy đủ ngữ cảnh & công cụ."""
    question = request.question.strip()
    raw_ctx = _load_trip_context(request.itinerary_id, request.trip_context)
    trip_summary = _summarize_trip_for_llm(raw_ctx)

    with log_duration(logger, "Thu thập ứng viên cho Trip Planner AI"):
        candidates, effective_dest, tavily_answer, tavily_sources = _collect_planner_candidates(
            question, trip_summary, lon, lat, resolved_admin=request.resolved_admin
        )

    # Đánh dấu các điểm đã có sẵn trong chuyến đi
    existing_place_map = {}
    for d_num, d_info in trip_summary["days"].items():
        if d_info["lodging"] and d_info["lodging"].get("id"):
            existing_place_map[(d_info["lodging"].get("type"), str(d_info["lodging"].get("id")))] = f"Chỗ nghỉ Ngày {d_num}"
        for p in d_info["places"]:
            if p.get("id"):
                existing_place_map[(p.get("type"), str(p.get("id")))] = f"Ngày {d_num}"
    for p in trip_summary["unscheduled_places"]:
        if p.get("id"):
            existing_place_map[(p.get("type"), str(p.get("id")))] = "Chờ xếp lịch"

    indexed_candidates = []
    by_idx = {}
    for idx, c in enumerate(candidates, 1):
        key = (c.get("type"), str(c.get("id")))
        status_in_trip = existing_place_map.get(key)
        c["in_trip_status"] = status_in_trip
        by_idx[idx] = c
        indexed_candidates.append({
            "idx": idx,
            "name": c.get("name"),
            "type": c.get("type"),
            "category": c.get("category") or ("lodging" if c.get("type") == "accommodation" else "poi"),
            "address": c.get("dia_chi") or "",
            "rating": c.get("rating"),
            "in_trip": status_in_trip,
        })

    history_lines = []
    for m in (request.history or [])[-6:]:
        if isinstance(m, dict) and m.get("text"):
            role_label = "Khách" if m.get("role") == "user" else "Trợ lý"
            history_lines.append(f"- {role_label}: {str(m['text'])[:300]}")
    history_block = "\n".join(history_lines) if history_lines else "(Mới bắt đầu cuộc trò chuyện)"

    days_text_lines = []
    empty_days = []
    days_with_multiple_stops = []
    for d_num, d_info in trip_summary["days"].items():
        lodging_name = d_info["lodging"]["name"] if d_info["lodging"] else "Chưa chọn chỗ nghỉ"
        place_names = [p["name"] for p in d_info["places"]]
        if not place_names:
            empty_days.append(d_num)
        if len(place_names) >= 2:
            days_with_multiple_stops.append(d_num)
        places_str = " -> ".join(place_names) if place_names else "Đang trống (0 địa điểm)"
        days_text_lines.append(f"  + Ngày {d_num}: [Chỗ nghỉ: {lodging_name}] | Lịch trình: {places_str}")

    unscheduled_names = [p["name"] for p in trip_summary["unscheduled_places"]]

    prompt = f"""Bạn là Trợ lý AI chuyên trách màn hình Lên lịch trình tự túc (Trip Planner) của hệ thống du lịch thông minh Aura Voyage.
Bạn nắm rõ toàn bộ trạng thái chuyến đi hiện tại của người dùng và có quyền sử dụng các công cụ của màn hình tự lên lịch để hỗ trợ họ.

=== 1. NGỮ CẢNH CHUYẾN ĐI HIỆN TẠI ===
- Mã chuyến đi: #{trip_summary['id'] or 'Mới'}
- Tên chuyến đi: "{trip_summary['name']}"
- Điểm đến đã cài đặt: {trip_summary['destination'] or f'Chưa đặt cố định (Đang gợi ý theo khu vực: {effective_dest or "Hà Nội"})'}
- Thời lượng: {trip_summary['duration_days']} ngày {f'(Khởi hành: {trip_summary["start_date"]})' if trip_summary.get('start_date') else ''}
- Ngân sách: {f"{int(trip_summary['budget']):,} VND" if trip_summary['budget'] > 0 else "Chưa đặt ngân sách"} (Đã chi/dự kiến: {int(trip_summary['total_spent']):,} VND)
- Trạng thái các ngày:
{chr(10).join(days_text_lines)}
- Địa điểm đã lưu nhưng CHƯA xếp vào ngày ({len(unscheduled_names)} điểm): {", ".join(unscheduled_names[:10]) if unscheduled_names else "Không có"}
- Số mục Checklist hiện có: {len(trip_summary['checklists'])} mục

=== 2. LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY ===
{history_block}

=== 3. THÔNG TIN THAM KHẢO TỪ WEB (NẾU CÓ) ===
{tavily_answer or "Không có"}

=== 4. DANH SÁCH ĐỊA ĐIỂM ỨNG VIÊN THỰC TẾ TRONG CSDL (CHỈ ĐƯỢC CHỌN TỪ DANH SÁCH NÀY) ===
{json.dumps(indexed_candidates, ensure_ascii=False)}

=== 5. CÂU HỎI / YÊU CẦU CỦA NGƯỜI DÙNG ===
"{question}"

=== QUY TẮC & CÔNG CỤ TRẢ VỀ (BẮT BUỘC TRẢ VỀ JSON HỢP LỆ) ===
1. Trả lời bằng tiếng Việt tự nhiên, thông minh, đi thẳng vào vấn đề, có nhắc tới ngữ cảnh thực tế của chuyến đi (ví dụ: nhận biết chuyến đi có {trip_summary['duration_days']} ngày, những ngày nào đang trống {empty_days}, hoặc những điểm nào đã có để tránh trùng lặp).
2. TUYỆT ĐỐI KHÔNG BỊA ĐỊA ĐIỂM ngoài danh sách `CANDIDATES` ở mục 4. Khi chọn địa điểm, hãy chỉ định đúng số nguyên `"idx"` từ danh sách ở mục 4.
3. Nếu người dùng yêu cầu gợi ý lịch trình (1 ngày, nhiều ngày, hoặc lấp đầy các ngày trống), HÃY thiết kế `"proposed_plan"` chi tiết cho các ngày đó (mỗi ngày 3-4 hoạt động Sáng / Trưa / Chiều / Tối + chỗ nghỉ nếu phù hợp), chỉ dùng `"idx"` có trong mục 4 và ưu tiên các điểm chưa có trong lịch trình (`in_trip == null`).
4. Chọn ra 3-8 địa điểm phù hợp nhất trong `"recommended_places"` kèm `"suggested_day"` (1..{trip_summary['duration_days']}) và `"role"` (`"place"` hoặc `"lodging"` nếu là khách sạn/homestay/accommodation) để người dùng có thể bấm thêm nhanh vào từng ngày.
5. Sinh `"tool_actions"` phù hợp với ngữ cảnh để người dùng thao tác 1 chạm trên màn hình Trip Planner:
   - Nếu chuyến đi chưa có điểm đến cố định (`destination` đang trống) và câu trả lời đang gợi ý cho khu vực `{effective_dest or "Hà Nội"}`, thêm action: `{{"type": "update_destination", "destination": "{effective_dest or 'Hà Nội'}", "label": "Đặt điểm đến: {effective_dest or 'Hà Nội'}"}}`.
   - Nếu có ngày đã có từ 2 địa điểm trở lên ({days_with_multiple_stops}) hoặc người dùng hỏi về đường đi/tối ưu, thêm action: `{{"type": "optimize_day", "day": <số ngày>, "label": "Tối ưu lộ trình Ngày <số ngày>"}}`.
   - Nếu đang có địa điểm chờ xếp ({len(unscheduled_names)} điểm) hoặc người dùng muốn tự phân bổ, thêm action: `{{"type": "auto_assign", "label": "Tự động phân bổ {len(unscheduled_names)} điểm chờ xếp"}}`.
   - Nếu người dùng hỏi cần chuẩn bị gì / checklist đồ mang theo (hoặc chuyến đi chưa có checklist và họ hỏi gợi ý chung), thêm action: `{{"type": "add_checklists", "items": ["CCCD / Giấy tờ tùy thân", "..."], "label": "Thêm danh sách đồ cần chuẩn bị"}}`.
   - Nếu người dùng muốn đặt/cập nhật ngân sách hoặc hỏi gợi ý chi phí, thêm action: `{{"type": "update_budget", "budget": <số tiền VND>, "label": "Đặt ngân sách dự kiến"}}`.
   - Nếu người dùng muốn lưu ghi chú, thêm action: `{{"type": "add_note", "day": <số ngày hoặc null>, "text": "<nội dung ghi chú>", "label": "Lưu vào Ghi chú"}}`.

Định dạng JSON trả về (chỉ trả JSON, không markdown):
{{
  "explanation": "Câu trả lời tư vấn chi tiết, bám sát ngữ cảnh chuyến đi...",
  "recommended_places": [
    {{
      "idx": 1,
      "suggested_day": 1,
      "role": "place",
      "reason": "Gợi ý buổi Sáng Ngày 1 — điểm tham quan nổi tiếng"
    }}
  ],
  "proposed_plan": [
    {{
      "day": 1,
      "title": "Tiêu đề Ngày 1",
      "activities": [
        {{
          "time": "Sáng",
          "idx": 1,
          "role": "place",
          "description": "Mô tả ngắn hoạt động"
        }}
      ]
    }}
  ],
  "tool_actions": [
    {{
      "type": "update_destination",
      "destination": "{effective_dest or 'Hà Nội'}",
      "label": "Đặt điểm đến: {effective_dest or 'Hà Nội'}"
    }}
  ]
}}
"""

    llm_data = {}
    with log_duration(logger, "DeepSeek xử lý Trip Planner AI"):
        raw_llm = query_llm(prompt, json_mode=True, temperature=0.25, timeout=settings.llm_timeout)
        if raw_llm:
            try:
                llm_data = json.loads(raw_llm)
            except Exception as exc:
                logger.warning("Không parse được JSON từ Trip Planner AI: %s", exc)

    # Ánh xạ recommended_places từ idx sang object địa điểm thực tế
    final_results = []
    seen_result_ids = set()
    for item in (llm_data.get("recommended_places") or []):
        if not isinstance(item, dict):
            continue
        c = by_idx.get(item.get("idx"))
        if not c:
            continue
        rid = str(c["id"])
        if rid in seen_result_ids:
            continue
        seen_result_ids.add(rid)
        enriched = dict(c)
        sug_day = item.get("suggested_day")
        if isinstance(sug_day, int) and 1 <= sug_day <= trip_summary["duration_days"]:
            enriched["suggested_day"] = sug_day
        else:
            enriched["suggested_day"] = empty_days[0] if empty_days else 1
        enriched["suggested_role"] = (
            "lodging"
            if item.get("role") == "lodging" or c.get("type") == "accommodation"
            else "place"
        )
        enriched["ai_reason"] = item.get("reason") or ""
        final_results.append(enriched)

    # Ánh xạ proposed_plan từ idx sang hoạt động thực tế
    proposed_plan = []
    for day_obj in (llm_data.get("proposed_plan") or []):
        if not isinstance(day_obj, dict):
            continue
        day_num = day_obj.get("day")
        if not isinstance(day_num, int) or day_num < 1 or day_num > max(trip_summary["duration_days"], 7):
            continue
        hydrated_acts = []
        seen_in_day = set()
        for act in (day_obj.get("activities") or []):
            if not isinstance(act, dict):
                continue
            c = by_idx.get(act.get("idx"))
            if not c:
                continue
            key = (c.get("type"), str(c.get("id")))
            if key in seen_in_day:
                continue
            seen_in_day.add(key)
            role = "lodging" if act.get("role") == "lodging" or c.get("type") == "accommodation" else "place"
            hydrated_acts.append({
                "time": act.get("time") or "Trong ngày",
                "description": act.get("description") or "",
                "role": role,
                "place": {
                    "id": c["id"],
                    "type": c["type"],
                    "name": c["name"],
                    "category": c.get("category"),
                    "dia_chi": c.get("dia_chi"),
                    "lon": c.get("lon"),
                    "lat": c.get("lat"),
                    "image_url": c.get("image_url"),
                },
            })
            # Đảm bảo địa điểm trong proposed_plan cũng xuất hiện trên bản đồ
            if str(c["id"]) not in seen_result_ids:
                seen_result_ids.add(str(c["id"]))
                final_results.append({
                    **c,
                    "suggested_day": day_num,
                    "suggested_role": role,
                    "ai_reason": f"{act.get('time') or 'Lịch trình'} Ngày {day_num}: {act.get('description') or ''}".strip(": "),
                })
        if hydrated_acts:
            proposed_plan.append({
                "day": day_num,
                "title": day_obj.get("title") or f"Lịch trình Ngày {day_num}",
                "activities": hydrated_acts,
            })

    # Nếu LLM không chọn recommended_places nhưng có candidates từ DB -> lấy top 6
    if not final_results and candidates:
        default_day = empty_days[0] if empty_days else 1
        for c in candidates[:6]:
            final_results.append({
                **c,
                "suggested_day": default_day,
                "suggested_role": "lodging" if c.get("type") == "accommodation" else "place",
                "ai_reason": f"Gợi ý cho Ngày {default_day}",
            })

    from app.shared.places import photos as photo_service
    if final_results:
        photo_service.ensure_places_photos(final_results)

    explanation = (llm_data.get("explanation") or "").strip()
    if not explanation:
        if tavily_answer:
            explanation = tavily_answer
        elif final_results:
            explanation = (
                f"Dựa trên chuyến đi \"{trip_summary['name']}\" ({trip_summary['duration_days']} ngày), "
                f"dưới đây là {len(final_results)} địa điểm phù hợp nhất để bạn thêm trực tiếp vào lịch trình:"
            )
        else:
            explanation = "Chưa tìm thấy địa điểm phù hợp với yêu cầu của bạn. Bạn hãy thử nói rõ tên thành phố/điểm đến nhé!"

    tool_actions = [
        a for a in (llm_data.get("tool_actions") or [])
        if isinstance(a, dict) and a.get("type")
    ]

    return {
        "success": True,
        "results": final_results,
        "proposed_plan": proposed_plan,
        "tool_actions": tool_actions,
        "effective_destination": effective_dest,
        "trip_summary": {
            "id": trip_summary["id"],
            "name": trip_summary["name"],
            "destination": trip_summary["destination"] or effective_dest,
            "duration_days": trip_summary["duration_days"],
            "empty_days": empty_days,
        },
        "anchor": {"name": effective_dest} if effective_dest else None,
        "keywords": question,
        "explanation": explanation,
        "sources": tavily_sources,
        "che_do": "planner_ai",
        "cac_buoc": [{"provider": "deepseek_planner_ai", "so_dong": len(final_results), "so_ngay_goi_y": len(proposed_plan)}],
    }


@router.post("/chat")
def chat(request: ChatRequest, raw_req: Request):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    lon, lat = request.user_lon, request.user_lat
    if lon is None or lat is None:
        lon, lat = geo.coords_from_ip(geo.get_client_ip(raw_req))

    logger.info("Câu hỏi: %r (vị trí %.4f, %.4f, itinerary_id=%s)",
                question[:120], lon, lat, request.itinerary_id)

    # Nếu gọi từ màn hình Trip Planner (có itinerary_id hoặc trip_context) -> Dùng Trip Planner AI
    if request.itinerary_id is not None or request.trip_context is not None:
        return _handle_planner_assistant(request, lon, lat)

    with log_duration(logger, "Tìm kiếm địa điểm"):
        res = search_agent.search(question, lon, lat,
                                  resolved_admin=request.resolved_admin)

    # Địa danh nhập nhằng: hỏi lại thay vì đoán bừa rồi trả kết quả sai tỉnh.
    if res.get("hoi_lai"):
        logger.info("Hỏi lại người dùng: %s", res["hoi_lai"])
        return {"success": True, "results": [], "anchor": None,
                "explanation": res["hoi_lai"],
                "candidates": res.get("candidates", []),
                "che_do": res.get("che_do")}

    results = res["results"]
    anchor = res.get("anchor")
    n = len(results)
    logger.info(
        "Tìm được %d địa điểm — cần tìm %r, mốc %s",
        n, res.get("keywords"), anchor["name"] if anchor else "(vị trí người dùng)",
        extra={"ctx_rows": n, "ctx_keywords": res.get("keywords"),
               "ctx_anchor": anchor["name"] if anchor else None},
    )

    from app.shared.places import photos as photo_service
    if results:
        photo_service.ensure_places_photos(results)

    # Nếu có câu trả lời thông minh từ Tavily (QA hoặc Web fallback)
    if res.get("answer"):
        explanation = res["answer"]
    elif n > 0:
        explanation = _tom_tat(results, anchor, res.get("trong_vung", False))
    else:
        logger.warning(
            "Không có kết quả — từ khoá %r, mốc %s",
            res.get("keywords"), anchor["name"] if anchor else None,
        )
        explanation = res.get("error") or (
            f"Không tìm thấy địa điểm nào phù hợp"
            + (f" gần {anchor['name']}" if anchor else " quanh vị trí của bạn")
            + "."
        )

    return {
        "success": True,
        "results": results,
        "anchor": anchor,
        "keywords": res.get("keywords"),
        "explanation": explanation,
        "sources": res.get("sources", []),
        "che_do": res.get("che_do"),
        "cac_buoc": res.get("cac_buoc"),
    }
