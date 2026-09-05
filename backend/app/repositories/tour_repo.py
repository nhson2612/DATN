"""Truy vấn tour trọn gói. Chỉ SQL."""

import json
from datetime import date
from typing import Optional

from app.core.database import Transaction, execute_query

_COLS = """t.id, t.slug, t.name, t.summary, t.description, t.province_id,
           t.duration_days, t.cover_url, t.highlights,
           t.itinerary, t.included, t.excluded, t.created_at"""

_COLS_CACHE = {}
_TABLES_CACHE = {}


def _has_col(table: str, col: str) -> bool:
    """Kiểm tra cột có trong bảng không, cache kết quả để không query information_schema liên tục.

    Lý do: Giúp code chạy an toàn trên cả database thật chưa chạy migration
    lẫn database đã chạy migration hoàn chỉnh mà không bị lỗi 'column does not exist'.
    """
    key = f"{table}.{col}"
    if key not in _COLS_CACHE:
        try:
            rows = execute_query(
                "SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s",
                (table, col),
            )
            _COLS_CACHE[key] = bool(rows)
        except Exception:
            _COLS_CACHE[key] = False
    return _COLS_CACHE[key]


def _has_table(table: str) -> bool:
    """Kiểm tra bảng có tồn tại trong CSDL không, cache kết quả tương tự _has_col."""
    if table not in _TABLES_CACHE:
        try:
            rows = execute_query(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s",
                (table,),
            )
            _TABLES_CACHE[table] = bool(rows)
        except Exception:
            _TABLES_CACHE[table] = False
    return _TABLES_CACHE[table]


def _exec(query: str, params=None, tx: Optional[Transaction] = None):
    """Chạy câu query trong transaction nếu có truyền tx, ngược lại dùng execute_query độc lập.

    Giúp các hàm repo (như giu_cho, create_booking) có thể được gọi độc lập như cũ
    hoặc gọi chung trong một transaction khi cần tính nguyên tử.
    """
    if tx is not None:
        if hasattr(tx, "execute"):
            return tx.execute(query, params)
        return Transaction(tx).execute(query, params)
    return execute_query(query, params)


def sql_gia_ban_hieu_luc(alias: str = "d") -> str:
    """Biểu thức SQL tương đương hàm gia_ban_hieu_luc ở tầng service.

    Dùng trong WHERE và ORDER BY để đảm bảo tính nhất quán tuyệt đối giữa logic
    ứng dụng và SQL truy vấn. Lọc hay sắp xếp theo giá luôn dùng giá bán thực tế
    mà khách phải trả, không dùng giá gốc.
    """
    has_list_price = _has_col("tour_departures", "list_price")
    has_sale_price = _has_col("tour_departures", "sale_price")

    lp = f"{alias}.list_price" if has_list_price else f"{alias}.price"
    if not has_sale_price:
        return lp

    return f"""
        CASE
            WHEN {alias}.sale_price IS NOT NULL
                 AND {alias}.sale_price > 0
                 AND {alias}.sale_price < {lp}
                 AND ({alias}.sale_starts_at IS NULL OR {alias}.sale_starts_at <= CURRENT_TIMESTAMP)
                 AND ({alias}.sale_ends_at IS NULL OR {alias}.sale_ends_at >= CURRENT_TIMESTAMP)
            THEN {alias}.sale_price
            ELSE {lp}
        END
    """.strip()


def list_tours(province_id=None, max_days=None, max_price=None, limit=24, offset=0):
    """Danh sách tour kèm bộ lọc và giá bán hiệu lực thấp nhất từ các đợt còn mở.

    Khách lọc 'dưới 5 triệu' phải thấy tour giá gốc 6 triệu đang khuyến mãi còn 4,5 triệu.
    Đồng thời trả về original_price để giao diện hiển thị gạch ngang mức giá gốc.
    """
    dieu_kien = ["t.active"]
    params = []
    if province_id:
        dieu_kien.append("t.province_id = %s")
        params.append(province_id)
    if max_days:
        dieu_kien.append("t.duration_days <= %s")
        params.append(max_days)

    sql_eff = sql_gia_ban_hieu_luc("d")
    has_list_price = _has_col("tour_departures", "list_price")
    has_status = _has_col("tour_departures", "status")
    sql_lp = "d.list_price" if has_list_price else "d.price"
    status_filter = "AND d.status = 'OPEN'" if has_status else ""

    # Subquery tính giá bán hiệu lực thấp nhất từ các đợt khởi hành còn mở
    sub_eff = f"""
        (SELECT min({sql_eff})
         FROM tour_departures d
         WHERE d.tour_id = t.id
           AND d.depart_date >= CURRENT_DATE
           AND d.seats_left > 0
           {status_filter})
    """
    gia_hien_tai = f"COALESCE({sub_eff}, t.price_from)"

    # Subquery lấy giá gốc của đợt rẻ nhất đó để hiển thị gạch ngang
    sub_orig = f"""
        (SELECT {sql_lp}
         FROM tour_departures d
         WHERE d.tour_id = t.id
           AND d.depart_date >= CURRENT_DATE
           AND d.seats_left > 0
           {status_filter}
         ORDER BY {sql_eff} ASC, d.depart_date ASC
         LIMIT 1)
    """

    if max_price:
        dieu_kien.append(f"{gia_hien_tai} <= %s")
        params.append(max_price)

    rows = execute_query(
        f"""
        SELECT {_COLS}, p.name AS province_name,
               {gia_hien_tai} AS price_from,
               {sub_orig} AS original_price,
               (SELECT min(depart_date) FROM tour_departures d
                 WHERE d.tour_id = t.id AND d.depart_date >= CURRENT_DATE
                   AND d.seats_left > 0 {status_filter}) AS ngay_gan_nhat,
               count(*) OVER () AS tong
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        WHERE {" AND ".join(dieu_kien)}
        ORDER BY {gia_hien_tai} NULLS LAST, t.id
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (limit, offset),
    ) or []

    tong = rows[0]["tong"] if rows else 0
    for r in rows:
        r.pop("tong", None)
        # Làm giàu nhãn khuyến mãi để thẻ tour hiển thị ngay
        orig = r.get("original_price")
        curr = r.get("price_from")
        if orig and curr and curr < orig:
            r["is_sale"] = True
            r["discount_pct"] = round((orig - curr) / orig * 100)
        else:
            r["is_sale"] = False
            r["discount_pct"] = 0
            if orig is None:
                r["original_price"] = curr

    return rows, tong


def get_tour(slug: str):
    """Chi tiết tour cùng giá bán hiệu lực và giá gốc của đợt rẻ nhất."""
    sql_eff = sql_gia_ban_hieu_luc("d")
    has_list_price = _has_col("tour_departures", "list_price")
    has_status = _has_col("tour_departures", "status")
    sql_lp = "d.list_price" if has_list_price else "d.price"
    status_filter = "AND d.status = 'OPEN'" if has_status else ""

    sub_eff = f"""
        (SELECT min({sql_eff})
         FROM tour_departures d
         WHERE d.tour_id = t.id
           AND d.depart_date >= CURRENT_DATE
           AND d.seats_left > 0
           {status_filter})
    """
    gia_hien_tai = f"COALESCE({sub_eff}, t.price_from)"

    sub_orig = f"""
        (SELECT {sql_lp}
         FROM tour_departures d
         WHERE d.tour_id = t.id
           AND d.depart_date >= CURRENT_DATE
           AND d.seats_left > 0
           {status_filter}
         ORDER BY {sql_eff} ASC, d.depart_date ASC
         LIMIT 1)
    """

    rows = execute_query(
        f"""
        SELECT {_COLS}, p.name AS province_name,
               {gia_hien_tai} AS price_from,
               {sub_orig} AS original_price
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        WHERE t.slug = %s AND t.active
        """,
        (slug,),
    )
    if not rows:
        return None
    r = rows[0]
    orig = r.get("original_price")
    curr = r.get("price_from")
    if orig and curr and curr < orig:
        r["is_sale"] = True
        r["discount_pct"] = round((orig - curr) / orig * 100)
    else:
        r["is_sale"] = False
        r["discount_pct"] = 0
        if orig is None:
            r["original_price"] = curr
    return r


def departures(tour_id: int):
    """Chỉ trả đợt còn chỗ và chưa khởi hành — khách không đặt được đợt đã qua.

    Trả về cả list_price, sale_price để tầng service tính giá hiệu lực và frontend gạch ngang.
    """
    has_list_price = _has_col("tour_departures", "list_price")
    has_status = _has_col("tour_departures", "status")

    if has_list_price:
        cols = """id, depart_date, list_price, sale_price, sale_starts_at, sale_ends_at,
                  status, min_pax, seats_total, seats_left, list_price AS price"""
        status_cond = "AND status = 'OPEN'" if has_status else ""
    else:
        cols = """id, depart_date, price, price AS list_price, NULL::bigint AS sale_price,
                  NULL::timestamptz AS sale_starts_at, NULL::timestamptz AS sale_ends_at,
                  'OPEN' AS status, 1 AS min_pax, seats_total, seats_left"""
        status_cond = ""

    return execute_query(
        f"""
        SELECT {cols}
        FROM tour_departures
        WHERE tour_id = %s AND depart_date >= CURRENT_DATE AND seats_left > 0 {status_cond}
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


def generate_booking_code(tx=None, target_date: Optional[date] = None) -> str:
    """Sinh mã đơn tra cứu chuẩn TX-YYYYMMDD-NNNN (ví dụ TX-20260905-0007).

    NNNN tăng dần theo ngày theo múi giờ Asia/Ho_Chi_Minh.
    Cơ chế an toàn đồng thời (concurrency):
    1. Khi chạy trong transaction (tx is not None), gọi `pg_advisory_xact_lock(hashtext(...))`
       theo ngày để tuần tự hóa việc cấp phát mã đơn trong phạm vi microsecond của transaction,
       ngăn chặn race condition giữa hai request đồng thời.
    2. Lấy mã lớn nhất trong ngày hiện tại theo tiền tố `TX-YYYYMMDD-` rồi +1.
    3. Đảm bảo mã luôn có ít nhất 4 chữ số (0001..9999..).
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo
    tz_vn = ZoneInfo("Asia/Ho_Chi_Minh")
    d = target_date or datetime.now(tz_vn).date()
    date_str = d.strftime("%Y%m%d")
    prefix = f"TX-{date_str}-"

    # 1. Advisory lock theo ngày nếu đang trong transaction
    if tx is not None:
        try:
            _exec("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"booking_code_{date_str}",), tx=tx)
        except Exception:
            # Fallback nếu DB không hỗ trợ hoặc lỗi quyền
            pass

    has_code = _has_col("tour_bookings", "code")
    next_num = 1

    if has_code:
        # Tìm mã đơn lớn nhất trong ngày với tiền tố prefix
        rows = _exec(
            """
            SELECT code FROM tour_bookings
            WHERE code LIKE %s
            ORDER BY code DESC
            LIMIT 1
            """,
            (f"{prefix}%",),
            tx=tx,
        )
        if rows and rows[0].get("code"):
            last_code = rows[0]["code"]
            parts = last_code.split("-")
            if len(parts) >= 3 and parts[-1].isdigit():
                next_num = int(parts[-1]) + 1
            else:
                cnt_rows = _exec(
                    "SELECT count(*) as cnt FROM tour_bookings WHERE code LIKE %s",
                    (f"{prefix}%",),
                    tx=tx,
                )
                next_num = (cnt_rows[0]["cnt"] if cnt_rows else 0) + 1
    else:
        # Schema cũ chưa có cột code: đếm số đơn tạo trong ngày
        try:
            cnt_rows = _exec(
                "SELECT count(*) as cnt FROM tour_bookings WHERE created_at::date = %s",
                (d,),
                tx=tx,
            )
            next_num = (cnt_rows[0]["cnt"] if cnt_rows else 0) + 1
        except Exception:
            next_num = 1

    return f"{prefix}{next_num:04d}"


def create_booking(data: dict, user_id=None, total_price=None, tx=None,
                   unit_list_price=None, unit_sale_price=None, code=None,
                   hold_expires_at=None):
    """Tạo đơn đặt tour ở trạng thái PENDING_PAYMENT. Nhận tx để chung transaction với giữ chỗ.

    Lưu snapshot đơn giá tại thời điểm đặt (unit_list_price, unit_sale_price)
    và thời hạn giữ chỗ hold_expires_at (mặc định 30 phút).
    """
    has_snapshot = _has_col("tour_bookings", "unit_list_price")
    has_code = _has_col("tour_bookings", "code")
    has_status = _has_col("tour_bookings", "status")

    status_val = "PENDING_PAYMENT"

    if has_snapshot and has_code:
        rows = _exec(
            """
            INSERT INTO tour_bookings
                (tour_id, departure_id, user_id, full_name, phone, email,
                 guests, note, total_price, code, unit_list_price, unit_sale_price,
                 hold_expires_at, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, code
            """,
            (data["tour_id"], data.get("departure_id"), user_id, data["full_name"],
             data["phone"], data.get("email"), data.get("guests") or 1,
             data.get("note"), total_price, code, unit_list_price, unit_sale_price,
             hold_expires_at, status_val),
            tx=tx,
        )
    elif has_status:
        rows = _exec(
            """
            INSERT INTO tour_bookings
                (tour_id, departure_id, user_id, full_name, phone, email,
                 guests, note, total_price, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (data["tour_id"], data.get("departure_id"), user_id, data["full_name"],
             data["phone"], data.get("email"), data.get("guests") or 1,
             data.get("note"), total_price, status_val),
            tx=tx,
        )
    else:
        rows = _exec(
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
            tx=tx,
        )
    return rows[0]["id"] if rows else None


def get_booking(booking_id: int, tx=None, for_update: bool = False) -> Optional[dict]:
    """Lấy thông tin chi tiết một booking kèm thông tin tour và đợt khởi hành."""
    lock_clause = "FOR UPDATE OF b" if for_update and tx is not None else ""
    rows = _exec(
        f"""
        SELECT b.*, t.name AS tour_name, t.slug AS tour_slug,
               d.depart_date, d.seats_left, d.seats_total
        FROM tour_bookings b
        JOIN tours t ON t.id = b.tour_id
        LEFT JOIN tour_departures d ON d.id = b.departure_id
        WHERE b.id = %s
        {lock_clause}
        """,
        (booking_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def update_booking_status(booking_id: int, new_status: str,
                          expected_old_status: Optional[str] = None, tx=None) -> bool:
    """Cập nhật trạng thái booking nguyên tử có điều kiện trạng thái cũ."""
    if expected_old_status:
        query = """
            UPDATE tour_bookings
            SET status = %s
            WHERE id = %s AND status = %s
            RETURNING id
        """
        params = (new_status, booking_id, expected_old_status)
    else:
        query = """
            UPDATE tour_bookings
            SET status = %s
            WHERE id = %s
            RETURNING id
        """
        params = (new_status, booking_id)

    rows = _exec(query, params, tx=tx)
    return bool(rows)


def add_booking_status_history(booking_id: int, from_status: Optional[str],
                               to_status: str, actor_id: Optional[int] = None,
                               reason: Optional[str] = None, tx=None) -> Optional[int]:
    """Ghi nhật ký chuyển trạng thái booking (BR-L2) trong cùng transaction.

    An toàn trên cả DB chưa chạy migration 002 (bỏ qua nếu bảng chưa tồn tại).
    """
    if not _has_table("booking_status_history"):
        return None

    rows = _exec(
        """
        INSERT INTO booking_status_history
            (booking_id, from_status, to_status, actor_id, reason)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (booking_id, from_status, to_status, actor_id, reason),
        tx=tx,
    )
    return rows[0]["id"] if rows else None


def get_booking_status_history(booking_id: int, tx=None) -> list:
    """Lấy danh sách nhật ký chuyển trạng thái của một booking."""
    if not _has_table("booking_status_history"):
        return []

    return _exec(
        """
        SELECT h.*, u.full_name AS actor_name, u.email AS actor_email
        FROM booking_status_history h
        LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.booking_id = %s
        ORDER BY h.created_at ASC, h.id ASC
        """,
        (booking_id,),
        tx=tx,
    ) or []


def release_booking_seats(booking_id: int, tx=None) -> dict:
    """Nhả chỗ của đơn booking về departure nguyên tử và chống trả chỗ 2 lần (BR-L3, E11).

    Logic cốt lõi:
    - Nếu có cột `seats_released`: Thực hiện UPDATE có điều kiện
      `seats_released = TRUE WHERE id = %s AND (seats_released IS FALSE OR seats_released IS NULL)`.
      Chỉ khi câu UPDATE này cập nhật được (row trả về), ta mới tăng lại `seats_left`.
      Nếu row không trả về, chứng tỏ cờ đã là TRUE (đã trả rồi) -> không trả thêm!
    - Bảo đảm `seats_left <= seats_total` qua hàm LEAST().
    """
    has_seats_released = _has_col("tour_bookings", "seats_released")

    if has_seats_released:
        # Bước 1: Đánh dấu cờ nguyên tử. Chỉ ai đổi được từ FALSE/NULL -> TRUE mới được nhả chỗ.
        updated_rows = _exec(
            """
            UPDATE tour_bookings
            SET seats_released = TRUE
            WHERE id = %s AND (seats_released IS FALSE OR seats_released IS NULL)
            RETURNING id, departure_id, guests
            """,
            (booking_id,),
            tx=tx,
        )
        if not updated_rows:
            # Đã từng nhả chỗ rồi hoặc đơn không tồn tại
            return {"released": False, "reason": "already_released_or_not_found"}

        b_row = updated_rows[0]
        dep_id = b_row.get("departure_id")
        guests = int(b_row.get("guests") or 0)

        if dep_id and guests > 0:
            _exec(
                """
                UPDATE tour_departures
                SET seats_left = LEAST(seats_total, seats_left + %s)
                WHERE id = %s
                """,
                (guests, dep_id),
                tx=tx,
            )
            return {"released": True, "departure_id": dep_id, "seats": guests}

        return {"released": True, "departure_id": dep_id, "seats": 0}
    else:
        # Fallback cho DB chưa chạy migration: lấy thông tin booking rồi trả chỗ
        booking = get_booking(booking_id, tx=tx)
        if not booking or not booking.get("departure_id"):
            return {"released": False, "reason": "not_found"}

        dep_id = booking["departure_id"]
        guests = int(booking.get("guests") or 1)
        _exec(
            """
            UPDATE tour_departures
            SET seats_left = LEAST(seats_total, seats_left + %s)
            WHERE id = %s
            """,
            (guests, dep_id),
            tx=tx,
        )
        return {"released": True, "departure_id": dep_id, "seats": guests}


def find_expired_bookings(thoi_diem=None, tx=None) -> list:
    """Tìm tất cả đơn PENDING_PAYMENT đã quá hạn giữ chỗ (E2).

    Mặc định thoi_diem = CURRENT_TIMESTAMP (so sánh TIMESTAMPTZ chuẩn).
    Nếu DB chưa có cột hold_expires_at, fallback so sánh created_at < thoi_diem - 30 phút.
    """
    has_hold = _has_col("tour_bookings", "hold_expires_at")

    if has_hold:
        if thoi_diem:
            query = """
                SELECT b.id, b.code, b.tour_id, b.departure_id, b.guests, b.status, b.hold_expires_at
                FROM tour_bookings b
                WHERE b.status = 'PENDING_PAYMENT'
                  AND b.hold_expires_at IS NOT NULL
                  AND b.hold_expires_at < %s
                ORDER BY b.hold_expires_at ASC
            """
            params = (thoi_diem,)
        else:
            query = """
                SELECT b.id, b.code, b.tour_id, b.departure_id, b.guests, b.status, b.hold_expires_at
                FROM tour_bookings b
                WHERE b.status = 'PENDING_PAYMENT'
                  AND b.hold_expires_at IS NOT NULL
                  AND b.hold_expires_at < CURRENT_TIMESTAMP
                ORDER BY b.hold_expires_at ASC
            """
            params = ()
    else:
        # Fallback: created_at < now - 30 minutes
        if thoi_diem:
            query = """
                SELECT b.id, b.id::text AS code, b.tour_id, b.departure_id, b.guests, b.status,
                       (b.created_at + INTERVAL '30 minute') AS hold_expires_at
                FROM tour_bookings b
                WHERE b.status = 'PENDING_PAYMENT'
                  AND b.created_at < (%s - INTERVAL '30 minute')
                ORDER BY b.created_at ASC
            """
            params = (thoi_diem,)
        else:
            query = """
                SELECT b.id, b.id::text AS code, b.tour_id, b.departure_id, b.guests, b.status,
                       (b.created_at + INTERVAL '30 minute') AS hold_expires_at
                FROM tour_bookings b
                WHERE b.status = 'PENDING_PAYMENT'
                  AND b.created_at < (CURRENT_TIMESTAMP - INTERVAL '30 minute')
                ORDER BY b.created_at ASC
            """
            params = ()

    return _exec(query, params if params else None, tx=tx) or []


def find_pending_bookings_past_depart_date(ngay=None, tx=None) -> list:
    """Tìm tất cả đơn PENDING_PAYMENT có đợt khởi hành depart_date <= ngày so sánh (E23).

    Mặc định ngày hôm nay theo giờ Việt Nam Asia/Ho_Chi_Minh.
    """
    if ngay:
        query = """
            SELECT b.id, b.code, b.tour_id, b.departure_id, b.guests, b.status, d.depart_date
            FROM tour_bookings b
            JOIN tour_departures d ON d.id = b.departure_id
            WHERE b.status = 'PENDING_PAYMENT'
              AND d.depart_date <= %s
            ORDER BY d.depart_date ASC, b.id ASC
        """
        params = (ngay,)
    else:
        # Lấy ngày hiện tại theo Asia/Ho_Chi_Minh trong SQL
        query = """
            SELECT b.id, b.code, b.tour_id, b.departure_id, b.guests, b.status, d.depart_date
            FROM tour_bookings b
            JOIN tour_departures d ON d.id = b.departure_id
            WHERE b.status = 'PENDING_PAYMENT'
              AND d.depart_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            ORDER BY d.depart_date ASC, b.id ASC
        """
        params = ()

    return _exec(query, params if params else None, tx=tx) or []


def list_user_bookings(user_id: int, limit: int = 100) -> list:
    """Lấy danh sách đơn đặt tour của khách hàng (UC-B02 / Phase 2.7 + Phase 3.4).

    Chỉ trả về các đơn của chính user_id đó, kèm tên tour, ảnh đại diện,
    ngày khởi hành, snapshot giá và trạng thái thanh toán payment_status mới nhất.
    Đảm bảo luôn có trường code (fallback nếu DB chưa migrate).
    """
    has_code = _has_col("tour_bookings", "code")
    code_expr = "b.code" if has_code else "COALESCE(NULL, 'TB-' || b.id::text) AS code"

    has_payments = _has_table("payments")
    payment_expr = (
        "(SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.id DESC LIMIT 1) AS payment_status"
        if has_payments
        else "NULL::varchar AS payment_status"
    )

    return execute_query(
        f"""
        SELECT b.*, {code_expr}, {payment_expr}, t.name AS tour_name, t.slug AS tour_slug,
               t.cover_url AS tour_cover_url, d.depart_date
        FROM tour_bookings b
        JOIN tours t ON t.id = b.tour_id
        LEFT JOIN tour_departures d ON d.id = b.departure_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT %s
        """,
        (user_id, limit),
    ) or []


def giu_cho(departure_id: int, guests: int, tx=None):
    """Trừ chỗ, chỉ khi còn đủ. Nhận tx để nằm chung transaction với tạo đơn.

    Điều kiện `seats_left >= %s` nằm trong chính câu UPDATE để hai người đặt
    cùng lúc không cùng thấy "còn 2 chỗ" rồi cùng đặt 2 — kiểm tra rồi mới trừ
    ở tầng ứng dụng là có khe hở. Trả về cả thông tin giá để snapshot vào đơn.
    """
    has_list_price = _has_col("tour_departures", "list_price")
    has_status = _has_col("tour_departures", "status")

    status_check = "AND status = 'OPEN'" if has_status else ""
    if has_list_price:
        returning = "seats_left, list_price, sale_price, sale_starts_at, sale_ends_at, list_price AS price"
    else:
        returning = """seats_left, price, price AS list_price, NULL::bigint AS sale_price,
                       NULL::timestamptz AS sale_starts_at, NULL::timestamptz AS sale_ends_at"""

    rows = _exec(
        f"""
        UPDATE tour_departures SET seats_left = seats_left - %s
        WHERE id = %s AND seats_left >= %s {status_check}
        RETURNING {returning}
        """,
        (guests, departure_id, guests),
        tx=tx,
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
    has_policy = _has_col("tours", "cancellation_policy")
    has_status = _has_col("tours", "status")

    if has_policy and has_status:
        rows = execute_query(
            """
            INSERT INTO tours (slug, name, summary, description, province_id,
                               duration_days, price_from, cover_url, highlights,
                               itinerary, included, excluded, cancellation_policy, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name, summary = EXCLUDED.summary,
                description = EXCLUDED.description, province_id = EXCLUDED.province_id,
                duration_days = EXCLUDED.duration_days, price_from = EXCLUDED.price_from,
                cover_url = EXCLUDED.cover_url, highlights = EXCLUDED.highlights,
                itinerary = EXCLUDED.itinerary, included = EXCLUDED.included,
                excluded = EXCLUDED.excluded,
                cancellation_policy = EXCLUDED.cancellation_policy,
                status = EXCLUDED.status
            RETURNING id
            """,
            (data["slug"], data["name"], data.get("summary"), data.get("description"),
             data.get("province_id"), data["duration_days"], data.get("price_from"),
             data.get("cover_url"),
             json.dumps(data.get("highlights") or [], ensure_ascii=False),
             json.dumps(data.get("itinerary") or [], ensure_ascii=False),
             data.get("included"), data.get("excluded"),
             json.dumps(data.get("cancellation_policy") or [], ensure_ascii=False),
             data.get("status") or "ACTIVE"),
        )
    else:
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


def add_departure(tour_id: int, depart_date, list_price=None, seats: int = 20,
                  sale_price=None, sale_starts_at=None, sale_ends_at=None,
                  status: str = "OPEN", min_pax: int = 1, price=None):
    """Mở một đợt khởi hành mới hoặc cập nhật đợt đã có.

    Nhận list_price thay vì price; vẫn chấp nhận price kwargs để tương thích ngược.
    """
    gia_goc = list_price if list_price is not None else price
    has_sale = _has_col("tour_departures", "sale_price")
    has_list_price = _has_col("tour_departures", "list_price")

    if has_list_price and has_sale:
        execute_query(
            """
            INSERT INTO tour_departures (
                tour_id, depart_date, list_price, seats_total, seats_left,
                sale_price, sale_starts_at, sale_ends_at, status, min_pax
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tour_id, depart_date) DO UPDATE
                SET list_price = EXCLUDED.list_price,
                    sale_price = EXCLUDED.sale_price,
                    sale_starts_at = EXCLUDED.sale_starts_at,
                    sale_ends_at = EXCLUDED.sale_ends_at,
                    status = EXCLUDED.status,
                    min_pax = EXCLUDED.min_pax
            """,
            (tour_id, depart_date, gia_goc, seats, seats,
             sale_price, sale_starts_at, sale_ends_at, status, min_pax),
        )
    else:
        execute_query(
            """
            INSERT INTO tour_departures (tour_id, depart_date, price, seats_total, seats_left)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (tour_id, depart_date) DO UPDATE
                SET price = EXCLUDED.price
            """,
            (tour_id, depart_date, gia_goc, seats, seats),
        )


# ═══════════════════════════════════════════════════════════════════════════
# Phase 3-lite: Thanh toán thủ công (Payments Repository)
# ═══════════════════════════════════════════════════════════════════════════

def generate_payment_txn_ref(tx=None, target_date: Optional[date] = None) -> str:
    """Sinh mã giao dịch thanh toán chuẩn PM-YYYYMMDD-NNNN (ví dụ PM-20260905-0001).

    Cơ chế an toàn đồng thời (concurrency):
    1. Khi chạy trong transaction (tx is not None), gọi `pg_advisory_xact_lock(hashtext(...))`
       theo ngày để tuần tự hóa việc cấp phát mã giao dịch, chống race condition.
    2. Lấy mã lớn nhất trong ngày hiện tại theo tiền tố `PM-YYYYMMDD-` rồi +1.
    3. Luôn đảm bảo NNNN có ít nhất 4 chữ số (0001..9999..).
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo
    tz_vn = ZoneInfo("Asia/Ho_Chi_Minh")
    d = target_date or datetime.now(tz_vn).date()
    date_str = d.strftime("%Y%m%d")
    prefix = f"PM-{date_str}-"

    if tx is not None:
        try:
            _exec("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"payment_txn_ref_{date_str}",), tx=tx)
        except Exception:
            pass

    has_payments = _has_table("payments")
    next_num = 1

    if has_payments:
        rows = _exec(
            """
            SELECT txn_ref FROM payments
            WHERE txn_ref LIKE %s
            ORDER BY txn_ref DESC
            LIMIT 1
            """,
            (f"{prefix}%",),
            tx=tx,
        )
        if rows and rows[0].get("txn_ref"):
            last_ref = rows[0]["txn_ref"]
            parts = last_ref.split("-")
            if len(parts) >= 3 and parts[-1].isdigit():
                next_num = int(parts[-1]) + 1
            else:
                cnt_rows = _exec(
                    "SELECT count(*) as cnt FROM payments WHERE txn_ref LIKE %s",
                    (f"{prefix}%",),
                    tx=tx,
                )
                next_num = (cnt_rows[0]["cnt"] if cnt_rows else 0) + 1
    else:
        # Fallback khi chưa có bảng payments (dùng timestamp hoặc số ngẫu nhiên)
        import time
        next_num = int(time.time() % 10000)

    return f"{prefix}{next_num:04d}"


def create_payment(data: dict, tx=None) -> Optional[int]:
    """Tạo bản ghi thanh toán mới trong CSDL."""
    if not _has_table("payments"):
        return None

    rows = _exec(
        """
        INSERT INTO payments (
            booking_id, method, amount, status, txn_ref, note, confirmed_by, confirmed_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            data["booking_id"],
            data.get("method", "CHUYEN_KHOAN"),
            data["amount"],
            data.get("status", "PENDING"),
            data["txn_ref"],
            data.get("note"),
            data.get("confirmed_by"),
            data.get("confirmed_at"),
        ),
        tx=tx,
    )
    return rows[0]["id"] if rows else None


def get_payment(payment_id: int, tx=None, for_update: bool = False) -> Optional[dict]:
    """Lấy chi tiết giao dịch thanh toán kèm thông tin booking và tour."""
    if not _has_table("payments"):
        return None

    lock_clause = "FOR UPDATE OF p" if for_update and tx is not None else ""
    rows = _exec(
        f"""
        SELECT p.*,
               b.code AS booking_code,
               b.total_price AS booking_total_price,
               b.status AS booking_status,
               b.hold_expires_at,
               b.seats_released,
               b.tour_id,
               t.name AS tour_name,
               u.full_name AS confirmed_by_name,
               u.email AS confirmed_by_email
        FROM payments p
        JOIN tour_bookings b ON b.id = p.booking_id
        JOIN tours t ON t.id = b.tour_id
        LEFT JOIN users u ON u.id = p.confirmed_by
        WHERE p.id = %s
        {lock_clause}
        """,
        (payment_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def get_payment_by_txn_ref(txn_ref: str, tx=None) -> Optional[dict]:
    """Lấy chi tiết giao dịch thanh toán theo mã giao dịch txn_ref."""
    if not _has_table("payments"):
        return None

    rows = _exec(
        """
        SELECT p.*,
               b.code AS booking_code,
               b.total_price AS booking_total_price,
               b.status AS booking_status,
               b.hold_expires_at,
               t.name AS tour_name
        FROM payments p
        JOIN tour_bookings b ON b.id = p.booking_id
        JOIN tours t ON t.id = b.tour_id
        WHERE p.txn_ref = %s
        """,
        (txn_ref,),
        tx=tx,
    )
    return rows[0] if rows else None


def update_payment_status(
    payment_id: int,
    status: str,
    confirmed_by: Optional[int] = None,
    confirmed_at: Optional[object] = None,
    note: Optional[str] = None,
    expected_status: Optional[str] = None,
    tx=None,
) -> bool:
    """Cập nhật trạng thái và thông tin xác nhận thanh toán nguyên tử."""
    if not _has_table("payments"):
        return False

    clauses = ["status = %s"]
    params = [status]

    if confirmed_by is not None:
        clauses.append("confirmed_by = %s")
        params.append(confirmed_by)
    if confirmed_at is not None:
        clauses.append("confirmed_at = %s")
        params.append(confirmed_at)
    if note is not None:
        clauses.append("note = %s")
        params.append(note)

    where_clauses = ["id = %s"]
    params.append(payment_id)

    if expected_status is not None:
        where_clauses.append("status = %s")
        params.append(expected_status)

    sql = f"""
        UPDATE payments
        SET {", ".join(clauses)}
        WHERE {" AND ".join(where_clauses)}
        RETURNING id
    """
    rows = _exec(sql, tuple(params), tx=tx)
    return bool(rows)


def list_payments(status: Optional[str] = None, limit: int = 100, offset: int = 0) -> list:
    """Danh sách giao dịch thanh toán cho admin quản lý đối soát."""
    if not _has_table("payments"):
        return []

    dieu_kien = []
    params = []

    if status:
        dieu_kien.append("p.status = %s")
        params.append(status)

    where_sql = f"WHERE {' AND '.join(dieu_kien)}" if dieu_kien else ""
    params.extend([limit, offset])

    return execute_query(
        f"""
        SELECT p.id, p.booking_id, b.code AS booking_code, t.name AS tour_name,
               p.method, p.amount, p.status, p.txn_ref, p.note,
               p.confirmed_by, u.full_name AS confirmed_by_name,
               p.confirmed_at, p.created_at
        FROM payments p
        JOIN tour_bookings b ON b.id = p.booking_id
        JOIN tours t ON t.id = b.tour_id
        LEFT JOIN users u ON u.id = p.confirmed_by
        {where_sql}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params),
    ) or []


def get_booking_payments(booking_id: int, tx=None) -> list:
    """Lấy toàn bộ các giao dịch thanh toán liên quan đến một booking."""
    if not _has_table("payments"):
        return []

    return _exec(
        """
        SELECT p.*, u.full_name AS confirmed_by_name
        FROM payments p
        LEFT JOIN users u ON u.id = p.confirmed_by
        WHERE p.booking_id = %s
        ORDER BY p.created_at DESC, p.id DESC
        """,
        (booking_id,),
        tx=tx,
    ) or []


def count_successful_payments(booking_id: int, tx=None) -> int:
    """Đếm số giao dịch SUCCESS của một booking (kiểm tra ràng buộc BR-P1)."""
    if not _has_table("payments"):
        return 0

    rows = _exec(
        """
        SELECT count(*) as cnt
        FROM payments
        WHERE booking_id = %s AND status = 'SUCCESS'
        """,
        (booking_id,),
        tx=tx,
    )
    return rows[0]["cnt"] if rows else 0
