"""Endpoint điểm đến — trang trung tâm của website du lịch."""

from fastapi import APIRouter, HTTPException, Query, Response

from app.repositories import destination_repo
from app.services import destination_service, enrichment_service

router = APIRouter(prefix="/api/destinations", tags=["destinations"])


@router.get("")
def list_destinations(limit: int = Query(100, ge=1, le=200)):
    return {"success": True, "destinations": destination_service.list_destinations(limit)}


@router.get("/{slug}")
def get_destination(slug: str, limit: int = Query(12, ge=1, le=50)):
    data = destination_service.get_destination(slug, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy điểm đến '{slug}'.")
    return {"success": True, **data}


# ── Danh sách + bộ lọc, và trang chi tiết ────────────────────────────────────
# Đặt trong router này (prefix /api/destinations) thay vì places.py để không
# đụng GET /api/places — cái đó trả GeoJSON cho bản đồ, còn đây trả danh sách
# phân trang cho view lưới.

places_router = APIRouter(prefix="/api/places", tags=["places"])


@places_router.get("/search")
def search_places(
    destination: str = Query(None, description="Slug hoặc tên điểm đến"),
    nhom: str = Query(None, description="tham_quan | an_uong | vui_choi | mua_sam"),
    category: str = Query(None, description="Loại chi tiết, vd 'buddhist_temple'"),
    q: str = Query(None, description="Từ khoá trong tên"),
    has_photo: bool = Query(False),
    place_type: str = Query("poi", description="poi | accommodation"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    if place_type not in ("poi", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type phải là poi hoặc accommodation.")
    return {"success": True, **destination_service.search_places(
        destination=destination, nhom=nhom, category=category, q=q,
        has_photo=has_photo, page=page, page_size=page_size, bang=place_type)}


@places_router.get("/nearby")
def nearby_places(
    lon: float = Query(..., description="Kinh độ tâm"),
    lat: float = Query(..., description="Vĩ độ tâm"),
    place_type: str = Query("accommodation", description="poi | accommodation"),
    meters: int = Query(3000, ge=100, le=20000),
    limit: int = Query(12, ge=1, le=50),
):
    """Địa điểm gần một toạ độ. Dùng để gợi ý chỗ ngủ quanh lịch trình trong ngày."""
    if place_type not in ("poi", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type phải là poi hoặc accommodation.")
    return {"success": True,
            "items": destination_repo.nearby_of_type(place_type, lon, lat, meters, limit)}


@places_router.get("/{place_type}/{place_id}")
def place_detail(place_type: str, place_id: int):
    if place_type not in ("poi", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type phải là poi hoặc accommodation.")
    data = destination_service.place_detail(place_type, place_id)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy địa điểm.")
    return {"success": True, "place": data}


@places_router.post("/{place_type}/{place_id}/enrichment")
def enrich_place(place_type: str, place_id: int, response: Response):
    """Cache-first làm giàu: 200 cache/hoàn tất, 202 đang fetch, 404/503 lỗi.

    Client gọi lại khi gặp 202 (tối đa vài lần, cách nhau 2 giây).
    """
    if place_type not in ("poi", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type phải là poi hoặc accommodation.")
    status_code, body = enrichment_service.enrich(place_type, place_id)
    if status_code in (404, 503):
        raise HTTPException(status_code=status_code, detail=body["detail"])
    response.status_code = status_code
    return body
