"""Điều phối làm giàu địa điểm — cache-first, một thợ mỗi địa điểm.

Thứ tự bắt buộc:
  1. Địa điểm không tra được -> 404 (không đụng cache).
  2. Cache Serper đã hoàn tất -> 200 cached, không gọi provider.
  3. Tranh chấp: người khác đang fetch -> 202 fetching (frontend poll).
  4. /maps trước (giờ mở cửa, điện thoại, website, mô tả có cấu trúc), /search và
     /images sau (mô tả dài, nguồn dẫn, ảnh). Lỗi cấu hình/tạm thời -> nhả claim
     và trả 503 để lần mở sau thử lại.

Chỉ dùng Serper. Không bao giờ trả raw_response ra ngoài — _public() chỉ gom
field đã chuẩn hoá.
"""

from app.core.logging import get_logger
from app.self_guided.destinations import repository as destination_repo
from app.shared.enrichment import repository as enrichment_repo
from app.shared.places import serper as serper_service

logger = get_logger(__name__)

# Nhãn provider của kết quả làm giàu. Cache tạo bởi phiên bản trước (còn trộn
# TrackAsia/Tavily) bị coi là hết hạn và được tạo lại.
PROVIDER = "serper_v1"

# Field quyết định "có giá trị" — sources một mình không tính (chỉ là chứng cứ).
_FIELD_CO_GIA_TRI = ("summary", "opening_hours", "rating",
                     "review_highlights", "images", "contact")


def _has_value(normalized: dict) -> bool:
    return any(normalized.get(k) for k in _FIELD_CO_GIA_TRI)


def _gop(*phans: dict) -> dict:
    """Gộp nhiều nguồn: nguồn đứng trước thắng ở từng field."""
    ket_qua = {}
    for field in ("summary", "opening_hours", "rating", "review_highlights", "images", "contact"):
        for phan in phans:
            if phan.get(field):
                ket_qua[field] = phan[field]
                break
        else:
            ket_qua[field] = [] if field in ("review_highlights", "images") else None
    ket_qua["sources"] = [s for phan in phans for s in (phan.get("sources") or [])]
    return ket_qua


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
            "contact": row.get("contact") or {},
            "sources": row.get("sources") or [],
            "fetched_at": _iso(row.get("fetched_at")),
        },
    }


def _tim_dia_diem(place_type: str, place_id: str):
    """Tra bản ghi địa điểm để biết tên/toạ độ trước khi làm giàu."""
    if place_type == "serper":
        return serper_service.place_detail(str(place_id))
    if place_type == "accommodation":
        return destination_repo.get_place_detail(place_type, place_id)
    # "poi" và "trackasia" là id của provider cũ (đã bỏ hẳn) — không còn đường tra.
    return None


def _chi_tiet_maps(place: dict) -> dict:
    """Bản ghi /maps khớp nhất với địa điểm: giờ mở cửa, điện thoại, website."""
    if place.get("lat") is None or place.get("lon") is None:
        return {}
    try:
        rows = serper_service.search_maps(
            place.get("name") or "", place["lat"], place["lon"], radius_m=1000, limit=5)
    except (serper_service.SerperConfigurationError,
            serper_service.SerperTransientError) as exc:
        logger.info("Serper /maps chưa dùng được cho %r: %s", place.get("name"), exc)
        return {}

    ten = serper_service._norm(place.get("name"))
    cung_ten = [row for row in rows if serper_service._norm(row.get("name")) == ten]
    ung_vien = cung_ten or rows
    if not ung_vien:
        return {}
    return min(ung_vien, key=lambda row: row.get("met") or 0)


def _normalize_maps(chi_tiet: dict) -> dict:
    """Chuyển bản ghi /maps sang shape làm giàu của ứng dụng."""
    gio = chi_tiet.get("opening_hours")
    opening_hours = None
    if isinstance(gio, dict) and gio:
        opening_hours = {
            "display": next(iter(gio.values())),
            "weekly": [f"{thu}: {gio[thu]}" for thu in gio],
            "source_url": "",
            "evidence": None,
        }
    rating = chi_tiet.get("rating")
    anh = chi_tiet.get("anh")
    return {
        "summary": chi_tiet.get("mo_ta"),
        "opening_hours": opening_hours,
        "rating": ({"value": rating,
                    "review_count": chi_tiet.get("review_count"),
                    "provider": "Google",
                    "source_url": "",
                    "evidence": None}
                   if isinstance(rating, (int, float)) else None),
        "review_highlights": [],
        "images": ([{"url": anh, "title": chi_tiet.get("name") or "",
                     "description": "", "host": "googleusercontent.com"}]
                   if anh else []),
        "contact": {
            "website": chi_tiet.get("website") or "",
            "phone": chi_tiet.get("dien_thoai") or "",
        },
        "sources": [],
    }


def enrich(place_type: str, place_id: str) -> tuple[int, dict]:
    """Làm giàu (hoặc lấy cache) cho một địa điểm. Trả (status_code, body)."""
    place = _tim_dia_diem(place_type, place_id)
    if not place:
        return 404, {"detail": "Không tìm thấy địa điểm."}

    cached = enrichment_repo.get(place_type, place_id)
    if cached and cached.get("provider") == PROVIDER:
        return 200, _public(cached, cached=True)

    if not enrichment_repo.claim(place_type, place_id):
        # Có người khác đang fetch (claim thua) — frontend sẽ poll lại.
        return 202, {"status": "fetching", "cached": False}

    try:
        chi_tiet_maps = _chi_tiet_maps(place)
        raw_search = serper_service.search(place)
        normalized = _gop(_normalize_maps(chi_tiet_maps),
                          serper_service.normalize(place, raw_search))
        raw = {"maps": chi_tiet_maps, "search": raw_search}
        if not _has_value(normalized):
            enrichment_repo.save_not_found(place_type, place_id, raw, PROVIDER)
        else:
            enrichment_repo.save_success(place_type, place_id, normalized, raw, PROVIDER)
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
