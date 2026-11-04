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


POPULAR_DESTINATIONS = [
    "đà nẵng", "hà nội", "sapa", "hạ long", "đà lạt", "phú quốc", "nha trang",
    "hồ chí minh", "sài gòn", "huế", "hội an", "quy nhơn", "phan thiết",
    "vũng tàu", "ninh bình", "hà giang", "mộc châu", "côn đảo", "lan hạ",
    "bà nà", "fansipan", "quảng ninh", "lào cai", "khánh hòa", "lâm đồng"
]


def _select_tour_search_input(customer_text: str) -> TourSearchToolInput | None:
    """Trích xuất tham số tìm tour tức thì (0.1ms) không block luồng stream."""
    if not customer_text or len(customer_text.strip()) < 2:
        return None

    t = customer_text.lower().strip()
    import re

    # 1. Tháng khởi hành
    month_match = re.search(r"tháng\s*(\d{1,2})", t)
    month = int(month_match.group(1)) if month_match and 1 <= int(month_match.group(1)) <= 12 else None

    # 2. Ngân sách tối đa
    price = None
    price_match = re.search(r"(\d+)\s*(tr|triệu)", t)
    if price_match:
        price = int(price_match.group(1)) * 1_000_000
    else:
        k_match = re.search(r"(\d+)\s*k\b", t)
        if k_match:
            price = int(k_match.group(1)) * 1_000

    # 3. Điểm đến (Hỗ trợ nhiều điểm đến cùng lúc để so sánh 2-3 tour)
    matched_dests = [d for d in POPULAR_DESTINATIONS if d in t]
    dest = "|".join(matched_dests[:3]) if matched_dests else ""

    # Nếu không trùng danh mục sẵn có và cũng không có ngân sách, lấy từ khóa chính
    if not dest and not price:
        filler = ["so sánh", "gợi ý", "cho tôi", "cho mình", "tìm tour", "tour", "du lịch", "có", "nào", "không", "giá rẻ", "tiết kiệm", "với", "ạ", "nhé", "ơi"]
        clean = t
        for w in filler:
            clean = re.sub(rf"\b{re.escape(w)}\b", "", clean)
        clean = re.sub(r"\s+", " ", clean).strip()
        dest = clean[:40]

    return TourSearchToolInput(query=dest, departure_month=month, max_price=price)


def _format_vnd(amount: int | float | None) -> str:
    if amount is None:
        return "Liên hệ"
    try:
        return f"{int(amount):,}".replace(",", ".") + " VND"
    except Exception:
        return f"{amount} VND"


def _search_tours_for_ai(tool_input: TourSearchToolInput | None):
    """Tool read-only: tìm kiếm tour chi tiết kèm lịch trình, dịch vụ bao gồm, phương tiện để hỗ trợ gợi ý & so sánh tour."""
    if not tool_input:
        return []
    raw_q = tool_input.query.strip()
    # Hỗ trợ regex pattern cho nhiều điểm đến (ví dụ 'sapa|hạ long') hoặc rỗng để lấy tất cả
    pattern = raw_q if raw_q else ".*"
    rows = execute_query(
        """SELECT t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                  t.highlights, t.itinerary, t.included, t.excluded, t.transportation, t.tags,
                  COALESCE(p.name, '') AS province_name,
                  COUNT(d.id) FILTER (
                      WHERE d.status='OPEN'
                        AND (%s::int IS NULL OR EXTRACT(MONTH FROM d.depart_date)=%s)
                  ) AS matching_departures,
                  ARRAY_REMOVE(ARRAY_AGG(
                      CASE WHEN d.status='OPEN' THEN TO_CHAR(d.depart_date, 'DD/MM/YYYY') END
                      ORDER BY d.depart_date
                  ), NULL) AS next_departures
           FROM tours t
           LEFT JOIN provinces_clean p ON p.id = t.province_id
           LEFT JOIN tour_departures d ON d.tour_id = t.id
           WHERE t.active
             AND (
                 %s = '.*'
                 OR t.name ~* %s
                 OR t.summary ~* %s
                 OR COALESCE(p.name, '') ~* %s
             )
             AND (%s::int IS NULL OR t.price_from <= %s)
           GROUP BY t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                    t.highlights, t.itinerary, t.included, t.excluded, t.transportation, t.tags, p.name
           ORDER BY matching_departures DESC, t.id DESC
           LIMIT 6""",
        (
            tool_input.departure_month, tool_input.departure_month,
            pattern, pattern, pattern, pattern,
            tool_input.max_price, tool_input.max_price,
        ),
    ) or []

    # Nếu truy vấn quá hẹp không khớp tour nào, lấy danh sách 5 tour nổi bật để luôn có dữ liệu đối chiếu/so sánh
    if not rows:
        rows = execute_query(
            """SELECT t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                      t.highlights, t.itinerary, t.included, t.excluded, t.transportation, t.tags,
                      COALESCE(p.name, '') AS province_name,
                      COUNT(d.id) FILTER (WHERE d.status='OPEN') AS matching_departures,
                      ARRAY_REMOVE(ARRAY_AGG(
                          CASE WHEN d.status='OPEN' THEN TO_CHAR(d.depart_date, 'DD/MM/YYYY') END
                          ORDER BY d.depart_date
                      ), NULL) AS next_departures
               FROM tours t
               LEFT JOIN provinces_clean p ON p.id = t.province_id
               LEFT JOIN tour_departures d ON d.tour_id = t.id
               WHERE t.active
               GROUP BY t.id, t.slug, t.name, t.duration_days, t.price_from, t.departure_location,
                        t.highlights, t.itinerary, t.included, t.excluded, t.transportation, t.tags, p.name
               ORDER BY matching_departures DESC, t.id DESC
               LIMIT 5""",
            (),
        ) or []

    formatted = []
    for r in rows:
        itinerary_days = []
        raw_itin = r.get("itinerary") or []
        if isinstance(raw_itin, list):
            for day_item in raw_itin:
                if isinstance(day_item, dict):
                    d_num = day_item.get("day", "")
                    d_title = day_item.get("title", "")
                    itinerary_days.append(f"Ngày {d_num}: {d_title}")
        formatted.append({
            "name": r["name"],
            "url": f"/tours/{r['slug'] or r['id']}",
            "price_formatted": _format_vnd(r.get("price_from")),
            "price_from_vnd": r.get("price_from"),
            "duration_days": f"{r['duration_days']} ngày {max(0, int(r['duration_days']) - 1)} đêm",
            "departure_location": r.get("departure_location") or "Xem chi tiết",
            "highlights": (r.get("highlights") or [])[:5],
            "itinerary_summary": itinerary_days,
            "included": (r.get("included") or [])[:5],
            "excluded": (r.get("excluded") or [])[:3],
            "transportation": r.get("transportation") or ["Xe du lịch"],
            "next_departures": (r.get("next_departures") or [])[:3],
            "open_departures": r.get("matching_departures", 0),
        })
    return formatted


def _get_weather_and_season_advice(customer_text: str) -> dict:
    """Tool Giai đoạn 1: Dự báo khí hậu, nhiệt độ & lời khuyên thời điểm theo điểm đến."""
    t = (customer_text or "").lower()
    climate_db = {
        "sapa": {
            "destination": "Sa Pa (Lào Cai)",
            "temperature": "12°C – 20°C (Ban đêm se lạnh 8°C – 12°C)",
            "weather_status": "Trời se lạnh, sáng sớm có sương mù và biển mây trên đỉnh Fansipan.",
            "best_season": "Tháng 9 – Tháng 11 (mùa lúa chín & săn mây), Tháng 12 – Tháng 2 (mùa hoa anh đào & băng tuyết).",
            "alert": "Mang theo áo phao/áo giữ nhiệt, giày chống trơn trượt vì sương ẩm.",
        },
        "fansipan": {
            "destination": "Đỉnh Fansipan – Sa Pa",
            "temperature": "6°C – 14°C trên đỉnh núi",
            "weather_status": "Gió nhẹ, tầm nhìn quang đãng vào buổi sáng (7h00 – 10h00).",
            "best_season": "Tháng 10 – Tháng 12 là thời điểm săn biển mây đẹp nhất.",
            "alert": "Nhiệt độ trên đỉnh 3.143m thấp hơn thị trấn khoảng 6-8°C, cần găng tay và mũ len.",
        },
        "đà nẵng": {
            "destination": "Đà Nẵng & Bà Nà Hills",
            "temperature": "24°C – 31°C (Bà Nà Hills mát mẻ 18°C – 22°C)",
            "weather_status": "Ban ngày nắng đẹp tại biển Mỹ Khê, trên đỉnh Bà Nà có sương nhẹ chiều tối.",
            "best_season": "Tháng 3 – Tháng 8 (mùa biển êm, nắng vàng), mùa thu đông mát mẻ.",
            "alert": "Đem theo cả đồ bơi tắm biển Mỹ Khê và 1 áo khoác mỏng khi lên Cầu Vàng – Bà Nà.",
        },
        "hạ long": {
            "destination": "Vịnh Hạ Long & Vịnh Lan Hạ",
            "temperature": "21°C – 27°C",
            "weather_status": "Biển êm, gió mát trên vịnh, rất thuận lợi cho du thuyền ngủ đêm và chèo Kayak.",
            "best_season": "Tháng 10 – Tháng 4 (tiết trời thu đông dịu mát) và Tháng 5 – Tháng 8 (mùa hè tắm biển).",
            "alert": "Buổi tối trên boong du thuyền có gió biển se lạnh, nên mang áo khoác nhẹ.",
        },
        "đà lạt": {
            "destination": "Đà Lạt (Lâm Đồng)",
            "temperature": "15°C – 23°C",
            "weather_status": "Không khí cao nguyên trong lành, sáng sớm và tối se lạnh.",
            "best_season": "Tháng 10 – Tháng 3 (mùa hoa dã quỳ, cỏ hồng, mai anh đào và săn mây).",
            "alert": "Chuẩn bị áo len, khăn choàng và ô gấp gọn.",
        },
        "nha trang": {
            "destination": "Nha Trang (Khánh Hòa)",
            "temperature": "25°C – 31°C",
            "weather_status": "Nắng ấm, nước biển trong xanh tại khu bảo tồn Hòn Mun (tầm nhìn lặn san hô 10–15m).",
            "best_season": "Tháng 2 – Tháng 9 (nắng đẹp, biển lặng thích hợp đi cano đảo).",
            "alert": "Mang kem chống nắng SPF 50+, kính râm và túi chống nước cho điện thoại.",
        },
        "phú quốc": {
            "destination": "Đảo Ngọc Phú Quốc",
            "temperature": "26°C – 31°C",
            "weather_status": "Trời nắng trong, biển Bãi Sao & Hòn Thơm êm dịu, hoàng hôn rất đẹp.",
            "best_season": "Tháng 11 – Tháng 4 năm sau (mùa khô, biển lặng như hồ).",
            "alert": "Rất lý tưởng để đi cáp treo Hòn Thơm và lặn ngắm san hô.",
        },
        "hà nội": {
            "destination": "Thủ đô Hà Nội",
            "temperature": "20°C – 27°C",
            "weather_status": "Tiết trời dịu mát, nắng thu vàng nhẹ quanh Hồ Gươm & Phố Cổ.",
            "best_season": "Tháng 9 – Tháng 12 (mùa thu – đầu đông lãng mạn, mùa cốm mới).",
            "alert": "Giày đi bộ êm chân để dạo Phố Cổ và Văn Miếu.",
        },
        "sài gòn": {
            "destination": "TP. Hồ Chí Minh (Sài Gòn)",
            "temperature": "27°C – 33°C",
            "weather_status": "Nắng ấm ban ngày, buổi tối mát mẻ nhộn nhịp quanh Bến Bạch Đằng & Phố đi bộ.",
            "best_season": "Quanh năm, đặc biệt đẹp từ Tháng 11 – Tháng 4 (mùa khô).",
            "alert": "Trang phục thoáng mát, mang theo kính mát và nón.",
        },
    }
    for key, info in climate_db.items():
        if key in t:
            return info
    return {
        "general_climate": "Thời tiết các vùng du lịch trọng điểm đang thuận lợi: Miền Bắc & Sapa/Đà Lạt se lạnh săn mây đẹp (14-24°C); Phú Quốc, Nha Trang, Đà Nẵng nắng ấm (25-31°C).",
    }


def _get_customer_bookings_and_reminders(user_id: int) -> list[dict]:
    """Tool Giai đoạn 2: Tra cứu đơn đặt tour kèm ngày khởi hành, điểm tập trung & nhắc lịch tự động."""
    rows = execute_query(
        """SELECT b.code, b.status, b.total_price, b.guests, b.created_at,
                  t.name AS tour_name, t.slug AS tour_slug, t.duration_days,
                  t.departure_location, t.transportation,
                  d.depart_date
           FROM tour_bookings b
           LEFT JOIN tours t ON t.id = b.tour_id
           LEFT JOIN tour_departures d ON d.id = b.departure_id
           WHERE b.user_id = %s
           ORDER BY b.created_at DESC
           LIMIT 4""",
        (user_id,),
    ) or []
    result = []
    today = datetime.now().date()
    for r in rows:
        depart_date = r.get("depart_date")
        days_left = None
        reminder = "Vui lòng mang theo CCCD/Hộ chiếu gốc và có mặt tại điểm hẹn trước 30 phút."
        if depart_date:
            try:
                days_left = (depart_date - today).days
                if 0 <= days_left <= 7:
                    reminder = (
                        f"SẮP KHỞI HÀNH (còn {days_left} ngày - {depart_date.strftime('%d/%m/%Y')}): "
                        f"Tập trung tại {r.get('departure_location') or 'điểm hẹn'} trước giờ xuất phát 30 phút. "
                        "Nhớ mang CCCD/Hộ chiếu bản gốc và kiểm tra checklist hành lý!"
                    )
                elif days_left > 7:
                    reminder = (
                        f"Còn {days_left} ngày tới ngày khởi hành ({depart_date.strftime('%d/%m/%Y')}). "
                        f"Điểm đón: {r.get('departure_location') or 'Theo lịch trình'}."
                    )
            except Exception:
                pass
        result.append({
            "booking_code": r["code"],
            "status": r["status"],
            "tour_name": r.get("tour_name") or "Tour du lịch",
            "tour_url": f"/tours/{r['tour_slug']}" if r.get("tour_slug") else None,
            "depart_date": depart_date.strftime("%d/%m/%Y") if depart_date else "Đang cập nhật",
            "days_until_departure": days_left,
            "guests": r.get("guests", 1),
            "total_price": _format_vnd(r.get("total_price")),
            "meeting_point": r.get("departure_location") or "Theo thông báo của HDV",
            "pre_departure_reminder": reminder,
        })
    return result


def _get_packing_checklist(customer_text: str) -> dict:
    """Tool Giai đoạn 2: Sinh Checklist hành lý tương tác (- [ ]) theo đặc thù từng tour."""
    t = (customer_text or "").lower()
    if any(k in t for k in ["sapa", "fansipan", "đà lạt", "hà giang", "mộc châu", "núi", "vùng cao", "lạnh"]):
        return {
            "tour_type": "Tour Vùng Cao & Săn Mây (Sapa / Fansipan / Đà Lạt)",
            "markdown_instruction": "Khi khách hỏi chuẩn bị đồ/checklist, hãy xuất danh sách bằng cú pháp '- [ ] Tên món đồ' để hiển thị ô tích chọn tương tác trên giao diện:",
            "items": [
                "- [ ] CCCD / Hộ chiếu bản gốc còn hạn (Giấy khai sinh cho trẻ em dưới 14 tuổi)",
                "- [ ] Áo khoác giữ nhiệt / áo phao ấm & khăn choàng cổ",
                "- [ ] Giày thể thao đế bám tốt chống trơn trượt khi đi bộ & leo bậc thang",
                "- [ ] Tất (vớ) dày, găng tay và miếng dán giữ nhiệt",
                "- [ ] Thuốc cá nhân, trà gừng, thuốc chống say xe",
                "- [ ] Sạc dự phòng (pin nhanh tụt hơn khi trời lạnh trên đỉnh Fansipan)",
            ],
        }
    if any(k in t for k in ["phú quốc", "nha trang", "hạ long", "lan hạ", "đà nẵng", "biển", "đảo", "du thuyền"]):
        return {
            "tour_type": "Tour Biển Đảo & Du Thuyền (Đà Nẵng / Hạ Long / Nha Trang / Phú Quốc)",
            "markdown_instruction": "Khi khách hỏi chuẩn bị đồ/checklist, hãy xuất danh sách bằng cú pháp '- [ ] Tên món đồ' để hiển thị ô tích chọn tương tác trên giao diện:",
            "items": [
                "- [ ] CCCD / Hộ chiếu bản gốc còn hạn (bắt buộc làm thủ tục sân bay & cảng tàu)",
                "- [ ] Đồ bơi, kính bơi, khăn choàng đi biển và dép xỏ ngón",
                "- [ ] Kem chống nắng SPF 50+, kính râm và mũ vành rộng",
                "- [ ] Túi chống nước bảo vệ điện thoại khi đi cano / chèo Kayak",
                "- [ ] Thuốc chống say sóng (uống trước khi lên tàu/cano 30 phút)",
                "- [ ] 1 áo khoác mỏng (mặc buổi tối trên boong tàu hoặc khi lên đỉnh Bà Nà Hills)",
            ],
        }
    return {
        "tour_type": "Checklist Chuẩn Bị Đi Tour Tiêu Chuẩn",
        "markdown_instruction": "Nếu khách hỏi cần chuẩn bị gì hoặc xin checklist hành lý, hãy trình bày bằng cú pháp '- [ ] Tên món đồ' để khách tích chọn trực tiếp:",
        "items": [
            "- [ ] CCCD / Hộ chiếu bản gốc còn hạn (Trẻ em dưới 14 tuổi mang Giấy khai sinh)",
            "- [ ] Trang phục thoải mái theo số ngày đi tour & 1 áo khoác nhẹ",
            "- [ ] Giày thể thao hoặc giày bệt êm chân để tham quan",
            "- [ ] Kem chống nắng, kính mát, ô/dù gấp gọn",
            "- [ ] Sạc dự phòng, dây cáp sạc & thuốc y tế cá nhân",
        ],
    }


def _search_local_free_time_places(customer_text: str) -> dict:
    """Tool Giai đoạn 3 (Trong chuyến đi): Gợi ý quán ăn đặc sản, cafe, chợ đêm trong giờ tự do buổi tối."""
    t = (customer_text or "").lower()
    curated_spots = {
        "đà nẵng": {
            "city": "Đà Nẵng",
            "specialties_and_dining": [
                "Hải sản Bé Mặn – Lô 8 Võ Nguyên Giáp, Sơn Trà (gần biển Mỹ Khê, hải sản tươi sống)",
                "Bánh tráng cuốn thịt heo Mậu – 35 Đỗ Thúc Tịnh, Cẩm Lệ (đặc sản trứ danh Đà Nẵng)",
                "Mì Quảng Bà Mua – 19 Trần Bình Trọng, Hải Châu (gần trung tâm thành phố)",
            ],
            "nightlife_and_free_time": [
                "Chợ đêm Sơn Trà (chân Cầu Rồng) – Ẩm thực đường phố & quà lưu niệm (18h00 – 23h30)",
                "Xem Cầu Rồng phun lửa & phun nước (21h00 tối thứ 6, thứ 7, Chủ Nhật)",
                "Du thuyền sông Hàn ngắm cầu quay (bến Bạch Đằng)",
            ],
        },
        "sapa": {
            "city": "Sa Pa",
            "specialties_and_dining": [
                "Lẩu cá tầm & cá hồi Vua Cá Hồi – 015A Lê Văn Tám, TT. Sa Pa",
                "Thắng cố & Lợn cắp nách A Quỳnh – 15 Thạch Sơn, TT. Sa Pa",
                "Đồ nướng Tây Bắc Phố Cầu Mây – Khu ẩm thực đêm Sa Pa",
            ],
            "nightlife_and_free_time": [
                "Chợ đêm Sa Pa & Quảng trường Nhà thờ Đá (chợ tình tối thứ 7)",
                "Tắm lá thuốc người Dao Đỏ thư giãn cơ chân sau khi chinh phục Fansipan",
                "Viettrekking Coffee – 33 Hoàng Liên (ngắm tàu hỏa leo núi Mường Hoa & biển mây)",
            ],
        },
        "hạ long": {
            "city": "Vịnh Hạ Long",
            "specialties_and_dining": [
                "Nhà hàng Hồng Hạnh 3 – 50 Hạ Long, Bãi Cháy (chả mực giã tay, hải sản Quảng Ninh)",
                "Bún bề bề & Bánh cuốn chả mực Bà Ngân – 34 Đoàn Thị Điểm, Hòn Gai",
                " Sữa chua trân châu Hạ Long Cô Nghi – Khu phố cổ Bãi Cháy",
            ],
            "nightlife_and_free_time": [
                "Phố cổ Bãi Cháy (Little Vietnam) & Chợ đêm Hạ Long",
                "Câu mực đêm trên boong du thuyền (từ 20h30 – 22h30)",
                "Valley Beach Club Bãi Cháy – Nghe nhạc biển buổi tối",
            ],
        },
        "nha trang": {
            "city": "Nha Trang",
            "specialties_and_dining": [
                "Hải sản Thanh Sương – 21 Trần Phú, Vĩnh Nguyên (gần cảng Cầu Đá)",
                "Nem nướng Đặng Văn Quyên – 16A Lãn Ông, Nha Trang",
                "Bún cá sứa Năm Beo – B2 Chung cư Phan Bội Châu (gần Chợ Đầm)",
            ],
            "nightlife_and_free_time": [
                "Chợ đêm Nha Trang – 46 Trần Phú (cạnh Quảng trường 2/4)",
                "Sailing Club / Skylight Nha Trang – Ngắm toàn cảnh vịnh biển về đêm",
                "Tắm bùn khoáng nóng I-Resort hoặc Tháp Bà",
            ],
        },
        "phú quốc": {
            "city": "Phú Quốc",
            "specialties_and_dining": [
                "Bún quậy Kiến Xây – 28 Bạch Đằng, Dương Đông (đặc sản nhất định phải thử)",
                "Gỏi cá trích & Hải sản Ra Khơi – 131 đường 30/4, Dương Đông",
                "Ghẹ Hàm Ninh tươi hấp bia – Làng chài Hàm Ninh",
            ],
            "nightlife_and_free_time": [
                "Chợ đêm Phú Quốc (Dinh Cậu) – Hải sản nướng, kem cuộn, ngọc trai",
                "Thị trấn Hoàng Hôn (Sunset Town) – Xem show Kiss of the Sea & pháo hoa tối",
                "Chuồn Chuồn Bistro & Sky Bar – Ngắm hoàng hôn từ đồi Sao Mai",
            ],
        },
        "đà lạt": {
            "city": "Đà Lạt",
            "specialties_and_dining": [
                "Lẩu gà lá é Tao Ngộ – 05 đường 3/4, Đà Lạt (nóng hổi cho buổi tối se lạnh)",
                "Bánh ướt lòng gà Trang – 15F Tăng Bạt Hổ (gần khu Hòa Bình)",
                "Lẩu bò Ba Toa Quán Gỗ – 1/29 Hoàng Diệu",
            ],
            "nightlife_and_free_time": [
                "Chợ đêm Âm Phủ Đà Lạt – Sữa đậu nành nóng, bánh tráng nướng, dâu tây lắc",
                "Tiệm cà phê Túi Mơ To / Lululola Acoustic – Nghe nhạc acoustic tối",
                "Dạo đêm quanh Hồ Xuân Hương & Quảng trường Lâm Viên",
            ],
        },
        "hà nội": {
            "city": "Hà Nội",
            "specialties_and_dining": [
                "Phở Thìn Bờ Hồ – 61 Đinh Tiên Hoàng, Hoàn Kiếm",
                "Bún chả Hương Liên (Bún chả Obama) – 24 Lê Văn Hưu",
                "Chả cá Thăng Long – 21 Đường Thành, Phố Cổ Hà Nội",
            ],
            "nightlife_and_free_time": [
                "Phố đi bộ Hồ Gươm & Phố bia Tạ Hiện",
                "Cà phê Giảng (cà phê trứng cổ truyền) – 39 Nguyễn Hữu Huân",
                "Tour đêm Văn Miếu – Quốc Tử Giám hoặc Hoàng thành Thăng Long",
            ],
        },
        "sài gòn": {
            "city": "TP. Hồ Chí Minh",
            "specialties_and_dining": [
                "Cơm tấm Bụi Sài Gòn – 100 Thạch Thị Thanh, Quận 1",
                "Bánh mì Huỳnh Hoa / Phở Hòa Pasteur – Quận 1 & Quận 3",
                "Phố ốc Vĩnh Khánh (Quận 4) – Thiên đường ốc đêm Sài Gòn",
            ],
            "nightlife_and_free_time": [
                "Phố đi bộ Nguyễn Huệ & Bến Bạch Đằng (đi Waterbus ngắm Landmark 81)",
                "Chợ đêm Bến Thành – Khu ẩm thực và quà lưu niệm",
                "Xe buýt 2 tầng ngắm Sài Gòn về đêm",
            ],
        },
    }

    matched_city = None
    for k, val in curated_spots.items():
        if k in t:
            matched_city = val
            break

    # Truy vấn thêm địa điểm thực tế từ bảng serper_places_store trong DB
    db_places = []
    if matched_city:
        city_kw = f"%{matched_city['city']}%"
        rows = execute_query(
            """SELECT name, category, address, rating
               FROM serper_places_store
               WHERE address ILIKE %s OR name ILIKE %s
               ORDER BY rating DESC NULLS LAST
               LIMIT 4""",
            (city_kw, city_kw),
        ) or []
        db_places = [
            f"{r['name']} ({r.get('category') or 'Địa điểm'}) - Đ/c: {r.get('address') or matched_city['city']} - ⭐ {r.get('rating') or 4.7}"
            for r in rows
        ]

    if matched_city:
        return {
            **matched_city,
            "verified_db_places": db_places,
        }
    return {
        "note": "Hỗ trợ gợi ý quán ăn đặc sản, cafe view đẹp và chợ đêm quanh khách sạn tại Đà Nẵng, Sa Pa, Hạ Long, Nha Trang, Phú Quốc, Đà Lạt, Hà Nội, Sài Gòn.",
    }


def _get_virtual_guide_story(customer_text: str) -> dict:
    """Tool Giai đoạn 3 (Thuyết minh viên ảo): Kể câu chuyện lịch sử, văn hóa & bí quyết chụp ảnh tại điểm tham quan."""
    t = (customer_text or "").lower()
    stories = {
        "cầu vàng": {
            "landmark": "Cầu Vàng (Golden Bridge) – Sun World Bà Nà Hills, Đà Nẵng",
            "story": "Nằm ở độ cao 1.414m so với mực nước biển, Cầu Vàng dài 150m được thiết kế như một dải lụa vàng óng ả được nâng đỡ bởi đôi bàn tay khổng lồ phủ rêu phong của Thần Núi. Công trình từng được tạp chí TIME vinh danh trong Top 100 điểm đến tuyệt vời nhất thế giới.",
            "photo_tip": "Chụp đẹp nhất vào chuyến cáp treo đầu tiên (7h30 – 8h30 sáng) khi sương mù vừa tan và ít người, đứng ở góc 1/3 gần bàn tay đá.",
        },
        "bà nà": {
            "landmark": "Khu du lịch Bà Nà Hills – Đà Nẵng",
            "story": "Được người Pháp phát hiện từ năm 1901 như một thị trấn nghỉ dưỡng mùa hè nhờ khí hậu 4 mùa trong một ngày (sáng xuân, trưa hạ, chiều thu, tối đông). Nổi bật với Làng Pháp cổ kính, hầm rượu cổ Debay xuyên lòng núi từ năm 1923 và tuyến cáp treo đạt nhiều kỷ lục thế giới.",
            "photo_tip": "Quảng trường Nhật Thực và nhà thờ St. Denis tại Làng Pháp lúc 15h00 – 16h30 có ánh nắng chiều châu Âu cực đẹp.",
        },
        "fansipan": {
            "landmark": "Đỉnh Fansipan 3.143m – Nóc nhà Đông Dương (Sa Pa)",
            "story": "Tên địa phương là 'Hủa Xi Pan' nghĩa là 'Phiến đá khổng lồ chênh vênh'. Ở độ cao 3.143m trên dãy Hoàng Liên Sơn, quần thể tâm linh trên đỉnh gồm Đại Tượng Phật A Di Đà bằng đồng cao nhất Việt Nam và cột cờ Tổ quốc giữa biển mây hùng vĩ.",
            "photo_tip": "Góc check-in cột mốc 3.143m và bậc đá Thanh Vân Đắc Lộ lúc biển mây cuộn trào buổi sáng.",
        },
        "cát cát": {
            "landmark": "Bản Cát Cát – Ngôi làng cổ của người H'Mông (Sa Pa)",
            "story": "Hình thành từ giữa thế kỷ 19 dưới chân dãy Hoàng Liên Sơn, Bản Cát Cát nổi tiếng với nghề dệt thổ cẩm nhuộm chàm truyền thống, những nếp nhà gỗ Pơ-mu và thác Tiên Sa (thác Cát Cát) tung bọt trắng xóa quanh năm.",
            "photo_tip": "Thuê trang phục thổ cẩm chụp trên cầu竹 Si bắc qua thác Tiên Sa.",
        },
        "hạ long": {
            "landmark": "Vịnh Hạ Long & Vịnh Lan Hạ – Di sản Thiên nhiên Thế giới UNESCO",
            "story": "Theo truyền thuyết, khi giặc ngoại xâm tiến đánh bằng đường biển, Ngọc Hoàng đã sai Rồng Mẹ cùng đàn Rồng Con đáp xuống phun châu nhả ngọc tạo thành bức tường thành hàng nghìn đảo đá vôi kỳ vĩ chặn bước quân thù. Nơi Rồng Mẹ đáp xuống là Hạ Long, nơi Rồng Con quẫy đuôi là Bái Tử Long.",
            "photo_tip": "Chụp ảnh trên mũi du thuyền lúc bình minh (6h00) hoặc hoàng hôn (17h15) và khi chèo Kayak xuyên Hang Sáng – Hang Tối.",
        },
        "ponagar": {
            "landmark": "Tháp Bà Ponagar – Tuyệt tác kiến trúc Chăm Pa cổ (Nha Trang)",
            "story": "Xây dựng từ thế kỷ thứ 8 đến thế kỷ 13 dưới vương triều Chăm Pa, thờ Thiên Y A Na Thánh Mẫu (Po Ina Nagar) – vị nữ thần tạo dựng đất đai, cây cối và dạy dân trồng lúa, dệt vải. Điểm kỳ diệu là những viên gạch nung xếp khít nhau hoàn toàn không thấy mạch vữa.",
            "photo_tip": "Đứng từ bậc thang đá dẫn lên khu tháp chính chụp góc nghiêng lấy trọn tháp cổ nền gạch đỏ và bầu trời xanh.",
        },
        "hòn mun": {
            "landmark": "Khu bảo tồn biển Hòn Mun – Nha Trang",
            "story": "Được đặt tên là Hòn Mun vì phía Đông Nam đảo có những mỏm đá đen tuyền như gỗ mun hiếm thấy. Đây là khu bảo tồn biển đầu tiên của Việt Nam, nơi giao thoa của hai dòng hải lưu nóng và lạnh, quy tụ hơn 1.500 loài san hô và sinh vật biển.",
            "photo_tip": "Trải nghiệm kính lặn ngắm rạn san hô ở độ sâu 2–4m ngay vùng nước nông trong vắt.",
        },
        "phú quốc": {
            "landmark": "Hòn Thơm & Bãi Sao – Đảo Ngọc Phú Quốc",
            "story": "Tuyến cáp treo 3 dây vượt biển Hòn Thơm dài 7.899,9m là cáp treo vượt biển dài nhất thế giới, đưa du khách bay trên mặt biển xanh ngọc bích của quần đảo An Thới. Bãi Sao gắn với tích xưa mỗi đêm trăng lên, hàng ngàn chú sao biển kéo về nằm trên bờ cát trắng mịn như kem.",
            "photo_tip": "Check-in tại Cầu Hôn (Kiss Bridge) lúc 17h30 khi mặt trời lặn chính giữa hai nhịp cầu.",
        },
        "dinh độc lập": {
            "landmark": "Dinh Độc Lập (Hội trường Thống Nhất) – TP. Hồ Chí Minh",
            "story": "Được thiết kế bởi kiến trúc sư Ngô Viết Thụ (Giải Khôi nguyên La Mã), mặt tiền Dinh mang hình triết tự chữ 'Cát' (may mắn) và chữ 'Hưng' (hưng thịnh) trong văn hóa phương Đông, kết hợp kiến trúc hiện đại và truyền thống.",
            "photo_tip": "Góc chụp từ đài phun nước chính diện nhìn thẳng vào mặt tiền rợp bóng cây xanh.",
        },
    }
    for k, val in stories.items():
        if k in t:
            return val
    return {}


def _analyze_feedback_and_retention(customer_text: str, bookings: list[dict]) -> dict:
    """Tool Giai đoạn 4 (Sau chuyến đi): Phân tích cảm xúc đánh giá/khiếu nại & cấp mã ưu đãi tri ân."""
    t = (customer_text or "").lower()
    neg_keywords = ["tệ", "kém", "chậm", "trễ", "bực", "thất vọng", "không hài lòng", "khiếu nại", "phàn nàn", "đắt", "nguội", "bẩn", "thái độ"]
    pos_keywords = ["tuyệt vời", "hài lòng", "rất vui", "nhiệt tình", "chu đáo", "đẹp lắm", "ngon", "cảm ơn", "khen", "5 sao", "tốt lắm"]

    sentiment = "NEUTRAL"
    if any(k in t for k in neg_keywords):
        sentiment = "NEGATIVE_COMPLAINT"
    elif any(k in t for k in pos_keywords):
        sentiment = "POSITIVE_PRAISE"

    aspects = []
    if any(k in t for k in ["hdv", "hướng dẫn viên", "nhân viên", "tài xế"]):
        aspects.append("Nhân sự / Hướng dẫn viên")
    if any(k in t for k in ["xe", "đón", "trễ", "máy bay", "tàu"]):
        aspects.append("Phương tiện & Giờ giấc")
    if any(k in t for k in ["ăn", "bữa", "nhà hàng", "món"]):
        aspects.append("Ẩm thực")
    if any(k in t for k in ["phòng", "khách sạn", "ngủ"]):
        aspects.append("Lưu trú / Khách sạn")

    booked_names = " ".join((b.get("tour_name") or "").lower() for b in bookings)
    if "đà nẵng" in booked_names or "nha trang" in booked_names or "phú quốc" in booked_names:
        next_suggestion = "Khách từng quan tâm/đi tour biển -> Gợi ý đổi gió sang tour vùng cao săn mây '[Sapa Mù Sương – Chinh Phục Đỉnh Fansipan 3.143m](/tours/tour-sapa-fansipan)' hoặc '[Đà Lạt mộng mơ 4N3Đ](/tours/lam-dong-4n3d)'."
    else:
        next_suggestion = "Gợi ý trải nghiệm nghỉ dưỡng biển đảo '[Khám Phá Vịnh Hạ Long & Vịnh Lan Hạ – Du Thuyền 5 Sao](/tours/tour-kham-pha-vinh-ha-long)' hoặc '[Thiên Đường Biển Ngọc Phú Quốc – Hòn Thơm & Bãi Sao](/tours/tour-phu-quoc-nghi-duong)'."

    return {
        "detected_sentiment": sentiment,
        "detected_aspects": aspects,
        "handling_instruction": (
            "Nếu detected_sentiment='NEGATIVE_COMPLAINT': Xin lỗi chân thành, ghi nhận cụ thể vấn đề kèm mã booking (nếu có) chuyển bộ phận CSKH xử lý ưu tiên trong 2 giờ và tặng mã voucher đền bù 'AURA-CARE15' (giảm 15%). "
            "Nếu khách đánh giá tốt hoặc hỏi ưu đãi khách quen: Cảm ơn và gửi tặng mã tri ân 'AURA-VIP10' (giảm 10% cho chuyến đi tiếp theo)."
        ),
        "loyalty_voucher_code": "AURA-VIP10 (Giảm 10% cho đơn đặt tour tiếp theo)",
        "personalized_next_tour": next_suggestion,
    }


def _auto_link_tours(text: str, tours: list[dict]) -> str:
    """Tự động bọc link markdown cho mọi tour được nhắc tên nếu LLM quên không bọc link."""
    if not text or not tours:
        return text
    result = text
    import re
    for t in tours:
        name = t.get("name")
        url = t.get("url")
        if name and url:
            pattern = re.compile(rf'(?<!\[){re.escape(name)}(?!\]\()')
            result = pattern.sub(f'[{name}]({url})', result)
    return result


def _build_ai_prompt_and_context(conversation: dict):
    """Trích xuất lịch sử và chạy toàn bộ bộ công cụ 4 giai đoạn hành trình du lịch cho AI."""
    history = execute_query(
        "SELECT sender_role, body FROM support_messages WHERE conversation_id=%s ORDER BY created_at DESC,id DESC LIMIT 8",
        (conversation["id"],),
    ) or []
    last_customer_text = next((message["body"] for message in history if message["sender_role"] == "customer"), "")

    # 1. Giai đoạn Khám phá & So sánh Tour + Thời tiết
    tour_input = _select_tour_search_input(last_customer_text)
    tours = _search_tours_for_ai(tour_input)
    weather_tool = _get_weather_and_season_advice(last_customer_text)

    # 2. Giai đoạn Đặt chỗ, Nhắc lịch khởi hành & Checklist hành lý
    bookings = _get_customer_bookings_and_reminders(conversation["user_id"])
    packing_tool = _get_packing_checklist(last_customer_text)

    # 3. Giai đoạn Trong chuyến đi: Ăn chơi giờ tự do & Thuyết minh viên ảo
    local_places_tool = _search_local_free_time_places(last_customer_text)
    story_tool = _get_virtual_guide_story(last_customer_text)

    # 4. Giai đoạn Sau chuyến đi: Phân tích cảm xúc phản hồi & Voucher tri ân giữ chân khách
    retention_tool = _analyze_feedback_and_retention(last_customer_text, bookings)

    context = "\n".join(f"{message['sender_role']}: {message['body']}" for message in reversed(history))
    system_prompt = (
        "Bạn là Aura AI - trợ lý du lịch thông minh đồng hành xuyên suốt 4 giai đoạn hành trình của khách hàng trên sàn Aura Voyage.\n\n"
        "QUY TẮC BẮT BUỘC:\n"
        "1. MỖI KHI NHẮC ĐẾN HOẶC GỢI Ý MỘT TOUR CỤ THỂ, BẮT BUỘC bọc tên tour trong markdown link chuẩn xác theo url: [Tên chính xác của tour](url). "
        "Ví dụ: '[Khám phá Đà Nẵng – Bà Nà Hills 3N2Đ](/tours/da-nang-3n2d)'. Tuyệt đối ghi đúng mức giá từ trường `price_formatted` (ví dụ 2.800.000 VND).\n"
        "2. KHI KHÁCH YÊU CẦU SO SÁNH CÁC TOUR: Đối chiếu rõ ràng từng tiêu chí từ dữ liệu `search_tours` (Thời lượng, Giá vé `price_formatted`, Điểm nổi bật `highlights`, Lịch trình từng ngày `itinerary_summary`, Phương tiện `transportation`, Dịch vụ bao gồm `included`).\n"
        "3. KHI KHÁCH HỎI CHUẨN BỊ ĐỒ / HÀNH LÝ / CHECKLIST: BẮT BUỘC trình bày từng món đồ bằng cú pháp dòng `- [ ] Tên món đồ` (lấy từ `packing_checklist_tool`) để giao diện hiển thị hộp kiểm (checkbox) tương tác cho khách tích chọn.\n"
        "4. KHI KHÁCH HỎI ĂN CHƠI GIỜ TỰ DO / BUỔI TỐI HOẶC THUYẾT MINH ĐIỂM ĐẾN: Sử dụng dữ liệu từ `local_free_time_places_tool` (kèm địa chỉ cụ thể) và `virtual_tour_guide_story_tool` (kể câu chuyện lịch sử/văn hóa và góc chụp ảnh đẹp).\n"
        "5. KHI KHÁCH KIỂM TRA ĐƠN ĐẶT TOUR: Báo rõ mã đơn, tên tour (kèm link), ngày khởi hành, số ngày đếm ngược, điểm tập trung đón khách và lời nhắc trước giờ khởi hành từ `customer_bookings_and_reminders`.\n"
        "6. KHI KHÁCH ĐÁNH GIÁ / KHIẾU NẠI HOẶC HỎI ƯU ĐÃI SAU CHUYẾN ĐI: Áp dụng `feedback_and_retention_tool` để xử lý thấu cảm, gửi mã voucher ưu đãi và gợi ý tour tiếp theo.\n\n"
        "CHÍNH SÁCH NGHIỆP VỤ CỐT LÕI:\n"
        "- Hủy & Hoàn tiền: Hủy >= 7 ngày trước khởi hành hoàn 100%; từ 3–6 ngày hoàn 50%; trong vòng 48h phí hủy 100%. Thiên tai bão lũ được dời lịch miễn phí hoặc bảo lưu 100%.\n"
        "- Giá vé trẻ em: Dưới 5 tuổi miễn phí; 5–9 tuổi tính 75% vé người lớn; từ 10 tuổi tính 100% như người lớn.\n\n"
        "DỮ LIỆU CÔNG CỤ HỆ THỐNG THỜI GIAN THỰC:\n"
        f"1. search_tours (Gợi ý & So sánh tour):\n{json.dumps(tours, default=str, ensure_ascii=False)}\n"
        f"2. weather_and_season_tool (Thời tiết & Mùa vụ):\n{json.dumps(weather_tool, ensure_ascii=False)}\n"
        f"3. customer_bookings_and_reminders (Đơn đặt tour & Nhắc hẹn khởi hành):\n{json.dumps(bookings, default=str, ensure_ascii=False)}\n"
        f"4. packing_checklist_tool (Checklist hành lý tương tác):\n{json.dumps(packing_tool, ensure_ascii=False)}\n"
        f"5. local_free_time_places_tool (Quán ngon, đặc sản & điểm chơi tối tự do):\n{json.dumps(local_places_tool, ensure_ascii=False)}\n"
        f"6. virtual_tour_guide_story_tool (Thuyết minh lịch sử & góc check-in):\n{json.dumps(story_tool, ensure_ascii=False)}\n"
        f"7. feedback_and_retention_tool (Phân tích phản hồi & Voucher tri ân):\n{json.dumps(retention_tool, ensure_ascii=False)}\n\n"
        "Trả lời khách hàng tự nhiên, mạch lạc, súc tích và chuyên nghiệp bằng tiếng Việt."
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
