"""Middleware gắn request_id và ghi log mỗi request."""

import time

from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger, new_request_id, request_id_var

logger = get_logger(__name__)


def _human_ms(ms: float) -> str:
    """120134ms không đọc được bằng mắt; 2m0.1s thì đọc được."""
    if ms < 1000:
        return f"{ms:.0f}ms"
    if ms < 60_000:
        return f"{ms / 1000:.1f}s"
    return f"{int(ms // 60_000)}m{ms % 60_000 / 1000:.1f}s"


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Sinh request_id, ghi log kết quả và thời gian của từng request.

    request_id được đưa vào ContextVar nên mọi dòng log phát sinh trong cùng
    request đều mang cùng id — lần được toàn bộ một lượt gọi API, kể cả các câu
    SQL do repository chạy.
    """

    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id") or new_request_id()
        token = request_id_var.set(rid)
        t0 = time.perf_counter()

        # Log NGAY khi nhận request. Nếu chỉ log lúc kết thúc thì suốt thời gian
        # xử lý không thấy gì — một /api/chat mất 2 phút trông y như treo.
        logger.info("→ %s %s", request.method, request.url.path,
                    extra={"ctx_method": request.method, "ctx_path": request.url.path})
        try:
            response = await call_next(request)
        except Exception:
            ms = (time.perf_counter() - t0) * 1000
            logger.exception(
                "%s %s lỗi không bắt được sau %.0fms",
                request.method, request.url.path, ms,
                extra={"ctx_duration_ms": round(ms, 1)},
            )
            request_id_var.reset(token)
            raise

        ms = (time.perf_counter() - t0) * 1000
        # 5xx -> ERROR. Request chậm bất thường -> WARNING dù trả 200: một
        # /api/chat mất 2 phút là dấu hiệu có vấn đề, không phải chuyện bình thường.
        if response.status_code >= 500:
            level_log = logger.error
        elif ms >= settings.slow_request_warn_ms:
            level_log = logger.warning
        else:
            level_log = logger.info
        level_log(
            "← %s %s %d %s",
            request.method, request.url.path, response.status_code, _human_ms(ms),
            extra={
                "ctx_duration_ms": round(ms, 1),
                "ctx_status": response.status_code,
                "ctx_method": request.method,
                "ctx_path": request.url.path,
            },
        )
        response.headers["X-Request-ID"] = rid
        request_id_var.reset(token)
        return response
