"""Truy vấn tour trọn gói. Chỉ SQL."""

import json
import re
from datetime import date
from typing import Optional

from app.core.database import Transaction, execute_query

_COLS = """t.id, t.slug, t.name, t.summary, t.description, t.province_id,
           t.duration_days, t.cover_url, t.images, t.highlights,
           t.itinerary, t.included, t.excluded, t.created_at"""

_COLS_CACHE = {}
_TABLES_CACHE = {}


def _cols_sql() -> str:
    """Trả về danh sách cột của tours khi query.

    Nếu CSDL chưa chạy migration 005 (chưa có cột images), thay thế 't.images'
    bằng giá trị rỗng '[]'::jsonb AS images để câu query chạy an toàn, không báo lỗi.
    """
    if _has_col("tours", "images"):
        return _COLS
    return _COLS.replace("t.images", "'[]'::jsonb AS images")


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


def list_tour_provinces():
    """Danh sách các tỉnh/thành có tour đang hoạt động, phục vụ bộ lọc."""
    return execute_query(
        """
        SELECT DISTINCT t.province_id AS id, p.name
        FROM tours t
        JOIN province_stats p ON p.id = t.province_id
        WHERE t.active AND t.province_id IS NOT NULL
        ORDER BY p.name ASC
        """
    ) or []


def list_tours(
    province_id=None,
    depart_from=None,
    depart_to=None,
    price_min=None,
    price_max=None,
    max_price=None,
    max_days=None,
    min_days=None,
    guests=None,
    sort=None,
    limit=24,
    offset=0,
):
    """Danh sách tour kèm bộ lọc và giá bán hiệu lực thấp nhất từ các đợt còn mở.

    Khách lọc 'dưới 5 triệu' phải thấy tour giá gốc 6 triệu đang khuyến mãi còn 4,5 triệu.
    Đồng thời trả về original_price để giao diện hiển thị gạch ngang mức giá gốc.
    """
    if price_max is None and max_price is not None:
        price_max = max_price

    dieu_kien = ["t.active"]
    params = {}
    if province_id:
        dieu_kien.append("t.province_id = %(province_id)s")
        params["province_id"] = province_id
    if max_days:
        dieu_kien.append("t.duration_days <= %(max_days)s")
        params["max_days"] = max_days
    if min_days:
        dieu_kien.append("t.duration_days >= %(min_days)s")
        params["min_days"] = min_days

    sql_eff = sql_gia_ban_hieu_luc("d")
    has_list_price = _has_col("tour_departures", "list_price")
    has_status = _has_col("tour_departures", "status")
    sql_lp = "d.list_price" if has_list_price else "d.price"

    dep_where = [
        "d.tour_id = t.id",
        "d.depart_date >= CURRENT_DATE",
    ]
    if has_status:
        dep_where.append("d.status = 'OPEN'")

    has_dep_filter = False
    if guests and guests > 0:
        dep_where.append("d.seats_left >= %(guests)s")
        params["guests"] = guests
        has_dep_filter = True
    else:
        dep_where.append("d.seats_left > 0")

    if depart_from:
        dep_where.append("d.depart_date >= %(depart_from)s")
        params["depart_from"] = depart_from
        has_dep_filter = True

    if depart_to:
        dep_where.append("d.depart_date <= %(depart_to)s")
        params["depart_to"] = depart_to
        has_dep_filter = True

    dep_where_sql = " AND ".join(dep_where)

    # Nếu khách lọc theo ngày khởi hành hoặc số khách: chỉ hiện tour có ít nhất 1 đợt thoả mãn
    if has_dep_filter:
        dieu_kien.append(f"EXISTS (SELECT 1 FROM tour_departures d WHERE {dep_where_sql})")

    # Subquery tính giá bán hiệu lực thấp nhất từ các đợt khởi hành còn mở thoả mãn bộ lọc
    sub_eff = f"""
        (SELECT min({sql_eff})
         FROM tour_departures d
         WHERE {dep_where_sql})
    """
    gia_hien_tai = f"COALESCE({sub_eff}, t.price_from)"

    # Subquery lấy giá gốc của đợt rẻ nhất đó để hiển thị gạch ngang
    sub_orig = f"""
        (SELECT {sql_lp}
         FROM tour_departures d
         WHERE {dep_where_sql}
         ORDER BY {sql_eff} ASC, d.depart_date ASC
         LIMIT 1)
    """

    sub_ngay = f"""
        (SELECT min(d.depart_date)
         FROM tour_departures d
         WHERE {dep_where_sql})
    """

    if price_min is not None:
        dieu_kien.append(f"{gia_hien_tai} >= %(price_min)s")
        params["price_min"] = price_min

    if price_max is not None:
        dieu_kien.append(f"{gia_hien_tai} <= %(price_max)s")
        params["price_max"] = price_max

    if sort == "price_asc":
        order_by_sql = f"{gia_hien_tai} ASC NULLS LAST, t.id ASC"
    elif sort == "price_desc":
        order_by_sql = f"{gia_hien_tai} DESC NULLS LAST, t.id ASC"
    elif sort == "date_asc":
        order_by_sql = f"ngay_gan_nhat ASC NULLS LAST, {gia_hien_tai} ASC NULLS LAST, t.id ASC"
    else:
        order_by_sql = f"{gia_hien_tai} NULLS LAST, t.id ASC"

    params["limit"] = limit
    params["offset"] = offset

    sql = f"""
        SELECT {_cols_sql()}, p.name AS province_name,
               {gia_hien_tai} AS price_from,
               {sub_orig} AS original_price,
               {sub_ngay} AS ngay_gan_nhat,
               count(*) OVER () AS tong
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        WHERE {" AND ".join(dieu_kien)}
        ORDER BY {order_by_sql}
        LIMIT %(limit)s OFFSET %(offset)s
    """
    rows = execute_query(sql, params) or []

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
        SELECT {_cols_sql()}, p.name AS province_name,
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


def get_photos_for_places(place_ids: list[int]) -> dict[int, list[str]]:
    """Lấy bản đồ ảnh place_id -> list[url] từ place_photos (place_type='poi')."""
    if not place_ids:
        return {}
    rows = execute_query(
        """
        SELECT place_id, url
        FROM place_photos
        WHERE place_type = 'poi' AND place_id = ANY(%s)
        ORDER BY id ASC
        """,
        (list(set(place_ids)),),
    ) or []
    photos_by_pid = {}
    for r in rows:
        photos_by_pid.setdefault(r["place_id"], []).append(r["url"])
    return photos_by_pid


def get_itinerary_photos(itinerary) -> list[str]:
    """Tổng hợp mảng URL ảnh từ các điểm đến trong itinerary theo thứ tự ngày 1 -> ngày N, bỏ trùng URL.

    - Đọc place_ids theo đúng thứ tự xuất hiện trong từng ngày.
    - Truy vấn place_photos ('poi') cho các place_id đó.
    - Giữ đúng thứ tự xuất hiện, loại bỏ trùng lặp URL.
    """
    if not itinerary:
        return []
    pids = []
    for day in (itinerary or []):
        for pid in (day.get("place_ids") or []):
            if pid not in pids:
                pids.append(pid)
    if not pids:
        return []

    photos_by_pid = get_photos_for_places(pids)
    images = []
    seen = set()
    for pid in pids:
        for url in photos_by_pid.get(pid, []):
            if url and url not in seen:
                seen.add(url)
                images.append(url)
    return images


def _chuan_hoa_mang_text(value):
    """Chuẩn hoá included/excluded về list[str] trước khi ghi JSONB.

    Từ giờ dữ liệu mới là mảng; giá trị string chỉ còn từ caller cũ hoặc dữ liệu
    TEXT chưa migrate. Tách theo dòng/dấu phẩy/chấm phẩy cho giống migration 004.
    """
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                value = parsed
        except Exception:
            value = re.split(r"[,;\n]+", value)
    if not isinstance(value, list):
        value = [value]
    return [str(x).strip() for x in value if str(x).strip()]


def _chuan_hoa_mang_anh(images, cover_url=None) -> list[str]:
    """Chuẩn hoá dữ liệu ảnh tour về list[str].

    - Hỗ trợ dữ liệu truyền vào là list, chuỗi JSON hoặc chuỗi đơn.
    - Nếu images rỗng nhưng có cover_url, tự động dùng [cover_url].
    - Loại bỏ các phần tử rỗng hoặc khoảng trắng.
    """
    if images is None:
        images = []
    if isinstance(images, str):
        try:
            parsed = json.loads(images)
            if isinstance(parsed, list):
                images = parsed
            else:
                images = [parsed]
        except Exception:
            images = [images] if images.strip() else []
    if not isinstance(images, list):
        images = [images]
    res = [str(x).strip() for x in images if str(x).strip()]
    if not res and cover_url:
        res = [str(cover_url).strip()]
    return res


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

    status_val = data.get("status") or "PENDING_PAYMENT"


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
    if has_payments:
        payment_expr = (
            "(SELECT p.id FROM payments p WHERE p.booking_id = b.id ORDER BY p.id DESC LIMIT 1) AS payment_id, "
            "(SELECT p.txn_ref FROM payments p WHERE p.booking_id = b.id ORDER BY p.id DESC LIMIT 1) AS payment_txn_ref, "
            "(SELECT p.amount FROM payments p WHERE p.booking_id = b.id ORDER BY p.id DESC LIMIT 1) AS payment_amount, "
            "(SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.id DESC LIMIT 1) AS payment_status"
        )
    else:
        payment_expr = (
            "NULL::integer AS payment_id, "
            "NULL::varchar AS payment_txn_ref, "
            "NULL::numeric AS payment_amount, "
            "NULL::varchar AS payment_status"
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


def create_tour(data: dict, upsert: bool = True):
    has_policy = _has_col("tours", "cancellation_policy")
    has_status = _has_col("tours", "status")
    has_images = _has_col("tours", "images")
    has_operator = _has_col("tours", "operator_id")
    has_active = _has_col("tours", "active")

    cover_url = data.get("cover_url")
    images_list = _chuan_hoa_mang_anh(data.get("images"), cover_url)

    # Giả định: Nếu cover_url trống nhưng images có phần tử đầu tiên,
    # tự động gán cover_url = images[0] để tương thích ngược.
    if not cover_url and images_list:
        cover_url = images_list[0]

    images_json = json.dumps(images_list, ensure_ascii=False)
    status = data.get("status") or "ACTIVE"
    active = (status == "ACTIVE")
    operator_id = data.get("operator_id")

    cols = ["slug", "name", "summary", "description", "province_id", "duration_days", "price_from", "cover_url"]
    vals = [data["slug"], data["name"], data.get("summary"), data.get("description"),
            data.get("province_id"), data["duration_days"], data.get("price_from"), cover_url]

    if has_operator:
        cols.append("operator_id")
        vals.append(operator_id)

    if has_images:
        cols.append("images")
        vals.append(images_json)

    cols.append("highlights")
    vals.append(json.dumps(data.get("highlights") or [], ensure_ascii=False))

    cols.append("itinerary")
    vals.append(json.dumps(data.get("itinerary") or [], ensure_ascii=False))

    cols.append("included")
    vals.append(json.dumps(_chuan_hoa_mang_text(data.get("included")), ensure_ascii=False))

    cols.append("excluded")
    vals.append(json.dumps(_chuan_hoa_mang_text(data.get("excluded")), ensure_ascii=False))

    if has_policy:
        cols.append("cancellation_policy")
        vals.append(json.dumps(data.get("cancellation_policy") or [], ensure_ascii=False))

    if has_status:
        cols.append("status")
        vals.append(status)
        if has_active:
            cols.append("active")
            vals.append(active)

    cols_str = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(vals))
    updates = []
    for c in cols:
        if c == "slug":
            continue
        if c == "operator_id":
            updates.append("operator_id = COALESCE(EXCLUDED.operator_id, tours.operator_id)")
        else:
            updates.append(f"{c} = EXCLUDED.{c}")
    updates_str = ", ".join(updates)

    if upsert:
        sql = f"""
            INSERT INTO tours ({cols_str})
            VALUES ({placeholders})
            ON CONFLICT (slug) DO UPDATE SET
                {updates_str}
            RETURNING id
        """
    else:
        # Tạo tour operator KHÔNG được upsert đè tour khác (kể cả DRAFT/INACTIVE):
        # trường hợp trùng slug phải trả về None để tầng service báo lỗi BR-T2.
        sql = f"""
            INSERT INTO tours ({cols_str})
            VALUES ({placeholders})
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
        """
    rows = execute_query(sql, tuple(vals))
    return rows[0]["id"] if rows else None


def get_tour_by_slug(slug: str) -> Optional[dict]:
    """Tra cứu tour theo slug KHÔNG phụ thuộc active/status.

    Khác `get_tour` công khai (chỉ thấy tour active): hàm này dùng để kiểm tra
    BR-T2 cho mọi tour kể cả DRAFT hay INACTIVE, tránh upsert đè tour khác.
    """
    rows = execute_query(
        "SELECT id, slug, operator_id, status FROM tours WHERE slug = %s LIMIT 1",
        (slug,),
    )
    return rows[0] if rows else None


def get_tour_by_id(tour_id: int) -> Optional[dict]:
    """Lấy chi tiết tour theo id mà không ràng buộc status/active, phục vụ quản lý tour của operator/admin."""
    has_operator = _has_col("tours", "operator_id")
    has_status = _has_col("tours", "status")
    has_policy = _has_col("tours", "cancellation_policy")
    has_active = _has_col("tours", "active")
    has_price_from = _has_col("tours", "price_from")

    extra_cols = []
    if has_operator:
        extra_cols.append("t.operator_id, o.company_name AS operator_name")
    if has_status:
        extra_cols.append("t.status")
    if has_policy:
        extra_cols.append("t.cancellation_policy")
    if has_active:
        extra_cols.append("t.active")
    if has_price_from:
        extra_cols.append("t.price_from")

    extra_sql = (", " + ", ".join(extra_cols)) if extra_cols else ""
    join_op = "LEFT JOIN operators o ON o.id = t.operator_id" if has_operator else ""

    sql = f"""
        SELECT {_cols_sql()}{extra_sql}, p.name AS province_name
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        {join_op}
        WHERE t.id = %s
        LIMIT 1
    """
    rows = execute_query(sql, (tour_id,))
    if not rows:
        return None
    r = rows[0]
    for k in ("images", "highlights", "itinerary", "included", "excluded", "cancellation_policy"):
        if k in r and isinstance(r[k], str):
            try:
                r[k] = json.loads(r[k])
            except Exception:
                pass
    return r


def update_tour(tour_id: int, data: dict) -> bool:
    """Cập nhật dữ liệu tour linh hoạt theo các trường có trong data."""
    has_policy = _has_col("tours", "cancellation_policy")
    has_status = _has_col("tours", "status")
    has_images = _has_col("tours", "images")
    has_active = _has_col("tours", "active")
    has_operator = _has_col("tours", "operator_id")

    set_clauses = []
    params = []

    if "name" in data and data["name"] is not None:
        set_clauses.append("name = %s")
        params.append(data["name"])

    if "summary" in data:
        set_clauses.append("summary = %s")
        params.append(data["summary"])

    if "description" in data:
        set_clauses.append("description = %s")
        params.append(data["description"])

    if "province_id" in data:
        set_clauses.append("province_id = %s")
        params.append(data["province_id"])

    if "duration_days" in data and data["duration_days"] is not None:
        set_clauses.append("duration_days = %s")
        params.append(data["duration_days"])

    if "price_from" in data:
        set_clauses.append("price_from = %s")
        params.append(data["price_from"])

    if "cover_url" in data:
        set_clauses.append("cover_url = %s")
        params.append(data["cover_url"])

    if "highlights" in data and data["highlights"] is not None:
        set_clauses.append("highlights = %s")
        params.append(json.dumps(data["highlights"], ensure_ascii=False))

    if "itinerary" in data and data["itinerary"] is not None:
        set_clauses.append("itinerary = %s")
        params.append(json.dumps(data["itinerary"], ensure_ascii=False))

    if "included" in data and data["included"] is not None:
        set_clauses.append("included = %s")
        params.append(json.dumps(_chuan_hoa_mang_text(data["included"]), ensure_ascii=False))

    if "excluded" in data and data["excluded"] is not None:
        set_clauses.append("excluded = %s")
        params.append(json.dumps(_chuan_hoa_mang_text(data["excluded"]), ensure_ascii=False))

    if "slug" in data and data["slug"]:
        set_clauses.append("slug = %s")
        params.append(data["slug"])

    if has_operator and "operator_id" in data:
        set_clauses.append("operator_id = %s")
        params.append(data["operator_id"])

    if has_images and "images" in data and data["images"] is not None:
        images_list = _chuan_hoa_mang_anh(data["images"], data.get("cover_url"))
        set_clauses.append("images = %s")
        params.append(json.dumps(images_list, ensure_ascii=False))

    if has_policy and "cancellation_policy" in data and data["cancellation_policy"] is not None:
        set_clauses.append("cancellation_policy = %s")
        params.append(json.dumps(data["cancellation_policy"], ensure_ascii=False))

    if has_status and "status" in data and data["status"]:
        st = data["status"]
        set_clauses.append("status = %s")
        params.append(st)
        if has_active:
            set_clauses.append("active = %s")
            params.append(st == "ACTIVE")

    if not set_clauses:
        return True

    params.append(tour_id)
    sql = f"UPDATE tours SET {', '.join(set_clauses)} WHERE id = %s"
    execute_query(sql, tuple(params))
    return True



def tour_has_bookings(tour_id: int) -> bool:
    """Kiểm tra xem tour đã từng có bất kỳ booking nào chưa (để quyết định xoá mềm hay cứng theo BR-T5)."""
    rows = execute_query(
        "SELECT 1 FROM tour_bookings WHERE tour_id = %s LIMIT 1",
        (tour_id,),
    )
    return bool(rows)


def tour_has_confirmed_bookings(tour_id: int) -> bool:
    """Kiểm tra xem tour đã từng có booking được CONFIRMED hoặc COMPLETED chưa (theo BR-T3)."""
    rows = execute_query(
        "SELECT 1 FROM tour_bookings WHERE tour_id = %s AND status IN ('CONFIRMED', 'COMPLETED') LIMIT 1",
        (tour_id,),
    )
    if rows:
        return True
    if _has_table("booking_status_history"):
        rows = execute_query(
            """
            SELECT 1 FROM booking_status_history h
            JOIN tour_bookings b ON h.booking_id = b.id
            WHERE b.tour_id = %s AND h.to_status = 'CONFIRMED'
            LIMIT 1
            """,
            (tour_id,),
        )
        if rows:
            return True
    return False


def delete_tour_hard(tour_id: int):
    """Xoá cứng tour và các đợt khởi hành của nó khi chưa từng có booking."""
    execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (tour_id,))
    execute_query("DELETE FROM tours WHERE id = %s", (tour_id,))


def delete_tour_soft(tour_id: int):
    """Xoá mềm tour (chuyển status=INACTIVE, active=FALSE) khi đã từng có booking (BR-T5)."""
    has_status = _has_col("tours", "status")
    has_active = _has_col("tours", "active")
    set_parts = []
    if has_status:
        set_parts.append("status = 'INACTIVE'")
    if has_active:
        set_parts.append("active = FALSE")
    if set_parts:
        execute_query(f"UPDATE tours SET {', '.join(set_parts)} WHERE id = %s", (tour_id,))


def list_operator_tours(
    operator_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Danh sách tour của operator (hoặc tất cả tour nếu operator_id=None cho admin)."""
    where = []
    params = []
    if operator_id is not None:
        where.append("t.operator_id = %s")
        params.append(operator_id)
    if status is not None:
        where.append("t.status = %s")
        params.append(status)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    has_op = _has_col("tours", "operator_id")
    has_status = _has_col("tours", "status")

    op_col = "t.operator_id, o.company_name AS operator_name," if has_op else ""
    st_col = "t.status, t.active," if has_status else ""
    op_join = "LEFT JOIN operators o ON o.id = t.operator_id" if has_op else ""

    params.extend([limit, offset])
    sql = f"""
        SELECT t.id, t.slug, t.name, t.summary, t.description, t.province_id,
               t.duration_days, t.price_from, t.cover_url, t.highlights,
               {op_col} {st_col}
               t.created_at, p.name AS province_name
        FROM tours t
        LEFT JOIN province_stats p ON p.id = t.province_id
        {op_join}
        {where_sql}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT %s OFFSET %s
    """
    rows = execute_query(sql, tuple(params))
    return rows or []


def count_operator_tours(operator_id: Optional[int] = None, status: Optional[str] = None) -> int:
    """Tổng số tour của operator phục vụ phân trang."""
    where = []
    params = []
    if operator_id is not None:
        where.append("t.operator_id = %s")
        params.append(operator_id)
    if status is not None:
        where.append("t.status = %s")
        params.append(status)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"SELECT count(*) AS total FROM tours t {where_sql}"
    rows = execute_query(sql, tuple(params))
    return rows[0]["total"] if rows else 0



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


# ═══════════════════════════════════════════════════════════════════════════
# Phase 5.3: Quản lý Đợt khởi hành (Tour Departures Repository)
# ═══════════════════════════════════════════════════════════════════════════

def get_departure_by_id(departure_id: int, tx=None) -> Optional[dict]:
    """Lấy thông tin chi tiết một đợt khởi hành theo id."""
    rows = _exec(
        """
        SELECT d.*, t.name AS tour_name, t.operator_id
        FROM tour_departures d
        JOIN tours t ON t.id = d.tour_id
        WHERE d.id = %s
        LIMIT 1
        """,
        (departure_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def get_departure_by_tour_and_date(tour_id: int, depart_date, tx=None) -> Optional[dict]:
    """Tìm đợt khởi hành theo (tour_id, depart_date) để kiểm tra tính duy nhất BR-D2."""
    rows = _exec(
        """
        SELECT *
        FROM tour_departures
        WHERE tour_id = %s AND depart_date = %s
        LIMIT 1
        """,
        (tour_id, depart_date),
        tx=tx,
    )
    return rows[0] if rows else None


def list_departures_by_tour(
    tour_id: int,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    limit: int = 100,
    offset: int = 0,
    tx=None,
) -> list:
    """Lấy danh sách tất cả các đợt khởi hành của một tour cho operator/admin."""
    clauses = ["d.tour_id = %s"]
    params = [tour_id]

    if status:
        clauses.append("d.status = %s")
        params.append(status)
    if from_date:
        clauses.append("d.depart_date >= %s")
        params.append(from_date)

    where_sql = " AND ".join(clauses)
    params.extend([limit, offset])

    return _exec(
        f"""
        SELECT d.*
        FROM tour_departures d
        WHERE {where_sql}
        ORDER BY d.depart_date ASC, d.id ASC
        LIMIT %s OFFSET %s
        """,
        tuple(params),
        tx=tx,
    ) or []


def count_departures_by_tour(
    tour_id: int,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    tx=None,
) -> int:
    """Đếm tổng số đợt khởi hành của một tour."""
    clauses = ["tour_id = %s"]
    params = [tour_id]

    if status:
        clauses.append("status = %s")
        params.append(status)
    if from_date:
        clauses.append("depart_date >= %s")
        params.append(from_date)

    where_sql = " AND ".join(clauses)
    rows = _exec(
        f"""
        SELECT COUNT(*) AS total
        FROM tour_departures
        WHERE {where_sql}
        """,
        tuple(params),
        tx=tx,
    )
    return rows[0]["total"] if rows else 0


def create_departure(tour_id: int, data: dict, tx=None) -> dict:
    """Tạo đợt khởi hành mới KHÔNG overwrite (không dùng ON CONFLICT DO UPDATE) theo BR-D2."""
    has_sale = _has_col("tour_departures", "sale_price")
    has_list_price = _has_col("tour_departures", "list_price")

    depart_date = data["depart_date"]
    list_price = data.get("list_price") if data.get("list_price") is not None else data.get("price")
    seats_total = int(data.get("seats_total", 20))
    seats_left = int(data.get("seats_left", seats_total))
    min_pax = int(data.get("min_pax", 1))
    status = data.get("status", "OPEN")
    sale_price = data.get("sale_price")
    sale_starts_at = data.get("sale_starts_at")
    sale_ends_at = data.get("sale_ends_at")

    if has_list_price and has_sale:
        rows = _exec(
            """
            INSERT INTO tour_departures (
                tour_id, depart_date, list_price, seats_total, seats_left,
                min_pax, status, sale_price, sale_starts_at, sale_ends_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                tour_id, depart_date, list_price, seats_total, seats_left,
                min_pax, status, sale_price, sale_starts_at, sale_ends_at,
            ),
            tx=tx,
        )
    else:
        rows = _exec(
            """
            INSERT INTO tour_departures (
                tour_id, depart_date, price, seats_total, seats_left
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (tour_id, depart_date, list_price, seats_total, seats_left),
            tx=tx,
        )
    return rows[0] if rows else {}


def update_departure(departure_id: int, data: dict, tx=None) -> Optional[dict]:
    """Cập nhật đợt khởi hành theo từng trường."""
    if not data:
        return get_departure_by_id(departure_id, tx=tx)

    set_clauses = []
    params = []
    has_sale = _has_col("tour_departures", "sale_price")
    has_list_price = _has_col("tour_departures", "list_price")

    for key, value in data.items():
        if key == "list_price":
            if has_list_price:
                set_clauses.append("list_price = %s")
                params.append(value)
            else:
                set_clauses.append("price = %s")
                params.append(value)
        elif key in ("depart_date", "seats_total", "seats_left", "min_pax", "status"):
            set_clauses.append(f"{key} = %s")
            params.append(value)
        elif key in ("sale_price", "sale_starts_at", "sale_ends_at") and has_sale:
            set_clauses.append(f"{key} = %s")
            params.append(value)

    if not set_clauses:
        return get_departure_by_id(departure_id, tx=tx)

    sql = f"""
        UPDATE tour_departures
        SET {', '.join(set_clauses)}
        WHERE id = %s
        RETURNING *
    """
    params.append(departure_id)
    rows = _exec(sql, tuple(params), tx=tx)
    return rows[0] if rows else None


def delete_departure(departure_id: int, tx=None) -> bool:
    """Xóa cứng đợt khởi hành khỏi CSDL."""
    rows = _exec(
        "DELETE FROM tour_departures WHERE id = %s RETURNING id",
        (departure_id,),
        tx=tx,
    )
    return bool(rows)


def count_departure_bookings(departure_id: int, tx=None) -> int:
    """Đếm tổng số đơn booking của một đợt khởi hành (bất kể trạng thái)."""
    rows = _exec(
        "SELECT COUNT(*) AS total FROM tour_bookings WHERE departure_id = %s",
        (departure_id,),
        tx=tx,
    )
    return rows[0]["total"] if rows else 0


def get_departure_sold_seats(departure_id: int, tx=None) -> int:
    """Tính số chỗ đã bán / đang giữ của một đợt khởi hành (BR-D4/E6).

    Nguồn tính toán an toàn:
    1. Số chỗ đã trừ thực tế trên tour_departures: seats_total - seats_left.
    2. Tổng số khách (guests) từ các đơn booking còn hiệu lực đang giữ chỗ
       (seats_released IS NOT TRUE và không thuộc nhóm terminal đã nhả chỗ).
    Lấy MAX(nguồn 1, nguồn 2) để đảm bảo an toàn tuyệt đối.
    """
    # 1. Tính từ tour_departures
    dep_rows = _exec(
        "SELECT seats_total, seats_left FROM tour_departures WHERE id = %s",
        (departure_id,),
        tx=tx,
    )
    sold_from_dep = 0
    if dep_rows:
        d = dep_rows[0]
        st = d.get("seats_total") or 0
        sl = d.get("seats_left") or 0
        sold_from_dep = max(0, st - sl)

    # 2. Tính từ tour_bookings
    has_released = _has_col("tour_bookings", "seats_released")
    rel_cond = "AND (seats_released IS FALSE OR seats_released IS NULL)" if has_released else ""
    # Các trạng thái booking giữ chỗ (chưa hủy/hết hạn)
    b_rows = _exec(
        f"""
        SELECT COALESCE(SUM(guests), 0) AS total_guests
        FROM tour_bookings
        WHERE departure_id = %s
          {rel_cond}
          AND status NOT IN ('EXPIRED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_OPERATOR', 'REFUNDED')
        """,
        (departure_id,),
        tx=tx,
    )
    sold_from_bookings = int(b_rows[0]["total_guests"]) if b_rows else 0

    return max(sold_from_dep, sold_from_bookings)


def sync_tour_price_from(tour_id: int, tx=None):
    """Đồng bộ price_from của tour từ các đợt OPEN còn mở trong tương lai (BR-D7)."""
    sql_eff = sql_gia_ban_hieu_luc("d")
    has_status = _has_col("tour_departures", "status")
    status_cond = "AND d.status = 'OPEN'" if has_status else ""

    rows = _exec(
        f"""
        SELECT MIN({sql_eff}) AS min_price
        FROM tour_departures d
        WHERE d.tour_id = %s
          AND d.depart_date >= CURRENT_DATE
          AND d.seats_left > 0
          {status_cond}
        """,
        (tour_id,),
        tx=tx,
    )
    min_price = rows[0]["min_price"] if rows and rows[0]["min_price"] is not None else None
    if min_price is not None:
        _exec(
            "UPDATE tours SET price_from = %s WHERE id = %s",
            (min_price, tour_id),
            tx=tx,
        )
