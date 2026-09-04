"""Endpoint lịch trình: CRUD của người dùng + gợi ý bằng LLM."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.repositories import itinerary_repo
from app.schemas.requests import ItineraryCreateUpdate, RecommendRequest
from app.services import itinerary_service, route_optimizer

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])


def _require_owned(itinerary_id: int, user_id: int):
    if not itinerary_repo.owned_by(itinerary_id, user_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch trình.")


@router.get("")
def list_itineraries(current_user: dict = Depends(get_current_user)):
    # Kèm `stops_details`: `stops` lưu trong CSDL chỉ là tham chiếu {day,type,id},
    # còn frontend cần tên và toạ độ để vẽ lại lịch trình lên bản đồ.
    rows = itinerary_repo.list_for_user(current_user["id"])
    for r in rows:
        r["stops_details"] = itinerary_service.hydrate_stops(r.get("stops") or [])
    return {"success": True, "itineraries": rows}


@router.post("")
def create_itinerary(
    data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)
):
    new_id = itinerary_repo.create(
        current_user["id"], data.name, data.description, data.duration_days,
        data.stops, data.start_date, data.destination, data.sections,
    )
    return {"success": True, "id": new_id}


@router.put("/{id}")
def update_itinerary(
    id: int, data: ItineraryCreateUpdate, current_user: dict = Depends(get_current_user)
):
    _require_owned(id, current_user["id"])
    itinerary_repo.update(
        id, data.name, data.description, data.duration_days, data.stops,
        data.start_date, data.destination, data.sections,
    )
    return {"success": True, "id": id}


@router.delete("/{id}")
def delete_itinerary(id: int, current_user: dict = Depends(get_current_user)):
    _require_owned(id, current_user["id"])
    itinerary_repo.delete(id)
    return {"success": True, "id": id}


@router.post("/{id}/optimize")
def optimize(id: int, day: int = Query(None, ge=1, description="Bỏ trống = tối ưu mọi ngày"),
             current_user: dict = Depends(get_current_user)):
    """Sắp lại thứ tự các điểm trong ngày cho đi ít đường nhất.

    Người dùng thêm địa điểm theo thứ tự nghĩ ra, không theo thứ tự đi được. Một
    ngày 5 điểm thêm lộn xộn có thể phải chạy 11,9 km trong khi thứ tự tốt chỉ
    mất 4,2 km.
    """
    _require_owned(id, current_user["id"])
    rows = itinerary_repo.list_for_user(current_user["id"])
    lt = next((r for r in rows if r["id"] == id), None)
    if not lt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch trình.")

    # Tối ưu trên bản ĐÃ TRA toạ độ, rồi lưu lại dạng tham chiếu {day,type,id}.
    chi_tiet = itinerary_service.hydrate_stops(lt.get("stops") or [])
    moi, thong_ke = route_optimizer.toi_uu_lich_trinh(chi_tiet, day)
    # Ghi lại phải giữ nguyên section và role: chỉ lưu {day,type,id} như trước
    # là xoá sạch việc địa điểm thuộc mục nào và đâu là chỗ ngủ.
    itinerary_repo.update(
        id, lt["name"], lt.get("description"), lt["duration_days"],
        [{"day": s["day"], "type": s["type"], "id": s["id"],
          "section": s.get("section"), "role": s.get("role", "place")} for s in moi],
        lt.get("start_date"), lt.get("destination"), lt.get("sections") or [],
    )
    return {"success": True, "stops_details": moi, "thong_ke": thong_ke}


@router.post("/recommend")
def recommend(request: RecommendRequest,
              current_user: dict = Depends(get_current_user)):
    # Bắt buộc đăng nhập: đây là endpoint duy nhất trong nhóm itinerary còn để
    # mở, mà nó lại là cái tốn tài nguyên nhất — mỗi lượt gọi một lần LLM.
    try:
        result = itinerary_service.recommend(
            request.duration_days, request.preferences, request.budget,
            destination=request.destination or "",
            lon=request.user_lon, lat=request.user_lat,
        )
    except itinerary_service.LLMUnavailableError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except itinerary_service.NoUsableItineraryError as e:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Mô hình không tạo được lịch trình dùng được: {len(e.dropped)} hoạt "
                "động bị loại vì không khớp danh sách địa điểm. Hãy thử lại hoặc "
                "dùng mô hình lớn hơn."
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Mô hình trả JSON không hợp lệ: {e}")
    return {"success": True, **result}
