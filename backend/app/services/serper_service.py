"""Adapter Serper cho tìm POI và enrichment địa điểm."""

import base64
import json
import re
import unicodedata
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlparse

import requests

from app.core.config import settings


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


def search_places(question: str, lat: float | None = None,
                  lon: float | None = None, limit: int = 20,
                  post=requests.post) -> list[dict]:
    """Tìm POI bằng Serper Places và trả về shape chung của ứng dụng.

    Serper Places chỉ trả kết quả search, không có detail endpoint theo CID.
    Vì vậy ID mang theo đúng dữ liệu nhận được (base64url), giúp trang detail
    có thể gọi lại bằng tên + địa chỉ mà không cần bảng POI nội bộ.
    """
    key = (settings.serper_api_key or "").strip()
    if not key:
        raise SerperConfigurationError("SERPER_API_KEY chưa được cấu hình.")
    question = str(question or "").strip()
    if not question:
        return []
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
    if lat is not None and lon is not None:
        rows = [row for row in rows
                if row["met"] <= settings.trackasia_search_radius_m]
    return sorted(rows, key=lambda row: row["met"] if row["met"] is not None else 0)[:limit]


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
    """Dựng detail từ dữ liệu search đã ký hiệu trong ID, không gọi Google Places."""
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
    payload = _post(settings.serper_url, place, post)
    try:
        image_payload = _post(settings.serper_images_url, place, post)
    except SerperTransientError:
        image_payload = {}
    payload["images"] = image_payload.get("images") or []
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
