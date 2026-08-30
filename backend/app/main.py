"""Điểm vào FastAPI. Chỉ lắp ghép, không chứa logic nghiệp vụ hay SQL.

Cấu trúc:
  api/routes/     tầng HTTP — không có SQL
  services/       nghiệp vụ — không biết HTTP
  repositories/   SQL — không có nghiệp vụ
  core/           cấu hình, DB, bảo mật
  research/       phần luận văn (ir, ir_agent, agent_legacy, benchmark)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware import RequestLogMiddleware
from app.api.routes import (auth, chat, destinations, engagement, itineraries,
                            places, routing, tours)
from app.core.bootstrap import create_default_users
from app.core.logging import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Khởi động GeoAI Tourism API")
    create_default_users()
    yield
    logger.info("Tắt GeoAI Tourism API")


app = FastAPI(title="GeoAI Tourism API", lifespan=lifespan)

app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, chat, routing, places, itineraries, destinations):
    app.include_router(module.router)

# destinations.py giữ thêm một router cho /api/places/search và trang chi tiết.
app.include_router(destinations.places_router)
app.include_router(engagement.fav_router)
app.include_router(engagement.booking_router)
app.include_router(tours.router)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "GeoAI Tourism API is running"}
