"""API chi tiết một địa điểm và các điểm ở gần."""

from fastapi import APIRouter, HTTPException, Query, Response

from app.core.logging import get_logger
from app.self_guided.destinations import repository as destination_repo
from app.self_guided.place_detail import service as place_service
from app.shared.enrichment import service as enrichment_service
from app.shared.places import serper as serper_service

logger = get_logger(__name__)
router = APIRouter(prefix="/api/places", tags=["place-detail"])


@router.get("/nearby")
def nearby_places(
    lon: float = Query(...),
    lat: float = Query(...),
    place_type: str = Query("accommodation"),
    meters: int = Query(3000, ge=100, le=20000),
    limit: int = Query(12, ge=1, le=50),
):
    if place_type not in ("poi", "trackasia", "serper", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type không hợp lệ.")
    if place_type in ("poi", "trackasia", "serper"):
        try:
            items = serper_service.search_maps(
                "địa điểm du lịch", lat, lon, radius_m=meters, limit=limit)
        except (serper_service.SerperConfigurationError,
                serper_service.SerperTransientError) as exc:
            logger.warning("nearby qua Serper lỗi: %s", exc)
            items = []
        return {"success": True, "items": items}
    return {"success": True,
            "items": destination_repo.nearby_of_type(place_type, lon, lat, meters, limit)}


@router.get("/{place_type}/{place_id}")
def place_detail(place_type: str, place_id: str):
    if place_type not in ("poi", "trackasia", "serper", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type không hợp lệ.")
    data = place_service.get(place_type, place_id)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm.")
    return {"success": True, "place": data}


@router.post("/{place_type}/{place_id}/enrichment")
def enrich_place(place_type: str, place_id: str, response: Response):
    if place_type not in ("poi", "trackasia", "serper", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type không hợp lệ.")
    status_code, body = enrichment_service.enrich(place_type, place_id)
    if status_code in (404, 503):
        raise HTTPException(status_code=status_code, detail=body["detail"])
    response.status_code = status_code
    return body
