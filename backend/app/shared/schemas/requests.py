"""Pydantic schema cho request. Tách khỏi route để service không phụ thuộc HTTP."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    user_lon: Optional[float] = None
    user_lat: Optional[float] = None
    # Tên đơn vị hành chính người dùng đã chọn từ `candidates` của lượt trước,
    # khi câu hỏi bị nhập nhằng. Gửi lại nguyên câu hỏi cũ kèm trường này.
    resolved_admin: Optional[str] = None


class RouteRequest(BaseModel):
    start_lon: float
    start_lat: float
    end_lon: float
    end_lat: float


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: str
    password: str


class POICreateUpdate(BaseModel):
    name: str
    amenity: Optional[str] = None
    tourism: Optional[str] = None
    description: Optional[str] = None
    lon: float
    lat: float


class AccommodationCreateUpdate(BaseModel):
    name: str
    amenity: Optional[str] = None
    tourism: Optional[str] = None
    price_range: Optional[str] = None
    stars: Optional[int] = None
    address: Optional[str] = None
    lon: float
    lat: float


class ItineraryCreateUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_days: int = 1
    stops: List[dict]
    # Ngày kết thúc không lưu: nó luôn bằng start_date + duration_days - 1, lưu
    # cả hai là mở đường cho hai giá trị đá nhau.
    start_date: Optional[date] = None
    destination: Optional[str] = None
    sections: List[dict] = []


class RecommendRequest(BaseModel):
    duration_days: int
    preferences: str
    budget: str
    # Điểm đến của chuyến đi. Thiếu trường này thì lịch trình gom địa điểm bất kỳ
    # trên toàn quốc — từng có thể xếp khách sạn Cà Mau chung ngày với điểm tham
    # quan Hà Giang. Bỏ trống thì lấy vị trí hiện tại của người dùng làm tâm.
    destination: Optional[str] = None
    user_lon: Optional[float] = None
    user_lat: Optional[float] = None


class FavoriteRequest(BaseModel):
    place_type: str            # 'serper' | 'accommodation'
    place_id: str


class TourBookingRequest(BaseModel):
    """Đặt tour trọn gói — khác BookingRequest (đặt chỗ ở/địa điểm lẻ).

    Tour có ngày khởi hành cố định và số chỗ giới hạn, nên phải chọn `departure_id`
    thay vì tự nhập ngày nhận/trả.
    """
    tour_id: int
    departure_id: Optional[int] = None
    full_name: str
    phone: str
    email: Optional[str] = None
    guests: int = 1
    passengers: List["PassengerRequest"] = []
    note: Optional[str] = None


class PassengerRequest(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class CreatePaymentRequest(BaseModel):
    """Yêu cầu tạo giao dịch thanh toán (thủ công / chuyển khoản)."""
    method: str = "CHUYEN_KHOAN"  # CHUYEN_KHOAN | TAI_VAN_PHONG | KHAC
    amount: Optional[int] = None   # None = lấy mặc định total_price của booking
    note: Optional[str] = None


class CreateStripeCheckoutRequest(BaseModel):
    """Tuỳ chọn origin trả khách về sau Stripe Checkout."""
    redirect_base: Optional[str] = None


class AdminConfirmPaymentRequest(BaseModel):
    """Admin xác nhận giao dịch thanh toán đã nhận tiền."""
    note: Optional[str] = None


class OperatorCreate(BaseModel):
    """Admin tạo tài khoản Tour Operator (Phase 5.1).

    Giả định: Admin tạo thẳng user với role='operator' kèm bản ghi operators.
    Nếu không nhập password, mặc định là '123456'. Mặc định commission_rate là 0.10 (10%)
    và status là 'ACTIVE' để có thể đăng nhập và tạo tour ngay.
    """
    email: str
    password: str = "123456"
    full_name: str
    company_name: str
    tax_code: Optional[str] = None
    commission_rate: Optional[float] = 0.10
    status: Optional[str] = "ACTIVE"


class TourUpsert(BaseModel):
    """Schema tạo và cập nhật Tour của Tour Operator (Phase 5.2)."""
    slug: Optional[str] = None
    name: Optional[str] = None
    operator_id: Optional[int] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    province_id: Optional[int] = None
    duration_days: Optional[int] = None
    price_from: Optional[int] = None
    cover_url: Optional[str] = None
    images: Optional[List[str]] = None
    highlights: Optional[List[str]] = None
    itinerary: Optional[List[dict]] = None
    included: Optional[List[str]] = None
    excluded: Optional[List[str]] = None
    cancellation_policy: Optional[List[dict]] = None
    status: Optional[str] = None


class DepartureCreate(BaseModel):
    """Schema tạo đợt khởi hành mới của Tour Operator (Phase 5.3)."""
    depart_date: date
    list_price: int
    seats_total: int = 20
    min_pax: Optional[int] = 1
    status: Optional[str] = "OPEN"
    sale_price: Optional[int] = None
    sale_starts_at: Optional[datetime] = None
    sale_ends_at: Optional[datetime] = None


class DepartureUpsert(BaseModel):
    """Schema cập nhật đợt khởi hành của Tour Operator (Phase 5.3)."""
    depart_date: Optional[date] = None
    list_price: Optional[int] = None
    seats_total: Optional[int] = None
    seats_left: Optional[int] = None
    min_pax: Optional[int] = None
    status: Optional[str] = None
    sale_price: Optional[int] = None
    sale_starts_at: Optional[datetime] = None
    sale_ends_at: Optional[datetime] = None


class SaleDepartureRequest(BaseModel):
    """Schema đặt/chỉnh sửa giá khuyến mãi cho đợt khởi hành (Phase 5.4, UC-T03)."""
    sale_price: Optional[int] = None
    sale_starts_at: Optional[datetime] = None
    sale_ends_at: Optional[datetime] = None
