"""Connection pool PostGIS. Cấu hình lấy từ core.config, không hardcode."""

import time
from contextlib import contextmanager

from psycopg_pool import ConnectionPool

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=settings.db_pool_min,
    max_size=settings.db_pool_max,
)
logger.info(
    "Khởi tạo pool PostGIS: db=%s min=%d max=%d",
    settings.database_url.rsplit("/", 1)[-1],
    settings.db_pool_min,
    settings.db_pool_max,
)


@contextmanager
def get_db_connection():
    with pool.connection() as conn:
        yield conn


def _short(query: str) -> str:
    return " ".join(query.split())[:160]


def execute_query(query, params=None):
    """Chạy một câu SQL. Ghi log câu chậm, và ghi log mọi câu nếu LOG_SQL=true.

    Câu chậm luôn được ghi WARNING kể cả khi LOG_SQL=false — đây là chỗ duy nhất
    thấy được truy vấn nào đang tốn thời gian mà không phải bật log toàn bộ.
    """
    t0 = time.perf_counter()
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                if cur.description:
                    columns = [desc[0] for desc in cur.description]
                    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
                else:
                    conn.commit()
                    rows = None
    except Exception:
        ms = (time.perf_counter() - t0) * 1000
        logger.error(
            "SQL lỗi sau %.0fms: %s", ms, _short(query),
            extra={"ctx_duration_ms": round(ms, 1)},
            exc_info=True,
        )
        raise

    ms = (time.perf_counter() - t0) * 1000
    n = len(rows) if rows is not None else 0
    if ms >= settings.log_slow_query_ms:
        logger.warning(
            "SQL chậm %.0fms (%d dòng): %s", ms, n, _short(query),
            extra={"ctx_duration_ms": round(ms, 1), "ctx_rows": n},
        )
    elif settings.log_sql:
        logger.debug(
            "SQL %.0fms (%d dòng): %s", ms, n, _short(query),
            extra={"ctx_duration_ms": round(ms, 1), "ctx_rows": n},
        )
    return rows
