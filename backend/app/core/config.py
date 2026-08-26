"""Cấu hình tập trung. KHÔNG hardcode giá trị nào ngoài file này.

Đọc từ biến môi trường và từ file .env ở gốc repo. Mọi module — kể cả các script
standalone trong backend/scripts/ — phải lấy cấu hình qua `settings` ở đây thay
vì tự gọi os.getenv, để chỉ có một nguồn sự thật.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- Cơ sở dữ liệu ----
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/gis_tourism",
        description="DSN PostGIS. Đổi sang gis_vietnam để dùng dữ liệu toàn quốc.",
    )
    db_pool_min: int = 2
    db_pool_max: int = 10

    # ---- LLM ----
    llm_provider: Literal["ollama", "groq"] = "ollama"
    llm_timeout: int = Field(default=300, ge=1)
    ollama_url: str = "http://localhost:11434/api/generate"
    ollama_model: str = "qwen2.5:7b"
    groq_url: str = "https://api.groq.com/openai/v1/chat/completions"
    groq_model: str = "qwen/qwen3.6-27b"
    groq_api_key: str | None = None

    # Timeout riêng cho từng loại lời gọi (giây)
    llm_timeout_sql: int = 120
    llm_timeout_explain: int = 90

    # ---- Bảo mật ----
    # KHÔNG có giá trị mặc định. Thiếu là app từ chối khởi động — trước đây
    # fallback "danang_gis_tourism_secret_key_12345" nằm ngay trong code đã
    # push lên GitHub, ai đọc repo cũng tự ký được token admin.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # ---- Định tuyến ----
    max_snap_distance_meters: int = 1500
    min_component_size: int = Field(
        default=100,
        description="Chỉ snap vào đỉnh thuộc component lớn hơn ngưỡng này.",
    )

    # ---- Hiển thị bản đồ ----
    roads_simplify_tolerance: float = 0.00005
    roads_feature_limit: int = 20000

    # ---- Trình biên dịch IR ----
    ir_max_limit: int = 100
    ir_default_limit: int = 20
    ir_max_attempts: int = 3

    # ---- Ghi log ----
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["text", "json"] = "text"
    log_file: str | None = Field(
        default=None,
        description="Đường dẫn file log. Bỏ trống thì chỉ ghi ra stdout.",
    )
    log_sql: bool = Field(
        default=False,
        description="Ghi log mọi câu SQL kèm thời gian chạy. Rất ồn, chỉ dùng khi debug.",
    )
    log_slow_query_ms: int = Field(
        default=500,
        description="Câu SQL chậm hơn ngưỡng này luôn được ghi WARNING, kể cả khi LOG_SQL=false.",
    )

    # ---- Tài khoản khởi tạo lần đầu ----
    # Chỉ được tạo khi bảng users còn trống. Mật khẩu trước đây hardcode
    # "admin"/"123456" ngay trong main.py.
    seed_admin_email: str = "admin@gmail.com"
    seed_admin_password: str = "admin"
    seed_user_email: str = "user@gmail.com"
    seed_user_password: str = "123456"

    # ---- Vị trí mặc định (Đà Nẵng) khi không phân giải được IP ----
    default_lon: float = 108.206
    default_lat: float = 16.047
    geoip_timeout: int = 3

    @field_validator("jwt_secret")
    @classmethod
    def _reject_known_leaked_secret(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError("JWT_SECRET phải dài ít nhất 16 ký tự")
        if v == "danang_gis_tourism_secret_key_12345":
            raise ValueError(
                "JWT_SECRET này đã bị lộ trên GitHub — phải đổi sang giá trị mới"
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def reload_settings() -> Settings:
    """Đọc lại cấu hình từ môi trường hiện tại.

    `settings` được nạp một lần lúc import (qua lru_cache) nên thay đổi
    os.environ sau đó KHÔNG có tác dụng. Dùng hàm này khi thật sự cần đổi
    cấu hình lúc đang chạy — chủ yếu là test. Nó cập nhật tại chỗ đối tượng
    `settings` để mọi module đã `from ... import settings` cũng thấy giá trị mới.
    """
    get_settings.cache_clear()
    fresh = get_settings()
    for name in type(fresh).model_fields:
        object.__setattr__(settings, name, getattr(fresh, name))
    return settings
