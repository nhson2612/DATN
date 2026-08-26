"""Cấu hình logging tập trung.

Trước đây toàn bộ dự án dùng print(), nên không phân biệt được mức độ, không có
timestamp, không tắt/bật được, và không ghi ra file. Mọi module nên dùng
`get_logger(__name__)` thay cho print().
"""

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from app.core.config import settings

# Id gắn theo từng request, để lần được toàn bộ log của một lượt gọi API.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_CONFIGURED = False


class _RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get()
        return True


class _JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }
        # Các trường phụ do caller truyền qua extra=
        for key, value in record.__dict__.items():
            if key.startswith("ctx_"):
                payload[key[4:]] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


_TEXT_FORMAT = "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"


def setup_logging() -> None:
    """Gọi một lần lúc khởi động ứng dụng. An toàn khi gọi lại."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    formatter = (
        _JsonFormatter()
        if settings.log_format == "json"
        else logging.Formatter(_TEXT_FORMAT, datefmt="%H:%M:%S")
    )
    id_filter = _RequestIdFilter()

    handlers = [logging.StreamHandler(sys.stdout)]
    if settings.log_file:
        handlers.append(logging.FileHandler(settings.log_file, encoding="utf-8"))
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.addFilter(id_filter)

    root = logging.getLogger()
    root.setLevel(settings.log_level)
    for existing in list(root.handlers):
        root.removeHandler(existing)
    for handler in handlers:
        root.addHandler(handler)

    # uvicorn tự cấu hình logger riêng; cho chúng dùng chung handler của ta.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = handlers
        uvicorn_logger.propagate = False

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)


def new_request_id() -> str:
    return uuid.uuid4().hex[:8]


class log_duration:
    """Đo và ghi thời gian một khối lệnh.

    Dùng cho các bước đắt tiền — gọi LLM, pgr_dijkstra — nơi cần biết thời gian
    thật nằm ở đâu. Ném exception vẫn ghi log, kèm mức ERROR.
    """

    def __init__(self, logger: logging.Logger, what: str, level=logging.INFO, **ctx):
        self.logger = logger
        self.what = what
        self.level = level
        self.ctx = {f"ctx_{k}": v for k, v in ctx.items()}

    def __enter__(self):
        self.t0 = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb):
        ms = (time.perf_counter() - self.t0) * 1000
        extra = {**self.ctx, "ctx_duration_ms": round(ms, 1)}
        if exc_type is not None:
            self.logger.error("%s thất bại sau %.0fms: %s", self.what, ms, exc, extra=extra)
        else:
            self.logger.log(self.level, "%s xong trong %.0fms", self.what, ms, extra=extra)
        return False
