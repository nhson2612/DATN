"""Connection pool PostGIS. Cấu hình lấy từ core.config, không hardcode."""

from contextlib import contextmanager

from psycopg_pool import ConnectionPool

from app.core.config import settings

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=settings.db_pool_min,
    max_size=settings.db_pool_max,
)


@contextmanager
def get_db_connection():
    with pool.connection() as conn:
        yield conn


def execute_query(query, params=None):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
            conn.commit()
            return None
