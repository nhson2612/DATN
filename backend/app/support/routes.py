"""API và WebSocket cho inbox hỗ trợ khách hàng."""

import asyncio
import json
from collections import defaultdict
from datetime import datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.database import execute_query, transaction
from app.core.logging import get_logger
from app.core.llm.adapter import query_llm, stream_llm
from app.core.security import get_current_operator, get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api/support", tags=["support"])
ws_router = APIRouter(tags=["support"])


class ConversationCreate(BaseModel):
    subject: str = Field(min_length=2, max_length=160)
    message: str = Field(min_length=1, max_length=4000)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ConversationUpdate(BaseModel):
    status: str = Field(pattern="^(OPEN|PENDING|CLOSED)$")


class TourSearchToolInput(BaseModel):
    """Schema tham số mà AI được phép truyền vào tool tìm tour."""

    query: str = Field(default="", max_length=120)
    departure_month: int | None = Field(default=None, ge=1, le=12)
    max_price: int | None = Field(default=None, ge=100000)


class ConnectionHub:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, key: str, websocket: WebSocket):
        await websocket.accept()
        self.connections[key].add(websocket)

    def disconnect(self, key: str, websocket: WebSocket):
        self.connections[key].discard(websocket)
        if not self.connections[key]:
            self.connections.pop(key, None)

    async def emit(self, keys: list[str], event: dict):
        payload = json.dumps(event, default=str)
        for key in keys:
            for socket in list(self.connections.get(key, set())):
                try:
                    await socket.send_text(payload)
                except Exception:
                    self.disconnect(key, socket)


hub = ConnectionHub()


def _row(query, params):
    rows = execute_query(query, params) or []
    return rows[0] if rows else None


def _conversation(conversation_id: int):
    return _row(
        """SELECT c.*, u.full_name AS customer_name, u.email AS customer_email,
                  o.user_id AS operator_user_id, o.company_name
           FROM support_conversations c JOIN users u ON u.id=c.user_id
           JOIN operators o ON o.id=c.operator_id WHERE c.id=%s""",
        (conversation_id,),
    )


def _assert_customer(conversation, user):
    if not conversation or conversation["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")


def _assert_operator(conversation, operator):
    if not conversation or conversation["operator_id"] != operator["operator_id"]:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")


async def _notify(conversation, kind: str, message=None):
    await hub.emit(
        [f"user:{conversation['user_id']}", f"operator:{conversation['operator_id']}"],
        {"type": kind, "conversation_id": conversation["id"], "message": message},
    )


def _select_tour_search_input(customer_text: str) -> TourSearchToolInput | None:
    """AI chọn tham số tool; mã ứng dụng chỉ validate và thực thi read-only."""
    raw = query_llm(
        customer_text,
        system_prompt=(
            "Chọn tham số cho tool search_tours từ yêu cầu khách du lịch. "
            "Trả về JSON duy nhất theo schema: {\"query\": string, \"departure_month\": integer|null}. "
            "query là tên điểm đến hoặc cụm tên tour ngắn, không được chứa ngày, tháng, số khách hay cả câu yêu cầu. "
            "departure_month là tháng khách nêu rõ, nếu không có thì null."
        ),
        json_mode=True,
        temperature=0,
        timeout=10,
    )
    try:
        return TourSearchToolInput.model_validate(json.loads(raw))
    except (TypeError, ValueError):
        return None


def _format_vnd(amount: int | float | None) -> str:
    if amount is None:
        return "Liên hệ"
    try:
        return f"{int(amount):,}".replace(",", ".") + " VND"
    except Exception:
        return f"{amount} VND"


def _search_tours_for_ai(tool_input: TourSearchToolInput | None):
    """Tool read-only: chỉ nhận input đã qua schema, không nhận SQL từ AI."""
    if not tool_input:
        return []
    return execute_query(
        """SELECT t.name, t.duration_days,
                  COUNT(d.id) FILTER (
                      WHERE d.status='OPEN'
                        AND (%s IS NULL OR EXTRACT(MONTH FROM d.depart_date)=%s)
                  ) AS matching_departures
           FROM tours t
           LEFT JOIN tour_departures d ON d.tour_id=t.id
           WHERE t.active AND t.name ILIKE %s
           GROUP BY t.id, t.name, t.duration_days
           ORDER BY matching_departures DESC, t.id DESC
           LIMIT 3""",
        (tool_input.departure_month, tool_input.departure_month, f"%{tool_input.query}%"),
    ) or []


def _load_active_tours_catalog() -> list[dict]:
    """Truy vấn trực tiếp toàn bộ danh sách tour đang mở bán từ CSDL, sắp xếp theo giá tăng dần."""
    rows = execute_query(
        """SELECT t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                  t.highlights, t.itinerary, t.included, t.excluded, t.transportation,
                  t.cancellation_policy,
                  COALESCE(p.name, '') AS province_name,
                  COUNT(d.id) FILTER (WHERE d.status='OPEN') AS open_departures,
                  ARRAY_REMOVE(ARRAY_AGG(
                      CASE WHEN d.status='OPEN' THEN TO_CHAR(d.depart_date, 'DD/MM/YYYY') END
                      ORDER BY d.depart_date
                  ), NULL) AS next_departures
           FROM tours t
           LEFT JOIN provinces_clean p ON p.id = t.province_id
           LEFT JOIN tour_departures d ON d.tour_id = t.id
           WHERE t.active = TRUE
           GROUP BY t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                    t.highlights, t.itinerary, t.included, t.excluded, t.transportation,
                    t.cancellation_policy, p.name
           ORDER BY t.price_from ASC NULLS LAST, t.id ASC""",
        (),
    ) or []

    catalog = []
    for r in rows:
        itinerary_days = []
        raw_itin = r.get("itinerary") or []
        if isinstance(raw_itin, list):
            for day_item in raw_itin:
                if isinstance(day_item, dict):
                    d_num = day_item.get("day", "")
                    d_title = day_item.get("title", "")
                    itinerary_days.append(f"Ngày {d_num}: {d_title}")
        catalog.append({
            "id": r["id"],
            "name": r["name"],
            "url": f"/tours/{r['slug'] or r['id']}",
            "price_vnd": int(r["price_from"] or 0),
            "price_formatted": _format_vnd(r.get("price_from")),
            "duration": f"{r['duration_days']} ngày {max(0, int(r['duration_days']) - 1)} đêm",
            "province": r.get("province_name") or "",
            "departure_location": r.get("departure_location") or "",
            "highlights": (r.get("highlights") or [])[:5],
            "itinerary_summary": itinerary_days,
            "included": (r.get("included") or [])[:5],
            "transportation": r.get("transportation") or [],
            "open_departures": r.get("open_departures", 0),
            "next_departures": (r.get("next_departures") or [])[:3],
        })
    return catalog


def _load_customer_bookings(user_id: int) -> list[dict]:
    """Truy vấn đơn đặt tour thực tế của khách hàng từ CSDL."""
    rows = execute_query(
        """SELECT b.code, b.status, b.total_price, b.guests, b.created_at,
                  t.name AS tour_name, t.slug AS tour_slug,
                  t.departure_location,
                  d.depart_date
           FROM tour_bookings b
           LEFT JOIN tours t ON t.id = b.tour_id
           LEFT JOIN tour_departures d ON d.id = b.departure_id
           WHERE b.user_id = %s
           ORDER BY b.created_at DESC
           LIMIT 5""",
        (user_id,),
    ) or []
    return [
        {
            "booking_code": r["code"],
            "status": r["status"],
            "tour_name": r.get("tour_name") or "",
            "tour_url": f"/tours/{r['tour_slug']}" if r.get("tour_slug") else None,
            "depart_date": r["depart_date"].strftime("%d/%m/%Y") if r.get("depart_date") else None,
            "guests": r.get("guests", 1),
            "total_price": _format_vnd(r.get("total_price")),
            "departure_location": r.get("departure_location") or "",
        }
        for r in rows
    ]


def _auto_link_tours(text: str, tours: list[dict]) -> str:
    """Chuẩn hóa link markdown về đúng đường dẫn nội bộ /tours/{slug} cho mọi tour được nhắc tên."""
    if not text or not tours:
        return text
    result = text
    import re
    for t in tours:
        name = t.get("name")
        url = t.get("url")
        if name and url:
            # Nếu LLM đã bọc [name](bất_kỳ_url_nào) -> ép về đúng url nội bộ trong DB
            linked_pattern = re.compile(rf'\[{re.escape(name)}\]\([^)]+\)')
            result = linked_pattern.sub(f'[{name}]({url})', result)
            # Nếu LLM chưa bọc link -> tự động bọc [name](url)
            unlinked_pattern = re.compile(rf'(?<!\[){re.escape(name)}(?!\]\()')
            result = unlinked_pattern.sub(f'[{name}]({url})', result)
    return result


def _build_ai_prompt_and_context(conversation: dict):
    """Đọc dữ liệu thực từ CSDL (danh sách tour đang mở bán & đơn đặt của khách) và đưa cho LLM."""
    history = execute_query(
        "SELECT sender_role, body FROM support_messages WHERE conversation_id=%s ORDER BY created_at DESC,id DESC LIMIT 8",
        (conversation["id"],),
    ) or []

    tours = _load_active_tours_catalog()
    bookings = _load_customer_bookings(conversation["user_id"])

    context = "\n".join(f"{message['sender_role']}: {message['body']}" for message in reversed(history))
    system_prompt = (
        "Bạn là trợ lý tư vấn du lịch của sàn Aura Voyage.\n"
        "Dưới đây là dữ liệu thực tế từ cơ sở dữ liệu hệ thống:\n\n"
        "1. DANH SÁCH TẤT CẢ CÁC TOUR ĐANG MỞ BÁN (đã sắp xếp theo giá `price_vnd` từ thấp nhất đến cao nhất):\n"
        f"{json.dumps(tours, default=str, ensure_ascii=False)}\n\n"
        "2. ĐƠN ĐẶT TOUR CỦA KHÁCH HÀNG HIỆN TẠI:\n"
        f"{json.dumps(bookings, default=str, ensure_ascii=False)}\n\n"
        "Hướng dẫn trả lời:\n"
        "- Trả lời trực tiếp câu hỏi của khách hàng dựa trên danh sách tour và đơn đặt tour thực tế ở trên.\n"
        "- Khi nêu tên một tour, bọc tên tour trong markdown link: [Tên tour](url) và ghi rõ mức giá `price_formatted`.\n"
        "- Nếu khách hỏi checklist chuẩn bị đồ, trình bày từng dòng bằng cú pháp `- [ ] Tên món đồ`.\n"
        "- Trả lời tự nhiên, ngắn gọn, chính xác bằng tiếng Việt."
    )
    return context, system_prompt, tours


def _answer_with_ai(conversation: dict) -> str:
    """Trả lời bằng ngữ cảnh read-only của đúng khách trong hội thoại."""
    context, system_prompt, tours = _build_ai_prompt_and_context(conversation)
    raw = query_llm(
        context,
        system_prompt=system_prompt,
        temperature=0.2,
        timeout=25,
    )
    return _auto_link_tours(raw, tours)


async def _auto_reply_if_enabled(conversation: dict):
    """AI chỉ gửi khi operator chưa nhận hội thoại; khoá hàng để tránh race."""
    if not conversation.get("ai_auto_reply", True):
        return None
    draft = await asyncio.to_thread(_answer_with_ai, conversation)
    if not draft:
        return None
    with transaction() as tx:
        current = tx.execute(
            "SELECT ai_auto_reply FROM support_conversations WHERE id=%s FOR UPDATE",
            (conversation["id"],),
        )[0]
        if not current["ai_auto_reply"]:
            return None
        message = tx.execute(
            """INSERT INTO support_messages (conversation_id, sender_id, sender_role, body)
               VALUES (%s, NULL, 'assistant', %s) RETURNING *""",
            (conversation["id"], draft.strip()),
        )[0]
        tx.execute(
            "UPDATE support_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=%s",
            (conversation["id"],),
        )
    await _notify(conversation, "message.created", message)
    return message


@router.post("/conversations")
async def create_conversation(data: ConversationCreate, user: dict = Depends(get_current_user)):
    operator = _row("SELECT id FROM operators WHERE status='ACTIVE' ORDER BY id LIMIT 1", ())
    if not operator:
        raise HTTPException(status_code=503, detail="Chưa có nhân viên trực hỗ trợ.")
    # `execute_query` lấy một connection riêng cho từng câu. Hai INSERT phải
    # chạy cùng transaction: conversation dùng RETURNING, rồi message tham
    # chiếu khóa ngoại tới nó.
    with transaction() as tx:
        conversation = tx.execute(
            """INSERT INTO support_conversations (user_id, operator_id, subject, status, updated_at)
               VALUES (%s,%s,%s,'OPEN',CURRENT_TIMESTAMP) RETURNING *""",
            (user["id"], operator["id"], data.subject.strip()),
        )[0]
        message = tx.execute(
            """INSERT INTO support_messages (conversation_id, sender_id, sender_role, body)
               VALUES (%s,%s,'customer',%s) RETURNING *""",
            (conversation["id"], user["id"], data.message.strip()),
        )[0]
    full = _conversation(conversation["id"])
    await _notify(full, "conversation.created", message)
    assistant_message = await _auto_reply_if_enabled(full)
    return {"success": True, "conversation": full, "message": message, "assistant_message": assistant_message}


@router.post("/conversations/stream")
async def create_conversation_stream(data: ConversationCreate, user: dict = Depends(get_current_user)):
    operator = _row("SELECT id FROM operators WHERE status='ACTIVE' ORDER BY id LIMIT 1", ())
    if not operator:
        raise HTTPException(status_code=503, detail="Chưa có nhân viên trực hỗ trợ.")
    with transaction() as tx:
        conversation = tx.execute(
            """INSERT INTO support_conversations (user_id, operator_id, subject, status, updated_at)
               VALUES (%s,%s,%s,'OPEN',CURRENT_TIMESTAMP) RETURNING *""",
            (user["id"], operator["id"], data.subject.strip()),
        )[0]
        message = tx.execute(
            """INSERT INTO support_messages (conversation_id, sender_id, sender_role, body)
               VALUES (%s,%s,'customer',%s) RETURNING *""",
            (conversation["id"], user["id"], data.message.strip()),
        )[0]
    full = _conversation(conversation["id"])
    await _notify(full, "conversation.created", message)

    async def sse_generator():
        yield f"data: {json.dumps({'type': 'init', 'conversation': full, 'message': message}, default=str, ensure_ascii=False)}\n\n"
        context, system_prompt, tours = await asyncio.to_thread(_build_ai_prompt_and_context, full)
        collected_chunks = []
        try:
            for chunk in stream_llm(context, system_prompt, temperature=0.2, timeout=30):
                collected_chunks.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
        except Exception as e:
            logger.error("Lỗi streaming LLM: %s", e)

        full_reply = "".join(collected_chunks).strip()
        full_reply = _auto_link_tours(full_reply, tours)
        if full_reply:
            with transaction() as tx:
                assistant_message = tx.execute(
                    """INSERT INTO support_messages (conversation_id, sender_id, sender_role, body)
                       VALUES (%s, NULL, 'assistant', %s) RETURNING *""",
                    (full["id"], full_reply),
                )[0]
                tx.execute(
                    "UPDATE support_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                    (full["id"],),
                )
            await _notify(full, "message.created", assistant_message)
            yield f"data: {json.dumps({'type': 'done', 'assistant_message': assistant_message}, default=str, ensure_ascii=False)}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'done', 'assistant_message': None}, ensure_ascii=False)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.get("/conversations/me")
def my_conversations(user: dict = Depends(get_current_user)):
    rows = execute_query(
        """SELECT c.*, o.company_name, (SELECT body FROM support_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,id DESC LIMIT 1) AS preview
           FROM support_conversations c JOIN operators o ON o.id=c.operator_id
           WHERE c.user_id=%s ORDER BY c.updated_at DESC""", (user["id"],)
    ) or []
    return {"success": True, "conversations": rows}


@router.get("/inbox")
def inbox(status: str | None = Query(None, pattern="^(OPEN|PENDING|CLOSED)$"), operator: dict = Depends(get_current_operator)):
    where = "c.operator_id=%s" + (" AND c.status=%s" if status else "")
    params = (operator["operator_id"], status) if status else (operator["operator_id"],)
    rows = execute_query(
        f"""SELECT c.*, u.full_name AS customer_name, u.email AS customer_email,
                  (SELECT body FROM support_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,id DESC LIMIT 1) AS preview,
                  (SELECT count(*) FROM support_messages m
                   WHERE m.conversation_id=c.id AND m.sender_role='customer'
                     AND (c.last_operator_read_at IS NULL OR m.created_at>c.last_operator_read_at)) AS unread_count
             FROM support_conversations c JOIN users u ON u.id=c.user_id WHERE {where}
             ORDER BY c.updated_at DESC""", params
    ) or []
    return {"success": True, "conversations": rows}


@router.get("/conversations/{conversation_id}/messages")
def messages(conversation_id: int, user: dict = Depends(get_current_user)):
    conversation = _conversation(conversation_id)
    allowed = conversation and (conversation["user_id"] == user["id"] or (user["role"] == "operator" and conversation["operator_user_id"] == user["id"]))
    if not allowed:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")
    if user["role"] == "operator":
        execute_query("UPDATE support_conversations SET last_operator_read_at=CURRENT_TIMESTAMP WHERE id=%s", (conversation_id,))
    rows = execute_query("SELECT * FROM support_messages WHERE conversation_id=%s ORDER BY created_at,id", (conversation_id,)) or []
    return {"success": True, "conversation": conversation, "messages": rows}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: int, data: MessageCreate, user: dict = Depends(get_current_user)):
    conversation = _conversation(conversation_id)
    is_operator = user["role"] == "operator" and conversation and conversation["operator_user_id"] == user["id"]
    is_customer = conversation and conversation["user_id"] == user["id"]
    if not (is_customer or is_operator):
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")
    role = "operator" if is_operator else "customer"
    status = "PENDING" if is_operator else "OPEN"
    with transaction() as tx:
        message = tx.execute(
            "INSERT INTO support_messages (conversation_id,sender_id,sender_role,body) VALUES (%s,%s,%s,%s) RETURNING *",
            (conversation_id, user["id"], role, data.body.strip()),
        )[0]
        if is_operator:
            # Dù operator quên bấm nút nhận chat, tin nhắn người thật vẫn phải
            # chấm dứt chế độ AI để hai bên không cùng trả lời khách.
            tx.execute(
                """UPDATE support_conversations
                   SET ai_auto_reply=FALSE,
                       human_joined_at=COALESCE(human_joined_at, CURRENT_TIMESTAMP),
                       status=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s""",
                (status, conversation_id),
            )
        else:
            tx.execute(
                "UPDATE support_conversations SET status=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                (status, conversation_id),
            )
    await _notify(conversation, "message.created", message)
    assistant_message = await _auto_reply_if_enabled(conversation) if is_customer else None
    return {"success": True, "message": message, "assistant_message": assistant_message}


@router.post("/conversations/{conversation_id}/messages/stream")
async def send_message_stream(conversation_id: int, data: MessageCreate, user: dict = Depends(get_current_user)):
    conversation = _conversation(conversation_id)
    is_customer = conversation and conversation["user_id"] == user["id"]
    if not is_customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")

    with transaction() as tx:
        message = tx.execute(
            "INSERT INTO support_messages (conversation_id,sender_id,sender_role,body) VALUES (%s,%s,'customer',%s) RETURNING *",
            (conversation_id, user["id"], data.body.strip()),
        )[0]
        tx.execute(
            "UPDATE support_conversations SET status='OPEN', updated_at=CURRENT_TIMESTAMP WHERE id=%s",
            (conversation_id,),
        )
    await _notify(conversation, "message.created", message)

    async def sse_generator():
        yield f"data: {json.dumps({'type': 'init', 'message': message}, default=str, ensure_ascii=False)}\n\n"
        context, system_prompt, tours = await asyncio.to_thread(_build_ai_prompt_and_context, conversation)
        collected_chunks = []
        try:
            for chunk in stream_llm(context, system_prompt, temperature=0.2, timeout=30):
                collected_chunks.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
        except Exception as e:
            logger.error("Lỗi streaming LLM: %s", e)

        full_reply = "".join(collected_chunks).strip()
        full_reply = _auto_link_tours(full_reply, tours)
        if full_reply:
            with transaction() as tx:
                assistant_message = tx.execute(
                    """INSERT INTO support_messages (conversation_id, sender_id, sender_role, body)
                       VALUES (%s, NULL, 'assistant', %s) RETURNING *""",
                    (conversation_id, full_reply),
                )[0]
                tx.execute(
                    "UPDATE support_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                    (conversation_id,),
                )
            await _notify(conversation, "message.created", assistant_message)
            yield f"data: {json.dumps({'type': 'done', 'assistant_message': assistant_message}, default=str, ensure_ascii=False)}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'done', 'assistant_message': None}, ensure_ascii=False)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.put("/conversations/{conversation_id}")
async def update_conversation(conversation_id: int, data: ConversationUpdate, operator: dict = Depends(get_current_operator)):
    conversation = _conversation(conversation_id)
    _assert_operator(conversation, operator)
    with transaction() as tx:
        updated = tx.execute(
            "UPDATE support_conversations SET status=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s RETURNING *",
            (data.status, conversation_id),
        )[0]
    await _notify(conversation, "conversation.updated", updated)
    return {"success": True, "conversation": updated}


@router.post("/conversations/{conversation_id}/take-over")
async def take_over_conversation(conversation_id: int, operator: dict = Depends(get_current_operator)):
    """Người trực nhận chat: AI dừng trả lời tự động cho toàn bộ phần còn lại."""
    conversation = _conversation(conversation_id)
    _assert_operator(conversation, operator)
    with transaction() as tx:
        updated = tx.execute(
            """UPDATE support_conversations
               SET ai_auto_reply=FALSE, human_joined_at=CURRENT_TIMESTAMP,
                   status='PENDING', updated_at=CURRENT_TIMESTAMP
               WHERE id=%s RETURNING *""",
            (conversation_id,),
        )[0]
    await _notify(conversation, "conversation.taken_over", updated)
    return {"success": True, "conversation": updated}


@router.post("/conversations/{conversation_id}/ai-draft")
def ai_draft(conversation_id: int, operator: dict = Depends(get_current_operator)):
    conversation = _conversation(conversation_id)
    _assert_operator(conversation, operator)
    draft = _answer_with_ai(conversation)
    return {"success": True, "draft": draft or "Mình đã nhận được yêu cầu. Nhân viên sẽ kiểm tra và phản hồi sớm nhất."}


@router.post("/conversations/{conversation_id}/ai-draft/stream")
async def ai_draft_stream(conversation_id: int, operator: dict = Depends(get_current_operator)):
    conversation = _conversation(conversation_id)
    _assert_operator(conversation, operator)

    async def sse_generator():
        context, system_prompt, tours = await asyncio.to_thread(_build_ai_prompt_and_context, conversation)
        collected_chunks = []
        try:
            for chunk in stream_llm(context, system_prompt, temperature=0.2, timeout=30):
                collected_chunks.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)
        except Exception as e:
            logger.error("Lỗi streaming AI draft: %s", e)

        full_draft = _auto_link_tours("".join(collected_chunks).strip(), tours)
        yield f"data: {json.dumps({'type': 'done', 'draft': full_draft}, ensure_ascii=False)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@ws_router.websocket("/ws/support")
async def support_websocket(websocket: WebSocket, token: str):
    try:
        email = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]).get("sub")
        user = _row("SELECT id,email,role FROM users WHERE email=%s", (email,))
        if not user or user["role"] == "admin":
            await websocket.close(code=1008)
            return
        key = f"user:{user['id']}"
        if user["role"] == "operator":
            op = _row("SELECT id FROM operators WHERE user_id=%s AND status='ACTIVE'", (user["id"],))
            if not op:
                await websocket.close(code=1008)
                return
            key = f"operator:{op['id']}"
    except Exception:
        await websocket.close(code=1008)
        return
    await hub.connect(key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(key, websocket)
