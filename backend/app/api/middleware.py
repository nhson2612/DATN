"""Middleware gắn request_id và ghi log mỗi request."""

import time

from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger, new_request_id, request_id_var

logger = get_logger(__name__)


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
        # 5xx là lỗi phía ta -> ERROR; 4xx là lỗi phía client -> INFO.
        level_log = logger.error if response.status_code >= 500 else logger.info
        level_log(
            "%s %s -> %d trong %.0fms",
            request.method, request.url.path, response.status_code, ms,
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
