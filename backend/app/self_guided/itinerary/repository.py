"""Truy vấn bảng itineraries. Mọi hàm đều gắn user_id để không rò dữ liệu."""

import json

from app.core.database import execute_query

_COLS = ("id, user_id, name, description, duration_days, stops, created_at, "
         "start_date, destination, sections")


def list_for_user(user_id: int):
    return execute_query(
        f"SELECT {_COLS} FROM itineraries WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,),
    ) or []


def owned_by(itinerary_id: int, user_id: int) -> bool:
    """Kiểm quyền sở hữu. Tách riêng để route không tự viết lại điều kiện."""
    return bool(
        execute_query(
            "SELECT id FROM itineraries WHERE id = %s AND user_id = %s",
            (itinerary_id, user_id),
        )
    )


def create(user_id: int, name: str, description, duration_days: int, stops,
           start_date=None, destination=None, sections=None):
    rows = execute_query(
        """
        INSERT INTO itineraries
            (user_id, name, description, duration_days, stops,
             start_date, destination, sections)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (user_id, name, description, duration_days, json.dumps(stops),
         start_date, destination, json.dumps(sections or [])),
    )
    return rows[0]["id"] if rows else None


def update(itinerary_id: int, name: str, description, duration_days: int, stops,
           start_date=None, destination=None, sections=None):
    execute_query(
        """
        UPDATE itineraries
        SET name = %s, description = %s, duration_days = %s, stops = %s,
            start_date = %s, destination = %s, sections = %s
        WHERE id = %s
        """,
        (name, description, duration_days, json.dumps(stops),
         start_date, destination, json.dumps(sections or []), itinerary_id),
    )


def delete(itinerary_id: int):
    execute_query("DELETE FROM itineraries WHERE id = %s", (itinerary_id,))
