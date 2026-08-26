"""Truy vấn bảng users."""

from app.core.database import execute_query


def find_by_email(email: str):
    rows = execute_query(
        "SELECT id, email, hashed_password, full_name, role FROM users "
        "WHERE email = %s LIMIT 1",
        (email,),
    )
    return rows[0] if rows else None


def email_exists(email: str) -> bool:
    return bool(execute_query("SELECT id FROM users WHERE email = %s LIMIT 1", (email,)))


def create(email: str, hashed_password: str, full_name: str, role: str = "user"):
    execute_query(
        "INSERT INTO users (email, hashed_password, full_name, role) "
        "VALUES (%s, %s, %s, %s)",
        (email, hashed_password, full_name, role),
    )
