"""Lịch trình: chọn ứng viên, gọi LLM, tra chi tiết, dựng tuyến từng chặng."""

import json

from app.core.config import settings
from app.core.database import execute_query
from app.core.logging import get_logger, log_duration
from app.llm.adapter import query_llm
from app.repositories import place_repo
from app.services import routing_service

logger = get_logger(__name__)

# Bán kính gom ứng viên quanh điểm đến. 30 km đủ phủ một thành phố và vùng ven,
# vẫn đảm bảo các điểm trong cùng một ngày đi lại được trong ngày.
ITINERARY_RADIUS_M = 30000

# Bảng địa điểm hợp lệ trong `stops` — chặn tên bảng tuỳ ý lọt vào SQL.
TABLES_HOP_LE = ("poi", "accommodation")

# Nhóm gốc Overture đáng đưa vào lịch trình. Bỏ shopping/services vì một ngày
# du lịch hiếm khi dành cho cửa hàng tiện lợi.
NHOM_DU_LICH = ("cultural_and_historic", "geographic_entities",
                "food_and_drink", "arts_and_entertainment",
                "sports_and_recreation")

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


def get_candidates(destination: str, lon: float, lat: float, limit: int = 60):
    """Chọn ứng viên QUANH ĐIỂM ĐẾN, phủ đủ các nhóm nhu cầu du lịch.

    Bản cũ chọn bằng `ORDER BY rating DESC, review_count DESC` và lọc theo
    `price_level` — cả ba cột đó trong CSDL đều chỉ chứa giá trị mặc định (4.0,
    10, "Trung bình"), nên thứ tự thực chất là ngẫu nhiên và bộ lọc ngân sách
    không lọc gì. Tệ hơn, nó không hề dùng vị trí: lịch trình 2 ngày có thể gồm
    khách sạn Cà Mau và điểm tham quan Hà Giang.

    Nay neo theo điểm đến và lấy theo khoảng cách. Mỗi nhóm lấy riêng một phần
    để lịch trình có đủ chỗ ở, chỗ ăn và chỗ tham quan — chứ không phải 60 quán
    cà phê.
    """
    ref = _diem_den_geom(destination, lon, lat)

    accs = execute_query(
        f"""
        SELECT id, name, tourism AS category, 'accommodation' AS type,
               ST_X(geom) AS lon, ST_Y(geom) AS lat,
               round(ST_Distance(geom::geography, %s::geography)) AS met
        FROM accommodation
        WHERE ST_DWithin(geom::geography, %s::geography, %s) AND {_REAL_NAME}
        ORDER BY geom <-> %s
        LIMIT %s
        """,
        (ref, ref, ITINERARY_RADIUS_M, ref, limit // 4),
    ) or []

    # Nhóm gốc của Overture (xem scripts/import_overture_vn.py): tham quan, ăn
    # uống, vui chơi, thiên nhiên — đúng những gì một lịch trình cần.
    pois = execute_query(
        f"""
        SELECT id, name, amenity AS category, 'poi' AS type,
               ST_X(geom) AS lon, ST_Y(geom) AS lat,
               round(ST_Distance(geom::geography, %s::geography)) AS met,
               tags->>'category_root' AS nhom
        FROM poi
        WHERE ST_DWithin(geom::geography, %s::geography, %s)
          AND tags->>'category_root' = ANY(%s) AND {_REAL_NAME}
        ORDER BY geom <-> %s
        LIMIT %s
        """,
        (ref, ref, ITINERARY_RADIUS_M, list(NHOM_DU_LICH), ref, limit),
    ) or []

    return accs + pois


def _diem_den_geom(destination: str, lon: float, lat: float):
    """Điểm đến -> một điểm neo. Tra CSDL, không bắt người dùng nhập toạ độ."""
    # Thiếu cả điểm đến lẫn toạ độ thì ST_MakePoint(NULL, NULL) trả NULL và mọi
    # ST_DWithin phía sau lặng lẽ trả rỗng. Rơi về mặc định có sẵn trong cấu hình.
    if lon is None or lat is None:
        lon, lat = settings.default_lon, settings.default_lat

    if destination:
        from app.services.search_service import find_anchor, _norm
        anchor = find_anchor(_norm(destination), lon, lat)
        if anchor:
            logger.info("Điểm đến %r -> %r", destination, anchor["name"])
            rows = execute_query(
                "SELECT ST_Centroid(ST_GeomFromText(%s, 4326)) AS g",
                (anchor["wkt"],),
            )
            if rows:
                return rows[0]["g"]
        logger.warning("Không tra được điểm đến %r, dùng vị trí người dùng",
                       destination)
    rows = execute_query(
        "SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS g", (lon, lat))
    return rows[0]["g"]


def hydrate_stops(stops):
    """`stops` chỉ lưu tham chiếu {day, type, id} -> tra ra chi tiết địa điểm.

    Lịch trình lưu trong CSDL cố tình chỉ giữ id, không giữ tên/toạ độ, để địa
    điểm đổi tên hay dời vị trí thì lịch trình cũ vẫn đúng. Nhưng frontend cần
    tên và toạ độ để vẽ lại lên bản đồ, nên phải tra ở đây — trước đây không có
    bước này, mở lại lịch trình đã lưu là bản đồ trống.

    Gom theo bảng rồi truy vấn một lần mỗi bảng, không tra từng điểm một.
    """
    if not stops:
        return []

    theo_bang = {}
    for st in stops:
        if isinstance(st, dict) and st.get("id") and st.get("type") in TABLES_HOP_LE:
            theo_bang.setdefault(st["type"], set()).add(st["id"])

    chi_tiet = {}
    for bang, ids in theo_bang.items():
        # accommodation không có cột description, poi không có address.
        cot_mo_ta = "description" if bang == "poi" else "address"
        rows = execute_query(
            f"""
            SELECT id, name, {cot_mo_ta} AS mo_ta,
                   ST_X(geom) AS lon, ST_Y(geom) AS lat
            FROM {bang} WHERE id = ANY(%s)
            """,
            (list(ids),),
        ) or []
        for r in rows:
            chi_tiet[(bang, r["id"])] = r

    ket_qua = []
    for st in stops:
        r = chi_tiet.get((st.get("type"), st.get("id")))
        if not r:
            continue          # địa điểm đã bị xoá khỏi CSDL
        ket_qua.append({
            "day": st.get("day"),
            "id": r["id"],
            "type": st["type"],
            "name": r["name"],
            "lon": r["lon"],
            "lat": r["lat"],
            "details": {
                "description": r["mo_ta"] if st["type"] == "poi" else None,
                "address": r["mo_ta"] if st["type"] == "accommodation" else None,
            },
        })
    return ket_qua


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


def _json_an_toan(candidates):
    """Ép Decimal/date về kiểu JSON hiểu được.

    Cột numeric của PostgreSQL về Python thành Decimal, mà json.dumps không
    serialise được -> endpoint trả 500 ngay trước khi kịp gọi LLM.
    """
    from decimal import Decimal

    return [
        {k: (float(v) if isinstance(v, Decimal) else v) for k, v in c.items()}
        for c in candidates
    ]


def recommend(duration_days: int, preferences: str, budget: str,
              destination: str = "", lon: float = None, lat: float = None):
    candidates = _json_an_toan(get_candidates(destination, lon, lat))
    prompt = _build_prompt(duration_days, preferences, budget, candidates)

    logger.info(
        "Lập lịch trình %d ngày tại %r: %d ứng viên, sở thích=%r ngân sách=%r",
        duration_days, destination or "(vị trí người dùng)",
        len(candidates), preferences, budget,
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
            f"({settings.llm_provider}). Kiểm tra LLM_TIMEOUT / DEEPSEEK_API_KEY."
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
