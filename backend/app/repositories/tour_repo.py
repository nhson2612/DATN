"""Truy vấn tour trọn gói. Chỉ SQL."""

import json

from app.core.database import execute_query

_COLS = """t.id, t.slug, t.name, t.summary, t.description, t.province_id,
           t.duration_days, t.price_from, t.cover_url, t.highlights,
           t.itinerary, t.included, t.excluded, t.created_at"""


def list_tours(province_id=None, max_days=None, max_price=None, limit=24, offset=0):
    dieu_kien = ["t.active"]
    params = []
    if province_id:
        dieu_kien.append("t.province_id = %s")
        params.append(province_id)
    if max_days:
        dieu_kien.append("t.duration_days <= %s")
        params.append(max_days)
    if max_price:
        dieu_kien.append("t.price_from <= %s")
        params.append(max_price)

    rows = execute_query(
        f"""
        SELECT {_COLS}, p.name AS province_name,
               (SELECT min(depart_date) FROM tour_departures d
                 WHERE d.tour_id = t.id AND d.depart_date >= CURRENT_DATE
                   AND d.seats_left > 0) AS ngay_gan_nhat,
               count(*) OVER () AS tong
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        WHERE {" AND ".join(dieu_kien)}
        ORDER BY t.price_from NULLS LAST, t.id
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (limit, offset),
    ) or []
    tong = rows[0]["tong"] if rows else 0
    for r in rows:
        r.pop("tong", None)
    return rows, tong


def get_tour(slug: str):
    rows = execute_query(
        f"""
        SELECT {_COLS}, p.name AS province_name
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        WHERE t.slug = %s AND t.active
        """,
        (slug,),
    )
    return rows[0] if rows else None


def departures(tour_id: int):
    """Chỉ trả đợt còn chỗ và chưa khởi hành — khách không đặt được đợt đã qua."""
    return execute_query(
        """
        SELECT id, depart_date, price, seats_total, seats_left
        FROM tour_departures
        WHERE tour_id = %s AND depart_date >= CURRENT_DATE AND seats_left > 0
        ORDER BY depart_date
        """,
        (tour_id,),
    ) or []


def places_of_tour(itinerary):
    """Địa điểm nhắc trong lịch trình tour -> tra tên và toạ độ để vẽ bản đồ."""
    ids = []
    for ngay in itinerary or []:
        ids.extend(ngay.get("place_ids") or [])
    if not ids:
        return {}
    rows = execute_query(
        """
        SELECT id, name, amenity AS category,
               ST_X(geom) AS lon, ST_Y(geom) AS lat
        FROM poi WHERE id = ANY(%s)
        """,
        (list(set(ids)),),
    ) or []
    return {r["id"]: r for r in rows}


def create_booking(data: dict, user_id=None, total_price=None):
    rows = execute_query(
        """
        INSERT INTO tour_bookings
            (tour_id, departure_id, user_id, full_name, phone, email,
             guests, note, total_price)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (data["tour_id"], data.get("departure_id"), user_id, data["full_name"],
         data["phone"], data.get("email"), data.get("guests") or 1,
         data.get("note"), total_price),
    )
    return rows[0]["id"] if rows else None


def giu_cho(departure_id: int, guests: int):
    """Trừ chỗ, chỉ khi còn đủ.

    Điều kiện `seats_left >= %s` nằm trong chính câu UPDATE để hai người đặt
    cùng lúc không cùng thấy "còn 2 chỗ" rồi cùng đặt 2 — kiểm tra rồi mới trừ
    ở tầng ứng dụng là có khe hở.
    """
    rows = execute_query(
        """
        UPDATE tour_departures SET seats_left = seats_left - %s
        WHERE id = %s AND seats_left >= %s
        RETURNING seats_left, price
        """,
        (guests, departure_id, guests),
    )
    return rows[0] if rows else None


def list_bookings(status=None, limit=100):
    dieu_kien = "WHERE b.status = %s" if status else ""
    params = (status, limit) if status else (limit,)
    return execute_query(
        f"""
        SELECT b.*, t.name AS tour_name, d.depart_date
        FROM tour_bookings b
        JOIN tours t ON t.id = b.tour_id
        LEFT JOIN tour_departures d ON d.id = b.departure_id
        {dieu_kien}
        ORDER BY b.created_at DESC
        LIMIT %s
        """,
        params,
    ) or []


def create_tour(data: dict):
    rows = execute_query(
        """
        INSERT INTO tours (slug, name, summary, description, province_id,
                           duration_days, price_from, cover_url, highlights,
                           itinerary, included, excluded)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name, summary = EXCLUDED.summary,
            description = EXCLUDED.description, province_id = EXCLUDED.province_id,
            duration_days = EXCLUDED.duration_days, price_from = EXCLUDED.price_from,
            cover_url = EXCLUDED.cover_url, highlights = EXCLUDED.highlights,
            itinerary = EXCLUDED.itinerary, included = EXCLUDED.included,
            excluded = EXCLUDED.excluded
        RETURNING id
        """,
        (data["slug"], data["name"], data.get("summary"), data.get("description"),
         data.get("province_id"), data["duration_days"], data.get("price_from"),
         data.get("cover_url"),
         json.dumps(data.get("highlights") or [], ensure_ascii=False),
         json.dumps(data.get("itinerary") or [], ensure_ascii=False),
         data.get("included"), data.get("excluded")),
    )
    return rows[0]["id"] if rows else None


def add_departure(tour_id: int, depart_date, price, seats: int = 20):
    execute_query(
        """
        INSERT INTO tour_departures (tour_id, depart_date, price, seats_total, seats_left)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (tour_id, depart_date) DO UPDATE
            SET price = EXCLUDED.price
        """,
        (tour_id, depart_date, price, seats, seats),
    )
