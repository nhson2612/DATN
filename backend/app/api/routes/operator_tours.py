"""Endpoint CRUD Tour dành cho Tour Operator và Admin (Phase 5.2).

Tất cả endpoint yêu cầu quyền Operator (ACTIVE) hoặc Admin.
Áp dụng các quy tắc bảo mật và nghiệp vụ:
- BR-O1: Ngăn chặn truy cập/sửa/xoá tour chéo giữa các operator.
- BR-T1: duration_days >= 1.
- BR-T2: slug duy nhất.
- BR-T3: Tour có booking CONFIRMED thì khoá sửa lịch trình, số ngày, chính sách hủy.
- BR-T4: Tour đang ACTIVE chỉ cho phép sửa mô tả, ảnh, highlights, included, excluded.
- BR-T5: Xoá mềm khi tour đã từng có booking, xoá cứng khi chưa từng có booking.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.security import get_current_operator_or_admin
from app.schemas.requests import (DepartureCreate, DepartureUpsert,
                                  SaleDepartureRequest, TourUpsert)
from app.services import tour_service


router = APIRouter(prefix="/api/operator/tours", tags=["operator-tours"])
departures_router = APIRouter(prefix="/api/operator/departures", tags=["operator-departures"])
bookings_router = APIRouter(prefix="/api/operator/bookings", tags=["operator-bookings"])


@router.get("")
def list_operator_tours(
    operator_id: Optional[int] = Query(None, description="Admin lọc theo operator cụ thể"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái tour (DRAFT, ACTIVE, INACTIVE...)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Danh sách tour của operator đang đăng nhập (hoặc tất cả / theo operator_id nếu là admin)."""
    kq = tour_service.danh_sach_tour_operator(
        current_user=current_user,
        query_operator_id=operator_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return {"success": True, **kq}


@router.post("")
def create_operator_tour(
    data: TourUpsert,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Tạo tour mới. Operator được tự động gán operator_id từ token."""
    try:
        tour = tour_service.tao_tour_operator(
            data=data.model_dump(),
            current_user=current_user,
        )
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {
        "success": True,
        "tour": tour,
        "message": "Tạo tour thành công.",
    }


@router.get("/{id}")
def get_operator_tour(
    id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Chi tiết tour của operator. Chặn 403 nếu truy cập tour của operator khác (BR-O1)."""
    try:
        tour = tour_service.lay_chi_tiet_tour_operator(tour_id=id, current_user=current_user)
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {"success": True, "tour": tour}


@router.put("/{id}")
def update_operator_tour(
    id: int,
    data: TourUpsert,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Cập nhật tour của operator kèm kiểm tra BR-T3 (booking CONFIRMED) và BR-T4 (tour ACTIVE)."""
    try:
        tour = tour_service.cap_nhat_tour_operator(
            tour_id=id,
            data=data.model_dump(exclude_unset=True),
            current_user=current_user,
        )
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "tour": tour,
        "message": "Cập nhật tour thành công.",
    }


@router.delete("/{id}")
def delete_operator_tour(
    id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Xoá tour của operator: xoá mềm nếu đã có booking, xoá cứng nếu chưa (BR-T5)."""
    try:
        res = tour_service.xoa_tour_operator(tour_id=id, current_user=current_user)
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return res


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints Quản lý Đợt khởi hành (Phase 5.3) — Lồng theo tour
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{tour_id}/departures")
def list_operator_tour_departures(
    tour_id: int,
    status: Optional[str] = Query(None, description="Lọc theo trạng thái (OPEN, FULL, CLOSED...)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Danh sách đợt khởi hành của tour (BR-O1: chỉ tour của mình hoặc admin)."""
    try:
        kq = tour_service.danh_sach_departure_operator(
            tour_id=tour_id,
            current_user=current_user,
            status=status,
            page=page,
            page_size=page_size,
        )
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"success": True, **kq}


@router.post("/{tour_id}/departures")
def create_operator_tour_departure(
    tour_id: int,
    data: DepartureCreate,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Tạo đợt khởi hành mới cho tour. Kiểm tra BR-D1 (>= hôm nay + 2 ngày), BR-D2 (không trùng ngày)."""
    try:
        dep = tour_service.tao_departure_operator(
            tour_id=tour_id,
            data=data.model_dump(),
            current_user=current_user,
        )
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Tạo đợt khởi hành thành công.",
    }


@router.get("/{tour_id}/departures/{departure_id}")
def get_operator_tour_departure(
    tour_id: int,
    departure_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Chi tiết đợt khởi hành theo tour_id và departure_id."""
    try:
        dep = tour_service.lay_chi_tiet_departure_operator(
            departure_id=departure_id,
            current_user=current_user,
            tour_id=tour_id,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "departure": dep}


@router.put("/{tour_id}/departures/{departure_id}")
def update_operator_tour_departure(
    tour_id: int,
    departure_id: int,
    data: DepartureUpsert,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Cập nhật đợt khởi hành: kiểm tra BR-D4/E6 (không giảm seats_total dưới số chỗ đã bán)."""
    try:
        dep = tour_service.cap_nhat_departure_operator(
            departure_id=departure_id,
            data=data.model_dump(exclude_unset=True),
            current_user=current_user,
            tour_id=tour_id,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Cập nhật đợt khởi hành thành công.",
    }


@router.delete("/{tour_id}/departures/{departure_id}")
def delete_operator_tour_departure(
    tour_id: int,
    departure_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Xoá đợt khởi hành: xoá cứng nếu chưa có booking, từ chối 400 nếu đã có booking."""
    try:
        res = tour_service.xoa_departure_operator(
            departure_id=departure_id,
            current_user=current_user,
            tour_id=tour_id,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return res


@router.put("/{tour_id}/departures/{departure_id}/sale")
def set_operator_tour_departure_sale(
    tour_id: int,
    departure_id: int,
    data: SaleDepartureRequest,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Đặt giá khuyến mãi cho đợt khởi hành theo tour_id (Phase 5.4, UC-T03)."""
    try:
        dep = tour_service.dat_gia_sale_departure(
            departure_id=departure_id,
            data=data.model_dump(exclude_unset=True),
            current_user=current_user,
            tour_id=tour_id,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Cập nhật giá khuyến mãi thành công.",
    }


@router.delete("/{tour_id}/departures/{departure_id}/sale")
def remove_operator_tour_departure_sale(
    tour_id: int,
    departure_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Gỡ giá khuyến mãi của đợt khởi hành theo tour_id (Phase 5.4, UC-T03)."""
    try:
        dep = tour_service.go_gia_sale_departure(
            departure_id=departure_id,
            current_user=current_user,
            tour_id=tour_id,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Đã gỡ giá khuyến mãi thành công.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints Quản lý Đợt khởi hành (Phase 5.3) — Trực tiếp qua departure ID
# ═══════════════════════════════════════════════════════════════════════════


@departures_router.get("/{id}")
def get_operator_departure(
    id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Chi tiết đợt khởi hành theo departure_id."""
    try:
        dep = tour_service.lay_chi_tiet_departure_operator(
            departure_id=id,
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "departure": dep}


@departures_router.put("/{id}")
def update_operator_departure(
    id: int,
    data: DepartureUpsert,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Cập nhật đợt khởi hành theo departure_id (BR-D4/E6)."""
    try:
        dep = tour_service.cap_nhat_departure_operator(
            departure_id=id,
            data=data.model_dump(exclude_unset=True),
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Cập nhật đợt khởi hành thành công.",
    }


@departures_router.delete("/{id}")
def delete_operator_departure(
    id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Xoá đợt khởi hành theo departure_id: chỉ cho xoá khi chưa có booking nào."""
    try:
        res = tour_service.xoa_departure_operator(
            departure_id=id,
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return res


@departures_router.put("/{id}/sale")
def set_operator_departure_sale(
    id: int,
    data: SaleDepartureRequest,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Đặt giá khuyến mãi cho đợt khởi hành (Phase 5.4, UC-T03)."""
    try:
        dep = tour_service.dat_gia_sale_departure(
            departure_id=id,
            data=data.model_dump(exclude_unset=True),
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Cập nhật giá khuyến mãi thành công.",
    }


@departures_router.delete("/{id}/sale")
def remove_operator_departure_sale(
    id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Gỡ giá khuyến mãi của đợt khởi hành (Phase 5.4, UC-T03)."""
    try:
        dep = tour_service.go_gia_sale_departure(
            departure_id=id,
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "departure": dep,
        "message": "Đã gỡ giá khuyến mãi thành công.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints Xuất Danh sách Khách cho Departure (Phase 5.5, UC-O02)
# ═══════════════════════════════════════════════════════════════════════════

@departures_router.get("/{departure_id}/guests.csv")
def export_departure_guests_csv(
    departure_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Xuất danh sách khách của đợt khởi hành dạng file CSV (Phase 5.5, UC-O02).

    Giả định: Repo chưa có bảng booking_passengers chi tiết từng hành khách,
    danh sách xuất theo thông tin người đặt của từng đơn booking (họ tên, SĐT, email, số khách...).
    """
    try:
        csv_data = tour_service.xuat_danh_sach_khach_departure(
            departure_id=departure_id,
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="guests_departure_{departure_id}.csv"'
        },
    )


@departures_router.get("/{departure_id}/guests")
def get_departure_guests_json(
    departure_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Lấy danh sách khách của đợt khởi hành dạng JSON (Phase 5.5)."""
    try:
        guests = tour_service.lay_danh_sach_khach_departure(
            departure_id=departure_id,
            current_user=current_user,
        )
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {"success": True, "departure_id": departure_id, "guests": guests}


# ═══════════════════════════════════════════════════════════════════════════
# Endpoints Quản lý Booking của Operator (Phase 5.5, UC-O02)
# ═══════════════════════════════════════════════════════════════════════════

@bookings_router.get("")
def list_operator_bookings(
    tour_id: Optional[int] = Query(None, description="Lọc theo ID tour"),
    departure_id: Optional[int] = Query(None, description="Lọc theo ID đợt khởi hành"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái booking"),
    operator_id: Optional[int] = Query(None, description="Admin lọc theo ID operator"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Danh sách đơn đặt tour của operator (Phase 5.5, BR-O1, BR-O3).

    - BR-O1: Operator chỉ thấy booking các tour của mình; người khác -> 403.
    - BR-O3: Response không chứa thông tin thanh toán nhạy cảm (txn_ref, gateway...).
    - Admin có thể xem toàn bộ hoặc lọc theo operator_id.
    """
    try:
        kq = tour_service.danh_sach_booking_operator(
            current_user=current_user,
            tour_id=tour_id,
            departure_id=departure_id,
            status=status,
            query_operator_id=operator_id,
            page=page,
            page_size=page_size,
        )
    except tour_service.TourNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.DepartureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {"success": True, **kq}


@bookings_router.get("/{booking_id}")
def get_operator_booking_detail(
    booking_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Chi tiết đơn đặt tour kèm lịch sử và tóm tắt thanh toán không nhạy cảm (Phase 5.5, BR-O1, BR-O3).

    - BR-O1: Chặn 403 nếu booking thuộc tour của operator khác hoặc tour không có chủ.
    - BR-O3: Response KHÔNG chứa txn_ref, gateway hay thông tin nhạy cảm của ngân hàng.
    """
    try:
        kq = tour_service.lay_chi_tiet_booking_operator(
            booking_id=booking_id,
            current_user=current_user,
        )
    except tour_service.BookingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return {"success": True, **kq}


@bookings_router.post("/{booking_id}/confirm")
def confirm_operator_booking(
    booking_id: int,
    current_user: dict = Depends(get_current_operator_or_admin),
):
    """Operator / Admin xác nhận đơn đặt tour đã thanh toán: PAID -> CONFIRMED (Phase 5.5, UC-O02).

    - BR-O1: Operator chỉ xác nhận đơn thuộc tour của mình; người khác -> 403.
    - Chặn 400 nếu đơn chưa ở trạng thái PAID.
    """
    try:
        kq = tour_service.xac_nhan_booking_operator(
            booking_id=booking_id,
            current_user=current_user,
        )
    except tour_service.BookingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.TourPermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except tour_service.TourBusinessRuleError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except tour_service.InvalidStatusTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return kq


