"""SQL cho UC-AD02 — gửi duyệt, duyệt và từ chối tour."""

from app.core.database import execute_query

COT_TOUR = (
    "id, slug, name, summary, description, province_id, duration_days, cover_url, "
    "highlights, transportation, departure_location, tags, itinerary, "
    "cancellation_policy, operator_id, status, active, reject_reason"
)


def get_tour(tour_id):
    rows = execute_query(
        f"SELECT {COT_TOUR} FROM tours WHERE id = %s LIMIT 1", (tour_id,)
    )
    return rows[0] if rows else None


def doi_trang_thai(tour_id, status, active, reject_reason=None):
    """Đổi trạng thái tour. active đi kèm để web khách chỉ thấy tour đã duyệt."""
    rows = execute_query(
        "UPDATE tours SET status = %s, active = %s, reject_reason = %s "
        "WHERE id = %s RETURNING id, name, status, active, reject_reason",
        (status, active, reject_reason, tour_id),
    )
    return rows[0] if rows else None


def danh_sach_cho_duyet():
    """Tour đang chờ duyệt, kèm tên nhà điều hành để admin biết của ai."""
    return execute_query(
        """
        SELECT t.id, t.slug, t.name, t.summary, t.duration_days, t.cover_url,
               t.province_id, t.status, t.created_at,
               o.id AS operator_id, o.company_name
        FROM tours t
        LEFT JOIN operators o ON o.id = t.operator_id
        WHERE t.status = 'PENDING_APPROVAL'
        ORDER BY t.created_at
        """
    )
