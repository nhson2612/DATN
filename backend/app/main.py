"""Điểm vào FastAPI: chỉ lắp ghép router và hạ tầng ứng dụng."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.middleware import RequestLogMiddleware
from app.core.bootstrap import create_default_users
from app.core.logging import get_logger, setup_logging
from app.self_guided.assistant import routes as assistant_routes
from app.self_guided.destinations import routes as destination_routes
from app.self_guided.favorites import routes as favorite_routes
from app.self_guided.itinerary import routes as itinerary_routes
from app.self_guided.place_detail import routes as place_detail_routes
from app.self_guided.routing import routes as routing_routes
from app.self_guided.search_places import routes as search_place_routes
from app.shared.accounts import routes as account_routes
from app.support import routes as support_routes
from app.tours.admin_reports import routes as report_routes
from app.tours.operator import routes as operator_routes
from app.tours.operator import tour_routes as operator_tour_routes
from app.tours.search_tours import routes as tour_routes
from app.tours.booking_lifecycle import service as booking_lifecycle_service
from app.tours.tour_approval import routes as tour_approval_routes
from app.core.config import settings

setup_logging()
logger = get_logger(__name__)


async def _dọn_booking_quá_hạn() -> None:
    """Chạy suốt vòng đời API để ghế của đơn quá hạn tự trở lại inventory."""
    while True:
        try:
            result = await asyncio.to_thread(booking_lifecycle_service.xu_ly_booking_het_han)
            if result["total_processed"]:
                logger.info("Job giữ chỗ đã xử lý %s đơn", result["total_processed"])
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Job dọn booking quá hạn gặp lỗi")
        await asyncio.sleep(settings.booking_expiry_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Khởi động GeoAI Tourism API")
    create_default_users()
    expiry_task = asyncio.create_task(_dọn_booking_quá_hạn(), name="tour-booking-expiry")
    try:
        yield
    finally:
        expiry_task.cancel()
        try:
            await expiry_task
        except asyncio.CancelledError:
            pass
        logger.info("Tắt GeoAI Tourism API")


app = FastAPI(title="GeoAI Tourism API", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory="uploads", check_dir=False), name="uploads")

app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    account_routes,
    assistant_routes,
    destination_routes,
    search_place_routes,
    place_detail_routes,
    itinerary_routes,
    routing_routes,
    operator_routes,
    operator_tour_routes,
    tour_routes,
    tour_approval_routes,
    support_routes,
):
    app.include_router(module.router)

app.include_router(favorite_routes.router)
app.include_router(report_routes.router)
app.include_router(operator_tour_routes.departures_router)
app.include_router(operator_tour_routes.bookings_router)
app.include_router(support_routes.ws_router)



@app.get("/")
def read_root():
    return {"status": "ok", "message": "GeoAI Tourism API is running"}
