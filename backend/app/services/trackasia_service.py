"""TrackAsia Places: tìm đúng POI rồi lấy dữ liệu chi tiết có cấu trúc.

Không ghép Overture và TrackAsia chỉ bằng tọa độ: tên chuẩn hóa phải khớp và
khoảng cách phải nằm trong ngưỡng cấu hình. Mọi response thô chỉ được lưu cache,
không trả trực tiếp về frontend.
"""

from math import asin, cos, radians, sin, sqrt
import re
import unicodedata

import requests

from app.core.config import settings


class TrackAsiaConfigurationError(Exception):
    pass


class TrackAsiaTransientError(Exception):
    pass


def _norm(value: str) -> str:
    value = unicodedata.normalize("NFD", str(value or "").casefold().replace("đ", "d"))
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _distance_m(a_lat, a_lon, b_lat, b_lon) -> float:
    d_lat, d_lon = radians(float(b_lat) - float(a_lat)), radians(float(b_lon) - float(a_lon))
    h = sin(d_lat / 2) ** 2 + cos(radians(float(a_lat))) * cos(radians(float(b_lat))) * sin(d_lon / 2) ** 2
    return 6_371_000 * 2 * asin(sqrt(h))


def _locality_overlap(place: dict, result: dict) -> bool:
    """Địa chỉ Overture và TrackAsia có chung một cụm địa bàn cụ thể hay không.

    Chỉ dùng khi hai điểm lệch hơn ngưỡng thông thường, chẳng hạn điểm đại diện
    của một hồ/công viên lớn. Tỉnh không được dùng riêng vì quá rộng; cần ít
    nhất một bigram chung từ đường hoặc quận/xã.
    """
    source = _norm(" ".join(str(place.get(key) or "") for key in ("dia_chi", "thanh_pho")))
    candidate = _norm(" ".join(str(result.get(key) or "") for key in ("formatted_address", "vicinity")))
    source_tokens, candidate_tokens = source.split(), candidate.split()
    source_bigrams = {" ".join(source_tokens[i:i + 2]) for i in range(len(source_tokens) - 1)}
    candidate_bigrams = {" ".join(candidate_tokens[i:i + 2]) for i in range(len(candidate_tokens) - 1)}
    return bool(source_bigrams & candidate_bigrams)


def _type_overlap(place: dict, result: dict) -> bool:
    """So sánh taxonomy nguồn khi cả hai bên đều có loại cụ thể."""
    expected = {_norm(place.get("category"))}
    tags = place.get("tags") or {}
    if isinstance(tags, dict):
        expected.update(_norm(value) for value in tags.get("category_alt") or [])
    expected.discard("")
    observed = {_norm(value) for value in result.get("types") or []}
    return bool(expected and observed and expected & observed)


def _match(place: dict, results: list[dict]) -> dict | None:
    name = _norm(place.get("name"))
    if not name or place.get("lat") is None or place.get("lon") is None:
        return None
    candidates = []
    for result in results:
        location = (result.get("geometry") or {}).get("location") or {}
        if _norm(result.get("name")) != name or location.get("lat") is None or location.get("lng") is None:
            continue
        distance = _distance_m(place["lat"], place["lon"], location["lat"], location["lng"])
        close = distance <= settings.trackasia_match_distance_m
        extended = (
            distance <= settings.trackasia_extended_match_distance_m
            and _locality_overlap(place, result)
        )
        if close or extended:
            # Khi provider trả taxonomy, ưu tiên cùng loại rồi mới đến điểm gần.
            # Với POI không có taxonomy chung vẫn giữ được matcher theo tên/vị trí.
            candidates.append((0 if _type_overlap(place, result) else 1, distance, result))
    return min(candidates, default=(None, None, None), key=lambda item: item[:2])[2]


def _get(path: str, params: dict, get=requests.get) -> dict:
    key = (settings.trackasia_api_key or "").strip()
    if not key:
        raise TrackAsiaConfigurationError("TRACKASIA_API_KEY chưa được cấu hình.")
    try:
        response = get(
            f"{settings.trackasia_url.rstrip('/')}{path}",
            params={**params, "key": key, "new_admin": "true", "include_old_admin": "true"},
            timeout=settings.trackasia_timeout,
        )
    except requests.RequestException as exc:
        raise TrackAsiaTransientError("Không kết nối được TrackAsia.") from exc
    if response.status_code in (401, 403, 429) or response.status_code >= 500:
        raise TrackAsiaTransientError(f"TrackAsia HTTP {response.status_code}")
    try:
        payload = response.json()
    except ValueError as exc:
        raise TrackAsiaTransientError("TrackAsia trả dữ liệu không phải JSON.") from exc
    return payload if isinstance(payload, dict) else {}


def search_places(question: str, lat: float, lon: float, limit: int = 20,
                  get=requests.get) -> list[dict]:
    """Tìm POI trực tiếp từ TrackAsia cho trợ lý.

    Kết quả của luồng chat không đọc bảng GIS nội bộ. `place_id` của provider
    được giữ riêng trong kết quả để không nhầm với id OSM/Overture.
    """
    if not str(question or '').strip():
        return []
    has_center = lat is not None and lon is not None
    payload = _get(
        "/api/v2/place/textsearch/json",
        {
            "query": str(question).strip(),
            "language": "vi",
            "radius": settings.trackasia_search_radius_m,
        },
        get,
    )
    rows = []
    for item in payload.get("results") or []:
        geometry = item.get("geometry") or {}
        location = geometry.get("location") or {}
        item_lat, item_lon = location.get("lat"), location.get("lng")
        place_id = item.get("place_id")
        if not place_id or item_lat is None or item_lon is None or not item.get("name"):
            continue
        rows.append({
            "id": place_id,
            "type": "trackasia",
            "provider_place_id": place_id,
            "source": "trackasia",
            "name": item["name"],
            "category": (item.get("types") or [None])[0],
            "lat": float(item_lat),
            "lon": float(item_lon),
            "formatted_address": item.get("formatted_address") or item.get("vicinity"),
            "met": round(_distance_m(lat, lon, item_lat, item_lon)) if has_center else None,
            "rating": item.get("rating"),
            "review_count": item.get("user_ratings_total"),
            "icon": item.get("icon"),
        })
    # Text Search có thể trả thêm kết quả ở tỉnh khác dù có gửi radius. Tự
    # lọc theo tâm mà frontend/backend đã biết để không đưa POI sai địa bàn vào
    # danh sách; đồng thời gộp các bản ghi trùng tên từ nhiều nguồn provider.
    if has_center:
        rows = [row for row in rows if row["met"] <= settings.trackasia_search_radius_m]
    unique = {}
    for row in rows:
        key = _norm(row["name"])
        if (key not in unique or
                (row["met"] is not None and
                 (unique[key]["met"] is None or row["met"] < unique[key]["met"]))):
            unique[key] = row
    return sorted(unique.values(), key=lambda row: row["met"] if row["met"] is not None else 0)[:limit]


def place_detail(place_id: str, get=requests.get) -> dict | None:
    payload = _get("/api/v2/place/details/json", {"place_id": place_id}, get)
    result = payload.get("result") if payload.get("status") == "OK" else None
    return result if isinstance(result, dict) else None


def nearby_places(lat: float, lon: float, radius: int = 3000,
                  limit: int = 20, get=requests.get) -> list[dict]:
    payload = _get(
        "/api/v2/place/nearbysearch/json",
        {"location": f"{float(lat):.7f},{float(lon):.7f}", "radius": radius},
        get,
    )
    rows = []
    for item in payload.get("results") or []:
        location = (item.get("geometry") or {}).get("location") or {}
        if item.get("place_id") and item.get("name") and location.get("lat") is not None and location.get("lng") is not None:
            rows.append({
                "id": item["place_id"], "type": "trackasia",
                "provider_place_id": item["place_id"], "source": "trackasia",
                "name": item["name"], "category": (item.get("types") or [None])[0],
                "lat": float(location["lat"]), "lon": float(location["lng"]),
                "dia_chi": item.get("vicinity") or item.get("formatted_address"),
                "met": round(_distance_m(lat, lon, location["lat"], location["lng"])),
            })
    return sorted(rows, key=lambda row: row["met"])[:limit]


def normalize_place(detail: dict) -> dict | None:
    location = ((detail.get("geometry") or {}).get("location") or {})
    if not detail.get("place_id") or location.get("lat") is None or location.get("lng") is None:
        return None
    photos = [photo.get("url") for photo in detail.get("photos") or []
              if isinstance(photo, dict) and str(photo.get("url") or "").startswith("https://")]
    return {
        "id": detail["place_id"], "type": "trackasia", "provider_place_id": detail["place_id"],
        "source": "trackasia", "name": detail.get("name"),
        "category": (detail.get("types") or [None])[0],
        "lat": float(location["lat"]), "lon": float(location["lng"]),
        "dia_chi": detail.get("formatted_address") or detail.get("vicinity"),
        "thanh_pho": detail.get("formatted_address"),
        "dien_thoai": detail.get("formatted_phone_number") or detail.get("international_phone_number"),
        "website": detail.get("website"), "social": (detail.get("socials") or [None])[0],
        "anh": photos[0] if photos else None,
        "anh_nguon": "TrackAsia" if photos else None,
        "rating": detail.get("rating"), "review_count": detail.get("user_ratings_total"),
        "cached_details": detail,
    }


def _search_queries(place: dict) -> list[str]:
    """Các mức định danh tổng quát, từ chính xác nhất đến tên riêng.

    Địa chỉ giữa Overture và TrackAsia có thể dùng địa giới cũ/mới, viết tắt
    hoặc thiếu một phần. Không suy diễn theo địa danh cụ thể: từng candidate
    vẫn phải qua `_match()` với tên chuẩn hoá và khoảng cách thực.
    """
    name = str(place.get("name") or "").strip()
    if not name:
        return []
    address = str(place.get("dia_chi") or "").strip()
    city = str(place.get("thanh_pho") or "").strip()
    province = str(place.get("tinh_thanh") or "").strip()
    groups = (
        (name, address, city, province),
        (name, address, province),
        (name, city, province),
        (name, province),
        (name,),
    )
    queries = []
    seen = set()
    for group in groups:
        query = ", ".join(value for value in group if value)
        normalized = _norm(query)
        if normalized and normalized not in seen:
            seen.add(normalized)
            queries.append(query)
    return queries


def fetch(place: dict, get=requests.get) -> tuple[dict | None, dict]:
    """Trả (place detail, raw cache); không có đối ứng thì detail là None."""
    # Text Search của TrackAsia nhận địa chỉ đầy đủ. Ghép các trường địa chỉ có
    # sẵn trong bản ghi Overture, không dùng luật theo tỉnh/quận/tên riêng lẻ.
    # Tọa độ vẫn quyết định cuối cùng để tránh ghép nhầm điểm trùng tên.
    if place.get("lat") is None or place.get("lon") is None:
        return None, {"search": None, "nearby": None, "detail": None}
    searches = []
    for query in _search_queries(place):
        search = _get(
            "/api/v2/place/textsearch/json",
            {"query": query, "language": "vi", "radius": settings.trackasia_match_distance_m},
            get,
        )
        searches.append({"query": query, "response": search})
        candidate = _match(place, search.get("results") or [])
        if candidate and candidate.get("place_id"):
            detail = _get("/api/v2/place/details/json", {"place_id": candidate["place_id"]}, get)
            result = detail.get("result") if detail.get("status") == "OK" else None
            return result if isinstance(result, dict) else None, {"searches": searches, "nearby": None, "detail": detail}

    # Text search có thể không lập chỉ mục một POI. Nearby là fallback theo
    # tọa độ, nhưng API giới hạn số kết quả nên không thể là nguồn duy nhất.
    nearby = _get(
        "/api/v2/place/nearbysearch/json",
        {
            "location": f"{float(place['lat']):.7f},{float(place['lon']):.7f}",
            "radius": settings.trackasia_match_distance_m,
        },
        get,
    )
    candidate = _match(place, nearby.get("results") or [])
    if not candidate or not candidate.get("place_id"):
        return None, {"searches": searches, "nearby": nearby, "detail": None}
    detail = _get("/api/v2/place/details/json", {"place_id": candidate["place_id"]}, get)
    result = detail.get("result") if detail.get("status") == "OK" else None
    return result if isinstance(result, dict) else None, {"searches": searches, "nearby": nearby, "detail": detail}


def normalize(detail: dict) -> dict:
    hours = detail.get("opening_hours") or {}
    weekly = hours.get("weekday_text") if isinstance(hours, dict) else None
    open_now = hours.get("open_now") if isinstance(hours, dict) else None
    opening_hours = None
    if weekly or open_now is not None:
        opening_hours = {
            "display": "Đang mở cửa" if open_now is True else "Đã đóng cửa" if open_now is False else (weekly[0] if weekly else None),
            "weekly": weekly if isinstance(weekly, list) else None,
            "source_url": detail.get("url") or "",
            "evidence": None,
        }
    photos = []
    for photo in detail.get("photos") or []:
        url = photo.get("url") if isinstance(photo, dict) else None
        if isinstance(url, str) and url.startswith("https://"):
            photos.append({"url": url, "title": "", "description": "", "host": "track-asia.com"})
    rating = detail.get("rating")
    return {
        "summary": ((detail.get("editorial_summary") or {}).get("overview") or detail.get("description") or None),
        "opening_hours": opening_hours,
        "rating": {"value": rating, "review_count": detail.get("user_ratings_total"), "provider": "TrackAsia", "source_url": detail.get("url") or "", "evidence": None} if isinstance(rating, (int, float)) else None,
        "review_highlights": [],
        "images": photos[:12],
        "sources": [{"title": "TrackAsia", "url": detail.get("url") or "", "content": ""}] if detail.get("url") else [],
    }
