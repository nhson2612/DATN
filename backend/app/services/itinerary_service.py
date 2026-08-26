"""Lịch trình: chọn ứng viên, gọi LLM, tra chi tiết, dựng tuyến từng chặng."""

import json

from app.core.config import settings
from app.core.database import execute_query
from app.core.logging import get_logger, log_duration
from app.llm.adapter import query_llm
from app.repositories import place_repo
from app.services import routing_service

logger = get_logger(__name__)

# Tên placeholder do importer sinh khi OSM không có tên (778 dòng trong poi).
# Phải loại, nếu không lịch trình sẽ gợi ý khách đến "POI 5107802323".
_REAL_NAME = r"name !~ '^(POI|Accommodation|Road) [0-9]+$'"


class LLMUnavailableError(Exception):
    """LLM không phản hồi hoặc lỗi provider."""


class NoUsableItineraryError(Exception):
    """LLM trả về nhưng không hoạt động nào tra được địa điểm thật."""

    def __init__(self, dropped):
        self.dropped = dropped
        super().__init__(f"{len(dropped)} hoạt động bị loại")


def get_candidates(preferences: str, budget: str):
    budget_lower = (budget or "").lower()
    price_val = "Trung bình"
    if "rẻ" in budget_lower or "tiết kiệm" in budget_lower:
        price_val = "Rẻ"
    elif any(k in budget_lower for k in ("sang", "cao", "đắt")):
        price_val = "Sang trọng"

    accs = execute_query(
        f"""
        SELECT id, name, amenity, tourism, price_level, rating, review_count,
               ST_X(geom) AS lon, ST_Y(geom) AS lat, 'accommodation' AS type
        FROM accommodation
        WHERE (price_level = %s OR price_level = 'Trung bình') AND {_REAL_NAME}
        ORDER BY rating DESC, review_count DESC
        LIMIT 15
        """,
        (price_val,),
    ) or []

    atts = execute_query(
        f"""
        SELECT id, name, amenity, tourism, price_level, rating, review_count,
               ST_X(geom) AS lon, ST_Y(geom) AS lat, 'poi' AS type
        FROM poi
        WHERE (tourism IN ('attraction', 'viewpoint', 'museum', 'theme_park')
               OR amenity IN ('restaurant', 'cafe'))
          AND {_REAL_NAME}
        ORDER BY rating DESC, review_count DESC
        LIMIT 38
        """
    ) or []
    return accs + atts


def _build_prompt(duration_days, preferences, budget, candidates):
    return f"""Bạn là chuyên gia thiết kế lịch trình du lịch chuyên nghiệp.
Hãy lập lịch trình {duration_days} ngày theo sở thích và ngân sách của du khách.

YÊU CẦU:
- Số ngày: {duration_days}
- Sở thích: {preferences}
- Ngân sách: {budget}

DANH SÁCH ĐỊA ĐIỂM CÓ SẴN (chỉ được chọn trong danh sách này):
{json.dumps(candidates, ensure_ascii=False)}

QUY TẮC BẮT BUỘC:
1. Đúng {duration_days} ngày, mỗi ngày đúng 3 hoạt động (Sáng, Trưa, Chiều).
2. Chỉ dùng `id` và `type` có trong danh sách trên. KHÔNG bịa địa điểm.
3. KHÔNG lặp lại cùng một địa điểm trong cùng một ngày.
4. Các địa điểm trong một ngày nên gần nhau theo `lon`/`lat` để tiện di chuyển.
5. Chỉ trả JSON hợp lệ, không markdown, không giải thích thêm:
{{
  "explanation": "tóm tắt ngắn lý do thiết kế",
  "days": [
    {{
      "day": 1,
      "title": "tiêu đề ngày",
      "activities": [
        {{
          "time": "Sáng",
          "place_id": <id lấy từ danh sách, không được bịa>,
          "place_type": "poi" hoặc "accommodation" (đúng `type` của id đó),
          "description": "mô tả ngắn"
        }}
      ]
    }}
  ]
}}
"""


def recommend(duration_days: int, preferences: str, budget: str):
    candidates = get_candidates(preferences, budget)
    prompt = _build_prompt(duration_days, preferences, budget, candidates)

    logger.info(
        "Lập lịch trình %d ngày: %d ứng viên, sở thích=%r ngân sách=%r",
        duration_days, len(candidates), preferences, budget,
    )
    with log_duration(logger, "LLM lập lịch trình", days=duration_days):
        raw = query_llm(
            prompt, json_mode=True, temperature=0.2, timeout=settings.llm_timeout
        )
    # query_llm bắt mọi exception và trả "" (xem llm/adapter.py), nên không có
    # Timeout nào ném ra để bắt. Phải kiểm chuỗi rỗng tường minh, không thì
    # json.loads("") ném JSONDecodeError và người dùng nhận thông báo vô nghĩa.
    if not raw:
        raise LLMUnavailableError(
            f"Mô hình không phản hồi trong {settings.llm_timeout}s hoặc lỗi provider "
            f"({settings.llm_provider}). Kiểm tra LLM_TIMEOUT / GROQ_API_KEY."
        )

    result = json.loads(raw)
    # LLM không tôn trọng số ngày: yêu cầu 2 thì 7b trả 3, 1.5b trả 1.
    days = (result.get("days") or [])[:duration_days]

    dropped = []
    for day in days:
        coords, kept, seen = [], [], set()
        for act in day.get("activities") or []:
            place_id, place_type = act.get("place_id"), act.get("place_type")
            if not place_id or not place_type:
                dropped.append({**act, "reason": "thiếu place_id hoặc place_type"})
                continue
            # Mọi giá trị khác "poi" từng bị coi là accommodation -> tra sai bảng.
            if place_type not in ("poi", "accommodation"):
                dropped.append({**act, "reason": f"place_type '{place_type}' không hợp lệ"})
                continue
            if (place_type, place_id) in seen:
                dropped.append({**act, "reason": "lặp lại trong cùng ngày"})
                continue
            row = place_repo.get_by_id(place_type, place_id)
            if not row:
                dropped.append({**act, "reason": f"không có id này trong bảng {place_type}"})
                continue
            seen.add((place_type, place_id))
            act.update(name=row["name"], lon=row["lon"], lat=row["lat"])
            coords.append((row["lon"], row["lat"]))
            kept.append(act)
        day["activities"] = kept

        features = []
        for i in range(len(coords) - 1):
            rows, violates = routing_service.leg_geometry(*coords[i], *coords[i + 1])
            for row in rows:
                if row.get("geom"):
                    features.append({
                        "type": "Feature",
                        "geometry": json.loads(row["geom"]),
                        "properties": {"may_violate_oneway": violates},
                    })
        day["route_geojson"] = {"type": "FeatureCollection", "features": features}

    kept_total = sum(len(d.get("activities") or []) for d in days)
    if dropped:
        logger.warning(
            "Loại %d hoạt động khỏi lịch trình (giữ %d): %s",
            len(dropped), kept_total,
            [d.get("reason") for d in dropped[:5]],
        )
    if kept_total == 0:
        raise NoUsableItineraryError(dropped)
    logger.info("Lịch trình xong: %d ngày, %d hoạt động", len(days), kept_total)

    return {
        "explanation": result.get("explanation", ""),
        "days": days,
        "dropped_activities": dropped,
    }
