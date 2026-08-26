"""Giữ lại để tương thích: các module cũ import `app.db`.

Nguồn thật là app/core/database.py. Không thêm logic mới vào đây.
"""

from app.core.database import execute_query, get_db_connection, pool  # noqa: F401
