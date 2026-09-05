"""Pydantic schema cho request. Tách khỏi route để service không phụ thuộc HTTP."""

from datetime import date
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
    place_type: str            # 'poi' | 'accommodation'
    place_id: int


class BookingRequest(BaseModel):
    """Yêu cầu đặt chỗ — KHÔNG có giá và KHÔNG thanh toán.

    CSDL không có giá phòng hay tình trạng phòng trống (cột `price_range` gần
    như rỗng, `stars` toàn 0), nên hệ thống chỉ nhận yêu cầu rồi để admin liên
    hệ lại — đúng cách các website du lịch nhỏ ở Việt Nam đang làm.
    """
    place_type: str
    place_id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    guests: int = 1
    note: Optional[str] = None


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
    note: Optional[str] = None


class CreatePaymentRequest(BaseModel):
    """Yêu cầu tạo giao dịch thanh toán (thủ công / chuyển khoản)."""
    method: str = "CHUYEN_KHOAN"  # CHUYEN_KHOAN | TAI_VAN_PHONG | KHAC
    amount: Optional[int] = None   # None = lấy mặc định total_price của booking
    note: Optional[str] = None


class AdminConfirmPaymentRequest(BaseModel):
    """Admin xác nhận giao dịch thanh toán đã nhận tiền."""
    note: Optional[str] = None
