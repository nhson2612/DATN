"""Truy vấn `favorites` và `booking_requests`. Chỉ SQL, không nghiệp vụ."""

from app.core.database import execute_query

BANG_HOP_LE = ("poi", "accommodation")


# ── Yêu thích ────────────────────────────────────────────────────────────────

def list_favorites(user_id: int):
    """Kèm tên và toạ độ để frontend vẽ được ngay, không phải gọi thêm."""
    return execute_query(
        """
        SELECT f.id, f.place_type, f.place_id, f.created_at,
               COALESCE(p.name, a.name) AS name,
               COALESCE(p.amenity, a.tourism) AS category,
               ST_X(COALESCE(p.geom, a.geom)) AS lon,
               ST_Y(COALESCE(p.geom, a.geom)) AS lat,
               ph.url AS anh
        FROM favorites f
        LEFT JOIN poi p           ON f.place_type = 'poi'           AND p.id = f.place_id
        LEFT JOIN accommodation a ON f.place_type = 'accommodation' AND a.id = f.place_id
        LEFT JOIN place_photos ph ON ph.place_type = f.place_type   AND ph.place_id = f.place_id
        WHERE f.user_id = %s AND COALESCE(p.id, a.id) IS NOT NULL
        ORDER BY f.created_at DESC
        """,
        (user_id,),
    ) or []


def add_favorite(user_id: int, place_type: str, place_id: int):
    """ON CONFLICT DO NOTHING: bấm tim hai lần không được thành lỗi 500."""
    rows = execute_query(
        """
        INSERT INTO favorites (user_id, place_type, place_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id, place_type, place_id) DO NOTHING
        RETURNING id
        """,
        (user_id, place_type, place_id),
    )
    return rows[0]["id"] if rows else None


def remove_favorite(user_id: int, place_type: str, place_id: int):
    return bool(execute_query(
        """
        DELETE FROM favorites
        WHERE user_id = %s AND place_type = %s AND place_id = %s
        RETURNING id
        """,
        (user_id, place_type, place_id),
    ))


# ── Yêu cầu đặt chỗ ──────────────────────────────────────────────────────────

def create_booking(data: dict, user_id=None):
    rows = execute_query(
        """
        INSERT INTO booking_requests
            (user_id, place_type, place_id, full_name, phone, email,
             check_in, check_out, guests, note)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (user_id, data["place_type"], data["place_id"], data["full_name"],
         data["phone"], data.get("email"), data.get("check_in"),
         data.get("check_out"), data.get("guests") or 1, data.get("note")),
    )
    return rows[0]["id"] if rows else None


def list_bookings(status=None, limit: int = 100):
    """Danh sách cho trang quản trị. Kèm tên địa điểm để admin khỏi tra tay."""
    dieu_kien = "WHERE b.status = %s" if status else ""
    params = (status, limit) if status else (limit,)
    return execute_query(
        f"""
        SELECT b.*, COALESCE(p.name, a.name) AS place_name
        FROM booking_requests b
        LEFT JOIN poi p           ON b.place_type = 'poi'           AND p.id = b.place_id
        LEFT JOIN accommodation a ON b.place_type = 'accommodation' AND a.id = b.place_id
        {dieu_kien}
        ORDER BY b.created_at DESC
        LIMIT %s
        """,
        params,
    ) or []


def update_booking_status(booking_id: int, status: str):
    return bool(execute_query(
        "UPDATE booking_requests SET status = %s WHERE id = %s RETURNING id",
        (status, booking_id),
    ))


# ── Thống kê cho trang quản trị ──────────────────────────────────────────────

def thong_ke():
    """Số liệu thật cho trang quản trị.

    Đếm chính xác bằng COUNT(*). Bản đầu dùng `reltuples` của bộ lập kế hoạch để
    tránh quét toàn bảng, nhưng đo lại thì con số đó lệch 15,6% ở bảng
    accommodation (60.180 ước lượng / 52.046 thật) vì bảng chưa được ANALYZE sau
    lần import cuối — trong khi COUNT(*) chỉ mất 33ms + 5ms nhờ index-only scan.
    Đổi 38ms lấy một con số sai 8 nghìn dòng là món hời ngược.
    """
    rows = execute_query(
        """
        SELECT
          (SELECT count(*) FROM poi)                                               AS poi,
          (SELECT count(*) FROM accommodation)                                     AS luu_tru,
          (SELECT count(*) FROM users)                                             AS nguoi_dung,
          (SELECT count(*) FROM itineraries)                                       AS lich_trinh,
          (SELECT count(*) FROM tours)                                             AS tour,
          (SELECT count(*) FROM booking_requests WHERE status = 'moi')             AS dat_cho_moi,
          (SELECT count(*) FROM tour_bookings)                                     AS dat_tour,
          (SELECT count(*) FROM place_photos)                                      AS anh
        """
    )
    return rows[0] if rows else {}
