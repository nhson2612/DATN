"""Pydantic schema cho request. Tách khỏi route để service không phụ thuộc HTTP."""

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


class RecommendRequest(BaseModel):
    duration_days: int
    preferences: str
    budget: str
