"""Truy vấn yêu thích. Chỉ SQL, không nghiệp vụ."""

from app.core.database import execute_query

BANG_HOP_LE = ("trackasia", "serper", "accommodation")


# ── Yêu thích ────────────────────────────────────────────────────────────────

def list_favorites(user_id: int):
    """Kèm tên và toạ độ để frontend vẽ được ngay, không phải gọi thêm."""
    return execute_query(
        """
        SELECT f.id, f.place_type, f.place_id, f.created_at,
               COALESCE(a.name, f.place_id) AS name,
               a.tourism AS category,
               ST_X(a.geom) AS lon,
               ST_Y(a.geom) AS lat,
               ph.url AS anh
        FROM favorites f
        LEFT JOIN accommodation a ON f.place_type = 'accommodation' AND a.id = f.place_id
        LEFT JOIN place_photos ph ON ph.place_type = f.place_type   AND ph.place_id = f.place_id
        WHERE f.user_id = %s AND (f.place_type IN ('trackasia', 'serper') OR a.id IS NOT NULL)
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


# ── Thống kê cho trang quản trị ──────────────────────────────────────────────

def thong_ke():
    """Số liệu cho trang quản trị: việc phải xử lý và tiền đã thu.

    Chỉ đưa ra con số mà người vận hành phải hành động dựa vào: đơn chờ xử lý,
    tiền đã thu, thanh toán chờ xác nhận, tour đang mở. Các bộ đếm nội bộ
    (số ảnh đã cache, số POI của nhà cung cấp) đã bỏ — chúng chỉ nói về cách
    hệ thống lưu dữ liệu, không nói được gì về việc kinh doanh.

    Đếm bằng COUNT(*), không dùng `reltuples` của bộ lập kế hoạch: bản cũ lệch
    15,6% ở bảng accommodation (60.180 ước lượng / 52.046 thật) khi bảng chưa
    ANALYZE sau lần import cuối.
    """
    rows = execute_query(
        """
        SELECT
          (SELECT count(*) FROM accommodation)                                     AS luu_tru,
          (SELECT count(*) FROM users)                                             AS nguoi_dung,
          (SELECT count(*) FROM itineraries)                                       AS lich_trinh,
          (SELECT count(*) FROM tours WHERE status = 'ACTIVE')                     AS tour_dang_mo,
          (SELECT count(*) FROM tour_bookings)                                     AS dat_tour,
          (SELECT coalesce(sum(amount), 0)::bigint FROM payments
            WHERE status = 'SUCCESS')                                              AS doanh_thu,
          (SELECT count(*) FROM payments WHERE status = 'PENDING')                 AS cho_xac_nhan,
          (SELECT count(*) FROM payments WHERE status = 'MISMATCH')                AS lech_tien
        """
    )
    return rows[0] if rows else {}
