import os
from contextlib import contextmanager
from psycopg_pool import ConnectionPool

DB_CONN = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gis_tourism")

# Initialize connection pool
pool = ConnectionPool(conninfo=DB_CONN, min_size=2, max_size=10)

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
