"""Truy vấn yêu thích. Chỉ SQL, không nghiệp vụ."""

from datetime import date

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

def thong_ke(
    ngay_dau: date,
    ngay_cuoi_loai_tru: date,
    ngay_dau_ky_truoc: date,
):
    """KPI kinh doanh, kỳ so sánh và chuỗi doanh thu theo ngày.

    Không quét lịch sử toàn hệ thống. Booking và payment đều được giới hạn theo
    khoảng ngày; các index tương ứng nằm trong migration 011.
    """
    rows = execute_query(
        """
        SELECT
          (SELECT count(*) FROM tour_bookings
            WHERE created_at >= %s AND created_at < %s)                            AS dat_tour,
          (SELECT coalesce(sum(guests), 0)::bigint FROM tour_bookings
            WHERE created_at >= %s AND created_at < %s)                            AS so_khach,
          (SELECT coalesce(sum(amount), 0)::bigint FROM payments
            WHERE status = 'SUCCESS'
              AND coalesce(confirmed_at, created_at) >= %s
              AND coalesce(confirmed_at, created_at) < %s)                         AS doanh_thu,
          (SELECT coalesce(avg(amount), 0)::bigint FROM payments
            WHERE status = 'SUCCESS'
              AND coalesce(confirmed_at, created_at) >= %s
              AND coalesce(confirmed_at, created_at) < %s)                         AS gia_tri_don_tb,
          (SELECT count(*) FROM tour_bookings
            WHERE created_at >= %s AND created_at < %s)                            AS dat_tour_truoc,
          (SELECT coalesce(sum(guests), 0)::bigint FROM tour_bookings
            WHERE created_at >= %s AND created_at < %s)                            AS so_khach_truoc,
          (SELECT coalesce(sum(amount), 0)::bigint FROM payments
            WHERE status = 'SUCCESS'
              AND coalesce(confirmed_at, created_at) >= %s
              AND coalesce(confirmed_at, created_at) < %s)                         AS doanh_thu_truoc,
          (SELECT coalesce(avg(amount), 0)::bigint FROM payments
            WHERE status = 'SUCCESS'
              AND coalesce(confirmed_at, created_at) >= %s
              AND coalesce(confirmed_at, created_at) < %s)                         AS gia_tri_don_tb_truoc
        """,
        (
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau_ky_truoc, ngay_dau,
            ngay_dau_ky_truoc, ngay_dau,
            ngay_dau_ky_truoc, ngay_dau,
            ngay_dau_ky_truoc, ngay_dau,
        ),
    )
    row = rows[0] if rows else {}
    hien_tai = {
        "doanh_thu": row.get("doanh_thu", 0),
        "dat_tour": row.get("dat_tour", 0),
        "so_khach": row.get("so_khach", 0),
        "gia_tri_don_tb": row.get("gia_tri_don_tb", 0),
    }
    ky_truoc = {
        "doanh_thu": row.get("doanh_thu_truoc", 0),
        "dat_tour": row.get("dat_tour_truoc", 0),
        "so_khach": row.get("so_khach_truoc", 0),
        "gia_tri_don_tb": row.get("gia_tri_don_tb_truoc", 0),
    }

    chuoi = execute_query(
        """
        WITH ngay AS (
          SELECT generate_series(%s::date, %s::date - 1, interval '1 day')::date AS ngay
        ),
        dat AS (
          SELECT created_at::date AS ngay,
                 count(*)::bigint AS dat_tour
          FROM tour_bookings
          WHERE created_at >= %s AND created_at < %s
          GROUP BY created_at::date
        ),
        thu AS (
          SELECT coalesce(confirmed_at, created_at)::date AS ngay,
                 coalesce(sum(amount), 0)::bigint AS doanh_thu
          FROM payments
          WHERE status = 'SUCCESS'
            AND coalesce(confirmed_at, created_at) >= %s
            AND coalesce(confirmed_at, created_at) < %s
          GROUP BY coalesce(confirmed_at, created_at)::date
        )
        SELECT to_char(n.ngay, 'YYYY-MM-DD') AS ngay,
               coalesce(t.doanh_thu, 0)::bigint AS doanh_thu,
               coalesce(d.dat_tour, 0)::bigint AS dat_tour
        FROM ngay n
        LEFT JOIN thu t USING (ngay)
        LEFT JOIN dat d USING (ngay)
        ORDER BY n.ngay
        """,
        (
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau, ngay_cuoi_loai_tru,
            ngay_dau, ngay_cuoi_loai_tru,
        ),
    )
    return {"stats": hien_tai, "comparison": ky_truoc, "series": chuoi}
