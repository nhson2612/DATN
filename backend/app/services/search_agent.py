"""Tìm POI từ provider Places, không phụ thuộc bảng GIS nội bộ."""

from app.core.logging import get_logger
from app.services import serper_service

logger = get_logger(__name__)


def search(question: str, lon: float, lat: float, limit: int = 20,
           resolved_admin: str | None = None):
    """Chuyển nguyên ý người dùng cho Serper Places và trả về POI có ID."""
    provider_question = str(question or "").strip()
    if resolved_admin and resolved_admin.casefold() not in provider_question.casefold():
        provider_question = f"{provider_question}, {resolved_admin}"

    try:
        rows = serper_service.search_places(provider_question, lat, lon, limit)
    except (serper_service.SerperConfigurationError,
            serper_service.SerperTransientError) as exc:
        logger.warning("Serper Places search lỗi: %s", exc)
        rows = []

    return {
        "results": rows,
        "anchor": None,
        "keywords": question,
        "trong_vung": False,
        "che_do": "serper",
        "cac_buoc": [{"provider": "serper_places", "so_dong": len(rows)}],
        "error": None if rows else "Serper không tìm thấy địa điểm phù hợp.",
    }
