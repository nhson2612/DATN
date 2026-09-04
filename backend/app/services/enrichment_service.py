"""Điều phối làm giàu địa điểm — cache-first, một thợ mỗi địa điểm.

Thứ tự bắt buộc:
  1. Địa điểm không tồn tại trong Overture  -> 404 (không đụng cache).
  2. Cache success/not_found còn hiệu lực    -> 200 cached, KHÔNG gọi Tavily.
  3. Tranh chấp: người khác đang fetch        -> 202 fetching (frontend poll).
  4. Tự fetch -> nếu có giá trị lưu success, rỗng thì lưu not_found -> 200.
     Lỗi cấu hình / tạm thời -> nhả claim 503 để lần mở sau thử lại.

Không bao giờ trả raw_response ra ngoài — _public() chỉ gom field đã chuẩn hoá.
"""

from app.core.logging import get_logger
from app.repositories import destination_repo, enrichment_repo
from app.services import tavily_service

logger = get_logger(__name__)

# Field quyết định "có giá trị" — sources một mình không tính (chỉ là chứng cứ).
_FIELD_CO_GIA_TRI = ("summary", "opening_hours", "rating",
                     "review_highlights", "images")


def _has_value(normalized: dict) -> bool:
    return any(normalized.get(k) for k in _FIELD_CO_GIA_TRI)


def _iso(fetched_at):
    """datetime (từ psycopg) hoặc chuỗi ISO sẵn có -> chuỗi ISO-8601."""
    if hasattr(fetched_at, "isoformat"):
        return fetched_at.isoformat()
    return fetched_at


def _public(row: dict, *, cached: bool) -> dict:
    """Shape API ổn định — bỏ cột nội bộ (raw_response, started_at, id...)."""
    return {
        "status": row["status"],
        "cached": cached,
        "enrichment": {
            "summary": row.get("summary"),
            "opening_hours": row.get("opening_hours"),
            "rating": row.get("rating"),
            "review_highlights": row.get("review_highlights") or [],
            "images": row.get("images") or [],
            "sources": row.get("sources") or [],
            "fetched_at": _iso(row.get("fetched_at")),
        },
    }


def enrich(place_type: str, place_id: int) -> tuple[int, dict]:
    """Làm giàu (hoặc lấy cache) cho một địa điểm. Trả (status_code, body)."""
    place = destination_repo.get_place_detail(place_type, place_id)
    if not place:
        return 404, {"detail": "Không tìm thấy địa điểm."}

    cached = enrichment_repo.get(place_type, place_id)
    if cached and cached["status"] in ("success", "not_found"):
        return 200, _public(cached, cached=True)

    if not enrichment_repo.claim(place_type, place_id):
        # Có người khác đang fetch (claim thua) — frontend sẽ poll lại.
        return 202, {"status": "fetching", "cached": False}

    try:
        raw = tavily_service.search(place)
        normalized = tavily_service.normalize(place, raw)
        if not _has_value(normalized):
            enrichment_repo.save_not_found(place_type, place_id, raw)
        else:
            enrichment_repo.save_success(place_type, place_id, normalized, raw)
        return 200, _public(enrichment_repo.get(place_type, place_id), cached=False)
    except tavily_service.TavilyConfigurationError:
        logger.warning("Bỏ làm giàu %s/%s: chưa cấu hình Tavily", place_type, place_id)
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Tavily chưa được cấu hình."}
    except tavily_service.TavilyTransientError:
        logger.warning("Lỗi tạm thời khi làm giàu %s/%s — nhả claim để thử lại",
                       place_type, place_id)
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Chưa tải được dữ liệu web; ứng dụng sẽ thử lại ở lần mở sau."}
