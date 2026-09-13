"""Điểm vào FastAPI: chỉ lắp ghép router và hạ tầng ứng dụng."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.middleware import RequestLogMiddleware
from app.core.bootstrap import create_default_users
from app.core.logging import get_logger, setup_logging
from app.self_guided.assistant import routes as assistant_routes
from app.self_guided.booking_request import routes as booking_request_routes
from app.self_guided.destinations import routes as destination_routes
from app.self_guided.favorites import routes as favorite_routes
from app.self_guided.itinerary import routes as itinerary_routes
from app.self_guided.place_detail import routes as place_detail_routes
from app.self_guided.routing import routes as routing_routes
from app.self_guided.search_places import routes as search_place_routes
from app.shared.accounts import routes as account_routes
from app.tours.admin_reports import routes as report_routes
from app.tours.operator import routes as operator_routes
from app.tours.operator import tour_routes as operator_tour_routes
from app.tours.search_tours import routes as tour_routes
from app.tours.tour_approval import routes as tour_approval_routes

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Khởi động GeoAI Tourism API")
    create_default_users()
    yield
    logger.info("Tắt GeoAI Tourism API")


app = FastAPI(title="GeoAI Tourism API", lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory="uploads", check_dir=False), name="uploads")

app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
):
    app.include_router(module.router)

app.include_router(favorite_routes.router)
app.include_router(booking_request_routes.router)
app.include_router(report_routes.router)
app.include_router(operator_tour_routes.departures_router)
app.include_router(operator_tour_routes.bookings_router)



@app.get("/")
def read_root():
    return {"status": "ok", "message": "GeoAI Tourism API is running"}
