"""Lịch trình: chọn ứng viên, gọi LLM, tra chi tiết, dựng tuyến từng chặng."""

import json

from app.core.config import settings
from app.core.database import execute_query
from app.core.logging import get_logger, log_duration
from app.core.llm.adapter import query_llm
from app.self_guided.routing import service as routing_service
from app.shared.places import repository as place_repo
from app.shared.places import serper as serper_service

logger = get_logger(__name__)

# Bán kính gom ứng viên quanh điểm đến. 30 km đủ phủ một thành phố và vùng ven,
# vẫn đảm bảo các điểm trong cùng một ngày đi lại được trong ngày.
ITINERARY_RADIUS_M = 30000

# Chỗ lưu trú vẫn tra được từ bảng nội bộ, và tra GỘP một lần cho mọi id.
TABLES_HOP_LE = ("accommodation",)

# POI không còn nằm trong CSDL nội bộ nên chi tiết phải lấy từ provider:
#   serper          -> giải mã ngay trong ID, không I/O, không cần mạng
#   poi / trackasia -> id của provider cũ (đã bỏ hẳn); không tra lại được, chỉ
#                      giữ nguyên tham chiếu trong lịch trình.
PROVIDER_TYPES = ("serper", "trackasia", "poi")

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

    Kết hợp:
    1. Điểm tham quan & quán ăn từ Serper Places (và serper_places_store trong DB)
    2. Chỗ lưu trú từ bảng accommodation quanh toạ độ thực của điểm đến
    """
    if lon is None:
        lon = settings.default_lon
    if lat is None:
        lat = settings.default_lat

    dest_clean = (destination or "").strip()
    pois = []
    seen_ids = set()

    queries = (
        [
            f"địa điểm tham quan du lịch nổi tiếng tại {dest_clean}",
            f"quán ăn nhà hàng đặc sản tại {dest_clean}",
        ]
        if dest_clean
        else [
            "địa điểm tham quan du lịch nổi tiếng",
            "quán ăn nhà hàng đặc sản",
        ]
    )

    for q in queries:
        try:
            rows = serper_service.search_places(q, lat, lon, max(limit // 2, 10))
            for r in rows:
                rid = r.get("id")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    pois.append(r)
        except (serper_service.SerperConfigurationError,
                serper_service.SerperTransientError) as exc:
            logger.warning("Không lấy được POI từ Serper (%r): %s", q, exc)

    # Bổ sung từ bảng serper_places_store trong PostgreSQL nếu còn thiếu
    if len(pois) < 10:
        try:
            if dest_clean:
                store_rows = execute_query(
                    """
                    SELECT id, name, category, lat, lon, address AS dia_chi, rating
                    FROM serper_places_store
                    WHERE name ILIKE %s OR address ILIKE %s
                    ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
                    LIMIT %s
                    """,
                    (f"%{dest_clean}%", f"%{dest_clean}%", limit),
                ) or []
            else:
                store_rows = execute_query(
                    """
                    SELECT id, name, category, lat, lon, address AS dia_chi, rating
                    FROM serper_places_store
                    ORDER BY updated_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                ) or []
            for r in store_rows:
                rid = r.get("id")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    pois.append({
                        "id": rid,
                        "type": "serper",
                        "name": r.get("name"),
                        "category": r.get("category"),
                        "lat": float(r["lat"]),
                        "lon": float(r["lon"]),
                        "dia_chi": r.get("dia_chi"),
                    })
        except Exception as exc:
            logger.debug("Không đọc được serper_places_store: %s", exc)

    # Nếu tìm được POI ở điểm đến, cập nhật lại tâm (lon, lat) theo POI thực tế
    # để tra bảng accommodation đúng tỉnh/thành đó thay vì vị trí mặc định.
    valid_coords = [
        (float(p["lon"]), float(p["lat"]))
        for p in pois
        if p.get("lon") is not None and p.get("lat") is not None
    ]
    if valid_coords:
        lon = sum(c[0] for c in valid_coords) / len(valid_coords)
        lat = sum(c[1] for c in valid_coords) / len(valid_coords)

    ref = _diem_den_geom(destination, lon, lat)

    accs = execute_query(
        f"""
        SELECT id, name, tourism AS category, 'accommodation' AS type,
               ST_X(geom) AS lon, ST_Y(geom) AS lat,
               COALESCE(NULLIF(address, ''), NULLIF(tags->>'addr:street', '')) AS dia_chi,
               round(ST_Distance(geom::geography, %s::geography)) AS met
        FROM accommodation
        WHERE ST_DWithin(geom::geography, %s::geography, %s) AND {_REAL_NAME}
        ORDER BY geom <-> %s
        LIMIT %s
        """,
        (ref, ref, ITINERARY_RADIUS_M, ref, max(limit // 4, 8)),
    ) or []

    candidates = []
    for row in pois + accs:
        candidate = dict(row)
        candidate["place_id"] = candidate.get("id")
        candidate["place_type"] = candidate.get("type")
        candidates.append(candidate)
    return candidates


def _diem_den_geom(destination: str, lon: float, lat: float):
    """Điểm đến -> một điểm neo. Tra CSDL, không bắt người dùng nhập toạ độ."""
    # Thiếu cả điểm đến lẫn toạ độ thì ST_MakePoint(NULL, NULL) trả NULL và mọi
    # ST_DWithin phía sau lặng lẽ trả rỗng. Rơi về mặc định có sẵn trong cấu hình.
    if lon is None or lat is None:
        lon, lat = settings.default_lon, settings.default_lat

    rows = execute_query(
        "SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS g", (lon, lat))
    return rows[0]["g"]


# Mỗi bảng một câu riêng vì cột khác nhau. Chỉ lấy trường thực sự có dữ liệu,
# đo trên chính CSDL này (gis_vietnam, 805k poi + 52k accommodation):
#   loại       100%      -> luôn hiện được
#   addr:street 92%      -> hiện khi có
#   description 0%       -> cột rỗng hoàn toàn, vẫn trả về để trống chứ không bịa
#   rating      1 giá trị duy nhất, stars và price_range rỗng -> không lấy
# Địa chỉ nằm trong tags chứ không phải cột `address` (cột đó rỗng 100%).
# NULLIF để chuỗi rỗng thành NULL, frontend khỏi phải đoán.
SQL_CHI_TIET_STOP = {
    "accommodation": """
        SELECT id, name,
               NULL::text                       AS mo_ta,
               COALESCE(tourism, amenity)       AS category,
               COALESCE(NULLIF(address, ''),
                        NULLIF(tags->>'addr:street', '')) AS dia_chi,
               NULLIF(tags->>'addr:city', '')   AS thanh_pho,
               NULLIF(tags->>'phone', '')       AS phone,
               NULLIF(tags->>'social', '')      AS social,
               ST_X(geom) AS lon, ST_Y(geom) AS lat
        FROM accommodation WHERE id = ANY(%s)
    """,
}


SECTION_MAC_DINH = "muon-di"


def chuan_hoa_stop(st):
    """Đưa một stop về dạng mới.

    Dạng cũ nhồi mọi thứ vào `day`: -1 là khách sạn, 0 là chưa xếp, 1..N là ngày.
    Dạng mới tách hai khái niệm vốn độc lập: `section` (nằm ở mục nào trong phần
    Tổng quan) và `day` (đã xếp vào ngày nào). Một địa điểm có thể vừa nằm trong
    mục "Địa điểm muốn đi" vừa đã được xếp vào ngày 2 — dạng cũ không diễn tả
    được điều đó. Chuyển đổi làm lúc đọc nên dữ liệu cũ không cần migrate.
    """
    day = st.get("day")
    section = st.get("section")
    role = st.get("role")

    st_type = st.get("type")
    if role is None and section is None:          # bản ghi kiểu cũ
        if day == -1:
            role, section, day = "lodging", "luu-tru", None
        elif st_type in ("note", "checklist", "expense"):
            role = st_type
        else:
            role, section = "place", SECTION_MAC_DINH
    elif not role and st_type in ("note", "checklist", "expense"):
        role = st_type

    default_role = st_type if st_type in ("note", "checklist", "expense") else "place"
    return {
        **st,
        "day": day if isinstance(day, int) and day >= 1 else None,
        "section": section,
        "role": role or default_role,
    }


def _chi_tiet_serper(place_id):
    """Chi tiết POI Serper: ID tự mang dữ liệu nên giải mã là xong, không I/O."""
    try:
        return serper_service.place_detail(str(place_id))
    except Exception as exc:                      # noqa: BLE001 - không được làm sập trang
        logger.warning("Không giải mã được ID Serper %r: %s", place_id, exc)
        return None


def _stop_day_du(st, chi_tiet):
    """Ghép tham chiếu đã lưu với chi tiết tra được -> stop đầy đủ cho frontend."""
    res = dict(st)
    res.update({
        "day": st.get("day"),
        "section": st.get("section"),
        "role": st.get("role") or (st.get("type") if st.get("type") in ("note", "checklist") else "place"),
        "id": st.get("id"),
        "type": st.get("type"),
        "name": chi_tiet.get("name") or st.get("name"),
        "lon": chi_tiet.get("lon"),
        "lat": chi_tiet.get("lat"),
        "mo_ta": chi_tiet.get("mo_ta"),
        "category": chi_tiet.get("category"),
        "dia_chi": chi_tiet.get("dia_chi"),
        # Quận/huyện: cần cho link Google Maps, vì chỉ tên phố thì trùng
        # khắp cả nước ("Phan Đình Phùng" có ở hàng chục tỉnh).
        "thanh_pho": chi_tiet.get("thanh_pho"),
        "phone": chi_tiet.get("phone") or chi_tiet.get("dien_thoai"),
        "social": chi_tiet.get("social"),
        # Giữ `details` cho chỗ nào còn đọc theo dạng cũ.
        "details": {"description": chi_tiet.get("mo_ta"),
                    "address": chi_tiet.get("dia_chi")},
    })
    return res


def _stop_tham_chieu(st):
    """Không tra được chi tiết -> GIỮ LẠI tham chiếu, đánh dấu `unresolved` nếu là POI thật."""
    is_meta = st.get("type") in ("note", "checklist", "expense") or st.get("role") in ("note", "checklist", "expense")
    res = dict(st)
    res.update({
        "day": st.get("day"),
        "section": st.get("section"),
        "role": st.get("role") or (st.get("type") if is_meta else "place"),
        "id": st.get("id"),
        "type": st.get("type"),
        "name": st.get("name"),
        "cost": st.get("cost"),
        "lon": st.get("lon"),
        "lat": st.get("lat"),
        "mo_ta": st.get("mo_ta"),
        "category": st.get("category"),
        "dia_chi": st.get("dia_chi"),
        "thanh_pho": st.get("thanh_pho"),
        "phone": st.get("phone"),
        "social": st.get("social"),
        "details": st.get("details") or {},
        "unresolved": False if is_meta else True,
    })
    return res


def hydrate_stops(stops):
    """`stops` chỉ lưu tham chiếu {day, type, id} -> tra ra chi tiết địa điểm.

    Lịch trình lưu trong CSDL cố tình chỉ giữ id, không giữ tên/toạ độ, để địa
    điểm đổi tên hay dời vị trí thì lịch trình cũ vẫn đúng. Nhưng frontend cần
    tên và toạ độ để vẽ lại lên bản đồ, nên phải tra ở đây — trước đây không có
    bước này, mở lại lịch trình đã lưu là bản đồ trống.

    Hai nguồn, chọn theo `type` của stop:
      serper        -> giải mã trong ID (không I/O)
      accommodation -> bảng nội bộ, tra GỘP một câu SQL cho cả lô

    BẤT BIẾN: hàm này trả về ĐÚNG số stop nhận vào, cùng thứ tự. Không tra được
    chi tiết thì trả tham chiếu kèm `unresolved=True`, tuyệt đối không bỏ stop —
    chỗ gọi ghi lại `stops` từ kết quả này nên bỏ một stop là xoá dữ liệu.
    """
    if not stops:
        return []

    stops = [chuan_hoa_stop(st) for st in stops if isinstance(st, dict)]

    id_theo_bang = {}
    for st in stops:
        if st.get("type") in TABLES_HOP_LE and st.get("id"):
            id_theo_bang.setdefault(st["type"], set()).add(st["id"])

    chi_tiet_bang = {}
    for bang, ids in id_theo_bang.items():
        rows = execute_query(SQL_CHI_TIET_STOP[bang], (list(ids),)) or []
        for r in rows:
            chi_tiet_bang[(bang, r["id"])] = r

    ket_qua = []
    for st in stops:
        ptype, pid = st.get("type"), st.get("id")
        if ptype in ("note", "checklist", "expense") or st.get("role") in ("note", "checklist", "expense"):
            ket_qua.append(_stop_tham_chieu(st))
            continue

        if ptype == "serper":
            chi_tiet = _chi_tiet_serper(pid)
        else:
            chi_tiet = chi_tiet_bang.get((ptype, pid))

        if chi_tiet:
            ket_qua.append(_stop_day_du(st, chi_tiet))
        else:
            logger.warning(
                "Không tra được chi tiết %s/%s — giữ lại dạng tham chiếu",
                ptype, pid,
            )
            ket_qua.append(_stop_tham_chieu(st))
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
          "place_type": "serper" hoặc "accommodation" (đúng `type` của id đó),
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
            if place_type not in ("serper", "accommodation"):
                dropped.append({**act, "reason": (
                    f"place_type '{place_type}' không còn dùng được — "
                    "chỉ còn 'serper' và 'accommodation'")})
                continue
            if (place_type, place_id) in seen:
                dropped.append({**act, "reason": "lặp lại trong cùng ngày"})
                continue
            row = (
                serper_service.place_detail(place_id) if place_type == "serper"
                else place_repo.get_by_id(place_type, place_id)
            )
            if not row:
                dropped.append({**act, "reason": f"không có id này trong bảng {place_type}"})
                continue
            seen.add((place_type, place_id))
            act.update(name=row["name"], lon=row["lon"], lat=row["lat"])
            coords.append((row["lon"], row["lat"]))
            kept.append(act)
        day["activities"] = kept

        features = []
        is_closed = len(kept) >= 2 and kept[0].get("place_type") == "accommodation"
        legs_count = len(coords) if is_closed else len(coords) - 1
        for i in range(legs_count):
            c_start = coords[i]
            c_end = coords[0] if (is_closed and i == len(coords) - 1) else coords[i + 1]
            rows, violates = routing_service.leg_geometry(*c_start, *c_end)
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
