"""Truy vấn bảng boundaries (ranh giới hành chính)."""

from app.core.database import execute_query


def match_by_name(name: str):
    """Ứng viên khớp tên, kèm cờ khớp chính xác — dùng để phát hiện nhập nhằng.

    Ở quy mô toàn quốc chuyện trùng tên là mặc định: 'Xã Tân Thành' khớp 14
    ranh giới, nên heuristic 'lấy cái to nhất' sẽ sai 93%.
    """
    return execute_query(
        """
        SELECT name,
               unaccent(lower(name)) = unaccent(lower(%s)) AS exact_hit
        FROM boundaries
        WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))
        ORDER BY length(name)
        """,
        (name, f"%{name}%"),
    ) or []
