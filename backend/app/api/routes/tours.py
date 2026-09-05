"""Endpoint tour trọn gói."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_admin, get_current_user
from app.repositories import tour_repo
from app.schemas.requests import AdminConfirmPaymentRequest, CreatePaymentRequest, TourBookingRequest
from app.services import tour_service

router = APIRouter(prefix="/api/tours", tags=["tours"])


@router.get("")
def list_tours(
    province_id: int = Query(None),
    max_days: int = Query(None, ge=1, le=30),
    max_price: int = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    return {"success": True, **tour_service.list_tours(
        province_id=province_id, max_days=max_days, max_price=max_price,
        page=page, page_size=page_size)}


@router.get("/bookings/me")
def list_my_bookings(
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """Khách hàng xem danh sách đơn đặt tour của chính mình (Phase 2.7).

    Chỉ trả về các đơn của user đang đăng nhập, kèm mã đơn, tour, ngày khởi hành,
    snapshot giá và hạn giữ chỗ; không lộ thông tin user khác.
    """
    bookings = tour_service.list_my_bookings(user_id=current_user["id"], limit=limit)
    return {"success": True, "bookings": bookings}


@router.get("/{slug}")
def get_tour(slug: str):
    tour = tour_service.get_tour(slug)
    if not tour:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour.")
    return {"success": True, "tour": tour}


@router.post("/book")
def book(data: TourBookingRequest,
         current_user: dict = Depends(get_current_user)):
    try:
        kq = tour_service.book(data.model_dump(), current_user["id"])
    except tour_service.HetChoError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {
        "success": True, **kq,
        "message": "Đã ghi nhận yêu cầu đặt tour. Chúng tôi sẽ liên hệ để xác nhận.",
    }


@router.get("/admin/bookings")
def list_bookings(status: str = Query(None),
                  limit: int = Query(100, ge=1, le=500),
                  current_user: dict = Depends(get_current_admin)):
    return {"success": True, "bookings": tour_repo.list_bookings(status, limit)}


@router.post("/admin/cleanup-expired")
def cleanup_expired_bookings(current_user: dict = Depends(get_current_admin)):
    """Admin kích hoạt dọn dẹp các đơn booking quá hạn hoặc quá ngày khởi hành (Phase 2.6 demo)."""
    kq = tour_service.xu_ly_booking_het_han()
    return {"success": True, **kq}


# ═══════════════════════════════════════════════════════════════════════════
# Phase 3-lite: Endpoints Thanh toán thủ công / chuyển khoản (UC-P01/BR-P1)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/bookings/{booking_id}/pay")
def create_payment_for_booking(
    booking_id: int,
    data: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Khách hàng tạo yêu cầu thanh toán thủ công / chuyển khoản cho đơn đặt tour (Phase 3.2).

    Trả về mã giao dịch PM-YYYYMMDD-NNNN và trạng thái thanh toán PENDING hoặc MISMATCH.
    """
    booking = tour_repo.get_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy đơn đặt tour #{booking_id}.")

    # Kiểm tra quyền: chỉ người đặt hoặc admin mới được tạo thanh toán cho đơn này
    if booking.get("user_id") and booking["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền thanh toán cho đơn hàng này.")

    try:
        kq = tour_service.tao_thanh_toan(
            booking_id=booking_id,
            method=data.method,
            amount=data.amount,
            note=data.note,
            actor_id=current_user["id"],
        )
    except tour_service.BookingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.PaymentInvalidError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        **kq,
        "message": "Đã tạo thông tin thanh toán. Vui lòng chuyển khoản theo mã giao dịch và chờ xác nhận.",
    }


@router.get("/admin/payments")
def list_admin_payments(
    status: str = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_admin),
):
    """Admin xem danh sách giao dịch thanh toán kèm mã đơn, tên tour, số tiền, trạng thái (Phase 3.4)."""
    payments = tour_repo.list_payments(status=status, limit=limit, offset=offset)
    return {"success": True, "payments": payments}


@router.post("/admin/payments/{payment_id}/confirm")
def confirm_payment(
    payment_id: int,
    data: Optional[AdminConfirmPaymentRequest] = None,
    current_user: dict = Depends(get_current_admin),
):
    """Admin xác nhận thanh toán đã nhận tiền -> booking chuyển sang PAID (Phase 3.3).

    Bảo đảm:
    - Nếu thành công: booking chuyển sang PAID (chỗ giữ nguyên, ghi status history).
    - Nếu đơn đã EXPIRED/terminal: payment chuyển sang FAILED, không tự chuyển booking.
    - Nếu sai tiền: payment chuyển sang MISMATCH, booking giữ PENDING_PAYMENT.
    - Idempotent: xác nhận lần 2 trên payment SUCCESS trả về kết quả hiện tại.
    """
    note = data.note if data else None
    try:
        kq = tour_service.xac_nhan_thanh_toan(
            payment_id=payment_id,
            actor_id=current_user["id"],
            note=note,
        )
    except tour_service.PaymentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.BookingNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except tour_service.PaymentInvalidError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return kq
