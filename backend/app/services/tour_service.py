"""Tour trọn gói — kiểu đi du lịch thứ nhất.

Khác hẳn phần tự túc: ở đây lịch trình, chỗ ở và giá đều do công ty soạn sẵn,
khách chỉ chọn ngày khởi hành rồi đặt. Giá là dữ liệu THẬT do admin nhập, nên
lọc theo giá ở đây có ý nghĩa — khác `price_level` của POI vốn chỉ chứa giá trị
mặc định "Trung bình".
"""

from app.core.logging import get_logger
from app.repositories import tour_repo

logger = get_logger(__name__)


class HetChoError(Exception):
    """Đợt khởi hành không còn đủ chỗ."""


def list_tours(province_id=None, max_days=None, max_price=None, page=1, page_size=24):
    items, tong = tour_repo.list_tours(
        province_id=province_id, max_days=max_days, max_price=max_price,
        limit=page_size, offset=(max(page, 1) - 1) * page_size)
    return {"items": items, "total": tong, "page": page, "page_size": page_size}


def get_tour(slug: str):
    """Chi tiết tour + các đợt còn chỗ + địa điểm trong lịch trình."""
    tour = tour_repo.get_tour(slug)
    if not tour:
        return None

    tour["departures"] = tour_repo.departures(tour["id"])

    # Gắn tên/toạ độ vào từng ngày để frontend vẽ được lịch trình lên bản đồ.
    chi_tiet = tour_repo.places_of_tour(tour.get("itinerary"))
    for ngay in tour.get("itinerary") or []:
        ngay["places"] = [chi_tiet[i] for i in (ngay.get("place_ids") or [])
                          if i in chi_tiet]
    return tour


def book(data: dict, user_id=None):
    """Đặt tour: giữ chỗ trước rồi mới ghi đơn.

    Giữ chỗ trước để hai người đặt cùng lúc không cùng lấy được chỗ cuối; nếu
    hết chỗ thì dừng ngay, không tạo đơn treo.
    """
    guests = int(data.get("guests") or 1)
    total = None

    if data.get("departure_id"):
        con = tour_repo.giu_cho(data["departure_id"], guests)
        if not con:
            raise HetChoError("Đợt khởi hành này không còn đủ chỗ. Hãy chọn ngày khác.")
        if con.get("price"):
            total = con["price"] * guests

    booking_id = tour_repo.create_booking(data, user_id, total)
    logger.info("Đặt tour #%s: tour=%s đợt=%s, %d khách, tổng=%s",
                booking_id, data["tour_id"], data.get("departure_id"), guests, total)
    return {"id": booking_id, "total_price": total}
