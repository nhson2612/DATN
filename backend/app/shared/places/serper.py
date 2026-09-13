"""Adapter Serper cho tìm POI và enrichment địa điểm."""

import base64
import json
import re
import unicodedata
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlparse

import requests

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SerperConfigurationError(Exception):
    pass


class SerperTransientError(Exception):
    pass


def _norm(value: str) -> str:
    value = unicodedata.normalize("NFD", str(value or "").casefold().replace("đ", "d"))
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _host(url: str) -> str:
    try:
        return urlparse(str(url)).netloc.removeprefix("www.").lower()
    except ValueError:
        return ""


def _query(place: dict) -> str:
    fields = [place.get("name"), place.get("dia_chi"), place.get("thanh_pho")]
    return ", ".join(str(value).strip() for value in fields if value)


def _distance_m(a_lat, a_lon, b_lat, b_lon) -> float:
    d_lat = radians(float(b_lat) - float(a_lat))
    d_lon = radians(float(b_lon) - float(a_lon))
    h = sin(d_lat / 2) ** 2 + cos(radians(float(a_lat))) * cos(radians(float(b_lat))) * sin(d_lon / 2) ** 2
    return 6_371_000 * 2 * asin(sqrt(h))


def _post(url: str, place: dict, post) -> dict:
    key = (settings.serper_api_key or "").strip()
    if not key:
        raise SerperConfigurationError("SERPER_API_KEY chưa được cấu hình.")
    try:
        response = post(
            url,
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": _query(place), "gl": "vn", "hl": "vi", "num": 10},
            timeout=settings.serper_timeout,
        )
    except requests.RequestException as exc:
        raise SerperTransientError("Không kết nối được Serper.") from exc
    if response.status_code == 429 or response.status_code >= 500:
        raise SerperTransientError(f"Serper HTTP {response.status_code}")
    if response.status_code in (401, 403):
        raise SerperConfigurationError("Serper API key không hợp lệ.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise SerperTransientError("Serper trả dữ liệu không phải JSON.") from exc
    if not isinstance(payload, dict):
        raise SerperTransientError("Serper trả payload không hợp lệ.")
    return payload


# ==============================================================================
# QUẢN LÝ LƯU TRỮ VÀ CACHE VĨNH VIỄN CHO SERPER (POSTGRESQL)
# ==============================================================================

def _get_cached_query(cache_key: str) -> list[dict] | None:
    """Đọc kết quả Serper đã lưu vĩnh viễn trong CSDL."""
    try:
        from app.core.database import execute_query
        rows = execute_query(
            "SELECT items FROM serper_places_cache WHERE cache_key = %s",
            (cache_key,)
        )
        if rows and rows[0].get("items"):
            items = rows[0]["items"]
            if isinstance(items, str):
                items = json.loads(items)
            return items
    except Exception as exc:
        logger.debug("Lỗi đọc serper_places_cache (%s): %s", cache_key, exc)
    return None


def _save_cached_query(cache_key: str, api_type: str, query_text: str,
                       lat: float | None, lon: float | None, radius_m: int | None,
                       raw_response: dict | None, items: list[dict]) -> None:
    """Lưu vĩnh viễn kết quả truy vấn Serper vào serper_places_cache."""
    if not items and not raw_response:
        return
    try:
        from app.core.database import execute_query
        execute_query(
            """
            INSERT INTO serper_places_cache
                (cache_key, api_type, query_text, lat, lon, radius_m, raw_response, items, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (cache_key) DO UPDATE
            SET items = EXCLUDED.items,
                raw_response = EXCLUDED.raw_response,
                updated_at = NOW()
            """,
            (
                cache_key,
                api_type,
                query_text,
                lat,
                lon,
                radius_m,
                json.dumps(raw_response or {}, ensure_ascii=False),
                json.dumps(items, ensure_ascii=False),
            ),
        )
    except Exception as exc:
        logger.warning("Lưu serper_places_cache thất bại cho %r: %s", cache_key, exc)


def _save_places_to_store(places: list[dict]) -> None:
    """Lưu trữ vĩnh viễn từng địa điểm POI vào serper_places_store."""
    if not places:
        return
    try:
        from app.core.database import execute_query
        for p in places:
            p_id = p.get("id")
            if not p_id or not p.get("lat") or not p.get("lon"):
                continue
            cid = p.get("provider_place_id") or p.get("cid")
            name = p.get("name") or ""
            category = p.get("category")
            p_lat = float(p["lat"])
            p_lon = float(p["lon"])
            address = p.get("dia_chi") or p.get("formatted_address") or p.get("address")
            rating = float(p["rating"]) if p.get("rating") is not None else None
            review_count = int(p["review_count"]) if p.get("review_count") is not None else None

            details = {
                k: v for k, v in p.items()
                if k not in ("id", "type", "provider_place_id", "cid", "source",
                             "name", "category", "lat", "lon", "dia_chi",
                             "formatted_address", "address", "rating", "review_count", "met")
            }

            execute_query(
                """
                INSERT INTO serper_places_store
                    (id, cid, name, category, lat, lon, address, rating, review_count, details, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    category = COALESCE(EXCLUDED.category, serper_places_store.category),
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    address = COALESCE(EXCLUDED.address, serper_places_store.address),
                    rating = COALESCE(EXCLUDED.rating, serper_places_store.rating),
                    review_count = COALESCE(EXCLUDED.review_count, serper_places_store.review_count),
                    details = COALESCE(EXCLUDED.details, serper_places_store.details),
                    updated_at = NOW()
                """,
                (
                    str(p_id),
                    str(cid) if cid else None,
                    name,
                    category,
                    p_lat,
                    p_lon,
                    address,
                    rating,
                    review_count,
                    json.dumps(details, ensure_ascii=False) if details else None,
                ),
            )
    except Exception as exc:
        logger.warning("Lưu serper_places_store thất bại: %s", exc)


def _get_place_from_store(place_id: str) -> dict | None:
    """Lấy thông tin địa điểm đã lưu vĩnh viễn trong serper_places_store."""
    try:
        from app.core.database import execute_query
        rows = execute_query(
            "SELECT id, cid, name, category, lat, lon, address, rating, review_count, details FROM serper_places_store WHERE id = %s",
            (str(place_id),)
        )
        if rows:
            r = rows[0]
            details = r.get("details") or {}
            if isinstance(details, str):
                details = json.loads(details)
            return {
                "id": r["id"],
                "type": "serper",
                "provider_place_id": r.get("cid"),
                "source": "serper",
                "name": r["name"],
                "category": r.get("category"),
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "dia_chi": r.get("address"),
                "formatted_address": r.get("address"),
                "rating": float(r["rating"]) if r.get("rating") is not None else None,
                "review_count": r.get("review_count"),
                **details,
            }
    except Exception as exc:
        logger.debug("Lấy serper_places_store lỗi (%s): %s", place_id, exc)
    return None


def search_places(question: str, lat: float | None = None,
                  lon: float | None = None, limit: int = 20,
                  post=requests.post) -> list[dict]:
    """Tìm POI bằng Serper Places và lưu vĩnh viễn kết quả vào CSDL."""
    question = str(question or "").strip()
    if not question:
        return []

    cache_key = f"places:{_norm(question)}"

    # 1. Kiểm tra cache vĩnh viễn từ database (nếu dùng post mặc định)
    if post is requests.post:
        cached_rows = _get_cached_query(cache_key)
        if cached_rows is not None and len(cached_rows) > 0:
            logger.info("Dùng kết quả Serper lưu vĩnh viễn cho %r (%d điểm)", question, len(cached_rows))
            results = []
            for r in cached_rows:
                item = dict(r)
                if lat is not None and lon is not None and item.get("lat") and item.get("lon"):
                    item["met"] = round(_distance_m(lat, lon, item["lat"], item["lon"]))
                results.append(item)

            if lat is not None and lon is not None:
                within_radius = [row for row in results if row.get("met") is not None and row["met"] <= settings.serper_search_radius_m]
                if within_radius:
                    results = within_radius
            return sorted(results, key=lambda row: row.get("met") if row.get("met") is not None else 0)[:limit]

    key = (settings.serper_api_key or "").strip()
    if not key:
        raise SerperConfigurationError("SERPER_API_KEY chưa được cấu hình.")

    try:
        response = post(
            settings.serper_places_url,
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": question, "gl": "vn", "hl": "vi", "num": min(max(limit, 1), 20)},
            timeout=settings.serper_timeout,
        )
    except requests.RequestException as exc:
        raise SerperTransientError("Không kết nối được Serper Places.") from exc
    if response.status_code == 429 or response.status_code >= 500:
        raise SerperTransientError(f"Serper Places HTTP {response.status_code}")
    if response.status_code in (401, 403):
        raise SerperConfigurationError("Serper API key không hợp lệ.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise SerperTransientError("Serper Places trả dữ liệu không phải JSON.") from exc
    if not isinstance(payload, dict):
        raise SerperTransientError("Serper Places trả payload không hợp lệ.")

    rows = []
    for item in payload.get("places") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("title") or "").strip()
        item_lat, item_lon = item.get("latitude"), item.get("longitude")
        cid = str(item.get("cid") or "").strip()
        if not name or not cid or item_lat is None or item_lon is None:
            continue
        try:
            item_lat, item_lon = float(item_lat), float(item_lon)
        except (TypeError, ValueError):
            continue
        identity = {
            "name": name,
            "address": item.get("address") or "",
            "lat": item_lat,
            "lon": item_lon,
            "cid": cid,
            "category": item.get("category"),
            "rating": item.get("rating"),
            "review_count": item.get("ratingCount"),
        }
        token = base64.urlsafe_b64encode(
            json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        ).decode("ascii").rstrip("=")
        rows.append({
            "id": f"serper:{token}",
            "type": "serper",
            "provider_place_id": cid,
            "source": "serper",
            "name": name,
            "category": item.get("category"),
            "lat": item_lat,
            "lon": item_lon,
            "dia_chi": item.get("address"),
            "formatted_address": item.get("address"),
            "met": round(_distance_m(lat, lon, item_lat, item_lon))
                   if lat is not None and lon is not None else None,
            "rating": item.get("rating"),
            "review_count": item.get("ratingCount"),
        })

    # Lưu vĩnh viễn vào cơ sở dữ liệu để không bao giờ phải gọi lại Serper cho câu hỏi này
    if rows:
        _save_cached_query(cache_key, "places", question, lat, lon, None, payload, rows)
        _save_places_to_store(rows)

    if lat is not None and lon is not None:
        within_radius = [row for row in rows
                         if row["met"] <= settings.serper_search_radius_m]
        # Nếu không có kết quả trong bán kính (do tìm ở tỉnh/thành khác với vị trí GPS),
        # giữ nguyên các kết quả từ Google Places để không làm mất dữ liệu.
        if within_radius:
            rows = within_radius
    return sorted(rows, key=lambda row: row["met"] if row["met"] is not None else 0)[:limit]


# Bề ngang khung nhìn giả định khi quy đổi bán kính -> zoom của /maps.
_RONG_KHUNG_NHIN_PX = 800


def _zoom_cho_ban_kinh(lat: float, radius_m: float) -> int:
    """Quy đổi bán kính mét sang zoom Google Maps.

    Google không nhận bán kính theo mét cho /maps, chỉ nhận khung nhìn qua
    `ll=@lat,lon,zoomz`. Công thức Web Mercator: mét/pixel ở zoom 0 là
    156543.03392 * cos(vĩ độ). Chọn zoom sao cho khung nhìn ~800 px phủ khoảng
    hai lần bán kính; sau đó vẫn LỌC LẠI bằng khoảng cách thật, nên zoom chỉ
    quyết định vùng quét chứ không quyết định kết quả.
    """
    import math

    lat = max(-85.0, min(85.0, float(lat or 0.0)))
    radius_m = max(200.0, float(radius_m or 1000.0))
    met_moi_pixel = (2 * radius_m) / _RONG_KHUNG_NHIN_PX
    zoom = math.log2(156543.03392 * math.cos(math.radians(lat)) / met_moi_pixel)
    return int(max(3, min(18, round(zoom))))


def search_maps(question: str, lat: float, lon: float, radius_m: int = 3000,
                limit: int = 20, post=requests.post) -> list[dict]:
    """Địa điểm quanh một toạ độ, lấy từ Serper /maps và lưu vĩnh viễn."""
    question = str(question or "").strip() or "địa điểm"
    norm_q = _norm(question)
    grid_lat = round(float(lat), 2)
    grid_lon = round(float(lon), 2)
    cache_key = f"maps:{norm_q}:{grid_lat}:{grid_lon}:{radius_m}"

    # 1. Kiểm tra cache vĩnh viễn từ CSDL
    if post is requests.post:
        cached_rows = _get_cached_query(cache_key)
        if cached_rows is not None and len(cached_rows) > 0:
            logger.info("Dùng kết quả Serper maps lưu vĩnh viễn cho %r (%d điểm)", question, len(cached_rows))
            results = []
            for r in cached_rows:
                item = dict(r)
                if item.get("lat") and item.get("lon"):
                    item["met"] = round(_distance_m(lat, lon, item["lat"], item["lon"]))
                results.append(item)
            return sorted(results, key=lambda row: row.get("met") or 0)[:limit]

    key = (settings.serper_api_key or "").strip()
    if not key:
        raise SerperConfigurationError("SERPER_API_KEY chưa được cấu hình.")

    zoom = _zoom_cho_ban_kinh(lat, radius_m)
    try:
        response = post(
            settings.serper_maps_url,
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": question,
                  "ll": f"@{float(lat):.6f},{float(lon):.6f},{zoom}z",
                  "gl": "vn", "hl": "vi"},
            timeout=settings.serper_timeout,
        )
    except requests.RequestException as exc:
        raise SerperTransientError("Không kết nối được Serper Maps.") from exc
    if response.status_code == 429 or response.status_code >= 500:
        raise SerperTransientError(f"Serper Maps HTTP {response.status_code}")
    if response.status_code in (401, 403):
        raise SerperConfigurationError("Serper API key không hợp lệ.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise SerperTransientError("Serper Maps trả dữ liệu không phải JSON.") from exc
    if not isinstance(payload, dict):
        raise SerperTransientError("Serper Maps trả payload không hợp lệ.")

    rows = []
    for item in payload.get("places") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("title") or "").strip()
        item_lat, item_lon = item.get("latitude"), item.get("longitude")
        if not name or item_lat is None or item_lon is None:
            continue
        try:
            item_lat, item_lon = float(item_lat), float(item_lon)
        except (TypeError, ValueError):
            continue
        cid = str(item.get("cid") or "").strip()
        identity = {
            "name": name,
            "address": item.get("address") or "",
            "lat": item_lat,
            "lon": item_lon,
            "cid": cid,
            "place_id": item.get("placeId"),
            "category": item.get("type"),
            "rating": item.get("rating"),
            "review_count": item.get("ratingCount"),
        }
        token = base64.urlsafe_b64encode(
            json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        ).decode("ascii").rstrip("=")
        rows.append({
            "id": f"serper:{token}",
            "type": "serper",
            "provider_place_id": cid or item.get("placeId"),
            "source": "serper_maps",
            "name": name,
            "category": item.get("type"),
            "types": item.get("types"),
            "lat": item_lat,
            "lon": item_lon,
            "dia_chi": item.get("address"),
            "formatted_address": item.get("address"),
            "met": round(_distance_m(lat, lon, item_lat, item_lon)),
            "rating": item.get("rating"),
            "review_count": item.get("ratingCount"),
            # Ba trường chỉ /maps mới có.
            "mo_ta": item.get("description"),
            "website": item.get("website"),
            "dien_thoai": item.get("phoneNumber"),
            "opening_hours": item.get("openingHours"),
            "anh": item.get("thumbnailUrl"),
        })

    # Lưu vĩnh viễn vào CSDL
    if rows:
        _save_cached_query(cache_key, "maps", question, lat, lon, radius_m, payload, rows)
        _save_places_to_store(rows)

    # Google trả theo khung nhìn chứ không theo bán kính -> tự lọc khoảng cách thật.
    rows = [row for row in rows if row["met"] <= radius_m]
    return sorted(rows, key=lambda row: row["met"])[:limit]


def decode_place_id(place_id: str) -> dict | None:
    """Giải mã ID Serper do `search_places` tạo ra."""
    value = str(place_id or "")
    if not value.startswith("serper:"):
        return None
    try:
        token = value.removeprefix("serper:")
        token += "=" * (-len(token) % 4)
        data = json.loads(base64.urlsafe_b64decode(token).decode("utf-8"))
    except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or not data.get("name"):
        return None
    return data


def place_detail(place_id: str) -> dict | None:
    """Dựng detail từ dữ liệu đã lưu vĩnh viễn trong CSDL hoặc decode từ ID."""
    # 1. Ưu tiên đọc từ kho lưu trữ vĩnh viễn
    stored = _get_place_from_store(place_id)
    if stored:
        return stored

    data = decode_place_id(place_id)
    if not data:
        return None
    return {
        "id": place_id,
        "type": "serper",
        "provider_place_id": data.get("cid"),
        "source": "serper",
        "name": data.get("name"),
        "category": data.get("category"),
        "lat": float(data["lat"]),
        "lon": float(data["lon"]),
        "dia_chi": data.get("address"),
        "formatted_address": data.get("address"),
        "rating": data.get("rating"),
        "review_count": data.get("review_count"),
    }


def search(place: dict, post=requests.post) -> dict:
    """Tìm kiếm web bổ trợ cho làm giàu thông tin và lưu vĩnh viễn."""
    query_str = _query(place)
    cache_key = f"web:{_norm(query_str)}"

    if post is requests.post:
        try:
            from app.core.database import execute_query
            c_rows = execute_query("SELECT raw_response FROM serper_places_cache WHERE cache_key = %s", (cache_key,))
            if c_rows and c_rows[0].get("raw_response"):
                raw = c_rows[0]["raw_response"]
                return raw if isinstance(raw, dict) else json.loads(raw)
        except Exception:
            pass

    payload = _post(settings.serper_url, place, post)
    try:
        image_payload = _post(settings.serper_images_url, place, post)
    except SerperTransientError:
        image_payload = {}
    payload["images"] = image_payload.get("images") or []

    if post is requests.post and payload:
        _save_cached_query(cache_key, "search", query_str, None, None, None, payload, [])

    return payload


def _matches(place: dict, result: dict) -> bool:
    name = _norm(place.get("name"))
    text = _norm(" ".join(str(result.get(key) or "") for key in ("title", "snippet", "link")))
    if not name or name not in text:
        return False
    locality = _norm(place.get("thanh_pho") or place.get("dia_chi"))
    return not locality or any(token in text for token in locality.split() if len(token) > 2)


def _images(payload: dict, place: dict) -> list[dict]:
    images = []
    for item in payload.get("images") or []:
        if not isinstance(item, dict):
            continue
        url = item.get("imageUrl") or item.get("thumbnailUrl")
        if not isinstance(url, str) or not url.startswith("https://"):
            continue
        images.append({
            "url": url,
            "title": item.get("title") or place.get("name") or "",
            "description": "",
            "host": _host(item.get("source") or item.get("link") or url),
        })
    return images[:12]


def normalize(place: dict, payload: dict) -> dict:
    organic = [item for item in payload.get("organic") or []
               if isinstance(item, dict) and _matches(place, item)]
    summary = next((str(item.get("snippet")).strip() for item in organic
                    if item.get("snippet")), None)
    sources = [
        {"title": item.get("title") or item.get("link"),
         "url": item.get("link") or "", "content": item.get("snippet") or ""}
        for item in organic[:12] if item.get("link")
    ]
    rating = None
    if place.get("rating") is not None:
        rating = {
            "value": place.get("rating"),
            "review_count": place.get("review_count"),
        }
    return {
        "summary": summary[:600] if summary else None,
        "opening_hours": None,
        "rating": rating,
        "review_highlights": [],
        "images": _images(payload, place),
        "sources": sources,
    }
