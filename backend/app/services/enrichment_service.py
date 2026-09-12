"""Điều phối làm giàu địa điểm — cache-first, một thợ mỗi địa điểm.

Thứ tự bắt buộc:
  1. Địa điểm không tồn tại trong provider -> 404 (không đụng cache).
  2. Cache TrackAsia/Serper đã hoàn tất       -> 200 cached, không gọi provider.
  3. Tranh chấp: người khác đang fetch        -> 202 fetching (frontend poll).
  4. TrackAsia trước; Serper bổ sung mô tả và ảnh. Có giá trị thì lưu success.
     Lỗi cấu hình / tạm thời -> nhả claim 503 để lần mở sau thử lại.

Không bao giờ trả raw_response ra ngoài — _public() chỉ gom field đã chuẩn hoá.
"""

from app.core.logging import get_logger
from app.repositories import destination_repo, enrichment_repo
from app.services import serper_service, trackasia_service

logger = get_logger(__name__)

# Field quyết định "có giá trị" — sources một mình không tính (chỉ là chứng cứ).
_FIELD_CO_GIA_TRI = ("summary", "opening_hours", "rating",
                     "review_highlights", "images")


def _has_value(normalized: dict) -> bool:
    return any(normalized.get(k) for k in _FIELD_CO_GIA_TRI)


def _merge(trackasia: dict, serper: dict) -> dict:
    """Ghép dữ liệu có cấu trúc của TrackAsia với web/ảnh từ Serper."""
    return {
        "summary": trackasia.get("summary") or serper.get("summary"),
        "opening_hours": trackasia.get("opening_hours") or serper.get("opening_hours"),
        "rating": trackasia.get("rating") or serper.get("rating"),
        "review_highlights": trackasia.get("review_highlights") or serper.get("review_highlights") or [],
        "images": trackasia.get("images") or serper.get("images") or [],
        "sources": (trackasia.get("sources") or []) + (serper.get("sources") or []),
    }


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


def enrich(place_type: str, place_id: str) -> tuple[int, dict]:
    """Làm giàu (hoặc lấy cache) cho một địa điểm. Trả (status_code, body)."""
    if place_type == "serper":
        place = serper_service.place_detail(str(place_id))
    elif place_type in ("poi", "trackasia"):
        detail = trackasia_service.place_detail(str(place_id))
        place = trackasia_service.normalize_place(detail) if detail else None
    else:
        place = destination_repo.get_place_detail(place_type, place_id)
    if not place:
        return 404, {"detail": "Không tìm thấy địa điểm."}

    cached = enrichment_repo.get(place_type, place_id)
    # Cache cũ phải được tạo lại bằng Serper.
    serper_current = cached and cached.get("provider") == "trackasia+serper_v1"
    if cached and serper_current:
        return 200, _public(cached, cached=True)

    if not enrichment_repo.claim(place_type, place_id):
        # Có người khác đang fetch (claim thua) — frontend sẽ poll lại.
        return 202, {"status": "fetching", "cached": False}

    try:
        trackasia_raw = None
        trackasia_normalized = {}
        if place_type != "serper":
            try:
                trackasia_detail, trackasia_raw = trackasia_service.fetch(place)
                if trackasia_detail:
                    trackasia_normalized = trackasia_service.normalize(trackasia_detail)
            except (trackasia_service.TrackAsiaConfigurationError, trackasia_service.TrackAsiaTransientError) as exc:
                logger.info("TrackAsia chưa dùng được cho %s/%s: %s", place_type, place_id, exc)

        raw = serper_service.search(place)
        serper_normalized = serper_service.normalize(place, raw)
        normalized = _merge(trackasia_normalized, serper_normalized)
        if not _has_value(normalized):
            enrichment_repo.save_not_found(place_type, place_id, {"trackasia": trackasia_raw, "serper": raw}, "trackasia+serper_v1")
        else:
            enrichment_repo.save_success(place_type, place_id, normalized,
                                         {"trackasia": trackasia_raw, "serper": raw},
                                         "trackasia+serper_v1")
        return 200, _public(enrichment_repo.get(place_type, place_id), cached=False)
    except serper_service.SerperConfigurationError:
        logger.warning("Bỏ làm giàu %s/%s: chưa cấu hình Serper", place_type, place_id)
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Serper chưa được cấu hình."}
    except serper_service.SerperTransientError:
        logger.warning("Lỗi tạm thời khi làm giàu %s/%s — nhả claim để thử lại",
                       place_type, place_id)
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Chưa tải được dữ liệu web; ứng dụng sẽ thử lại ở lần mở sau."}
