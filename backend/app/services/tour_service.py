"""Tour trọn gói — kiểu đi du lịch thứ nhất.

Khác hẳn phần tự túc: ở đây lịch trình, chỗ ở và giá đều do công ty soạn sẵn,
khách chỉ chọn ngày khởi hành rồi đặt. Giá là dữ liệu THẬT do admin nhập, nên
lọc theo giá ở đây có ý nghĩa — khác `price_level` của POI vốn chỉ chứa giá trị
mặc định "Trung bình".
"""

import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.database import transaction
from app.core.logging import get_logger
from app.repositories import tour_repo

logger = get_logger(__name__)

# Toàn bộ phép so sánh ngày giờ khuyến mãi và hạn giữ chỗ đều quy về múi giờ Việt Nam
TZ_VN = ZoneInfo("Asia/Ho_Chi_Minh")


class HetChoError(Exception):
    """Đợt khởi hành không còn đủ chỗ."""


class BookingNotFoundError(Exception):
    """Không tìm thấy đơn đặt tour."""


class InvalidStatusTransitionError(Exception):
    """Chuyển trạng thái booking không hợp lệ."""


class PaymentNotFoundError(Exception):
    """Không tìm thấy giao dịch thanh toán."""


class PaymentInvalidError(Exception):
    """Dữ liệu hoặc trạng thái thanh toán không hợp lệ."""


# ── Máy trạng thái Booking (§6 & BR-L1..L5) ──────────────────────────────────
ALL_BOOKING_STATUSES = {
    "PENDING_PAYMENT",
    "PAID",
    "PARTIALLY_PAID",
    "CONFIRMED",
    "EXPIRED",
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_OPERATOR",
    "COMPLETED",
    "REFUNDED",
    "NO_SHOW",
}

# Các trạng thái kết thúc (Terminal) theo BR-L1: không thể quay lại trạng thái trước
TERMINAL_BOOKING_STATUSES = {
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_OPERATOR",
    "COMPLETED",
    "REFUNDED",
    "NO_SHOW",
    "EXPIRED",
}

# Ma trận các bước chuyển đổi trạng thái hợp lệ theo sơ đồ §6
VALID_STATUS_TRANSITIONS = {
    "PENDING_PAYMENT": {
        "PAID",
        "PARTIALLY_PAID",
        "EXPIRED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_OPERATOR",
    },
    "PARTIALLY_PAID": {
        "PAID",
        "CANCELLED_BY_OPERATOR",
    },
    "PAID": {
        "CONFIRMED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_OPERATOR",
    },
    "CONFIRMED": {
        "COMPLETED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_OPERATOR",
        "NO_SHOW",
    },
    "CANCELLED_BY_CUSTOMER": {"REFUNDED"},
    "CANCELLED_BY_OPERATOR": {"REFUNDED"},
    "COMPLETED": {"REFUNDED"},
    "REFUNDED": set(),
    "NO_SHOW": set(),
    "EXPIRED": set(),
}

# Trong phạm vi Phase 2, chỉ các chuyển sau được phép thực thi:
PHASE_2_ALLOWED_TRANSITIONS = {
    ("PENDING_PAYMENT", "EXPIRED"),
    ("PENDING_PAYMENT", "CANCELLED_BY_CUSTOMER"),
    ("PENDING_PAYMENT", "CANCELLED_BY_OPERATOR"),
}

# Trong phạm vi Phase 3-lite (thanh toán thủ công):
# Mở thêm chuyển PENDING_PAYMENT -> PAID khi admin xác nhận thanh toán thành công (BR-P1..P5)
PHASE_3_ALLOWED_TRANSITIONS = {
    ("PENDING_PAYMENT", "PAID"),
    ("PENDING_PAYMENT", "EXPIRED"),
    ("PENDING_PAYMENT", "CANCELLED_BY_CUSTOMER"),
    ("PENDING_PAYMENT", "CANCELLED_BY_OPERATOR"),
}

# Tập các bước chuyển trạng thái được phép hiện tại
ALLOWED_STATUS_TRANSITIONS = PHASE_3_ALLOWED_TRANSITIONS


def la_khuyen_mai_hieu_luc(
    sale_price: Optional[int],
    list_price: Optional[int],
    sale_starts_at: Optional[datetime] = None,
    sale_ends_at: Optional[datetime] = None,
    thoi_diem: Optional[datetime] = None,
) -> bool:
    """Kiểm tra một đợt khởi hành có đang trong thời gian khuyến mãi hợp lệ hay không.

    Quy tắc nghiệp vụ:
    - sale_price phải > 0 và < list_price (chặn giảm giá ảo / làm giá giả).
    - sale_starts_at rỗng nghĩa là có hiệu lực ngay từ đầu.
    - sale_ends_at rỗng nghĩa là không giới hạn thời gian kết thúc.
    - So sánh chuẩn theo múi giờ Asia/Ho_Chi_Minh.
    """
    if sale_price is None or sale_price <= 0:
        return False
    if list_price is not None and sale_price >= list_price:
        return False

    now = thoi_diem or datetime.now(TZ_VN)
    if now.tzinfo is None:
        now = now.replace(tzinfo=TZ_VN)

    if sale_starts_at is not None:
        starts = sale_starts_at if sale_starts_at.tzinfo else sale_starts_at.replace(tzinfo=TZ_VN)
        if now < starts:
            return False

    if sale_ends_at is not None:
        ends = sale_ends_at if sale_ends_at.tzinfo else sale_ends_at.replace(tzinfo=TZ_VN)
        if now > ends:
            return False

    return True


def gia_ban_hieu_luc(departure: dict, thoi_diem: Optional[datetime] = None) -> Optional[int]:
    """Giá bán hiệu lực của một đợt khởi hành.

    Định nghĩa: bằng `sale_price` NẾU khuyến mãi đang trong thời gian hiệu lực,
    NGƯỢC LẠI là `list_price` (hoặc fallback `price` nếu schema cũ).
    Là con số DUY NHẤT dùng để tính tiền, lọc giá, sắp xếp và hiển thị.
    Mọi nơi khác đều tính lại từ hàm này, không tự so sánh sale_ends_at riêng.
    """
    list_price = departure.get("list_price")
    if list_price is None:
        list_price = departure.get("price")

    sale_price = departure.get("sale_price")
    sale_starts_at = departure.get("sale_starts_at")
    sale_ends_at = departure.get("sale_ends_at")

    if la_khuyen_mai_hieu_luc(sale_price, list_price, sale_starts_at, sale_ends_at, thoi_diem):
        return sale_price
    return list_price


def lam_giau_thong_tin_gia(departure: dict, thoi_diem: Optional[datetime] = None) -> dict:
    """Gắn giá bán hiệu lực và nhãn khuyến mãi vào thông tin đợt khởi hành.

    Website dùng:
    - effective_price: giá bán nổi bật
    - list_price: giá gốc gạch ngang
    - discount_pct: nhãn -N%
    """
    lp = departure.get("list_price") if departure.get("list_price") is not None else departure.get("price")
    eff = gia_ban_hieu_luc(departure, thoi_diem)

    departure["effective_price"] = eff
    departure["list_price"] = lp
    # Giữ price = effective_price để tương thích ngược với API client cũ
    departure["price"] = eff

    if lp and eff and eff < lp:
        departure["is_sale"] = True
        departure["discount_pct"] = round((lp - eff) / lp * 100)
    else:
        departure["is_sale"] = False
        departure["discount_pct"] = 0
    return departure


def list_tours(province_id=None, max_days=None, max_price=None, page=1, page_size=24):
    items, tong = tour_repo.list_tours(
        province_id=province_id, max_days=max_days, max_price=max_price,
        limit=page_size, offset=(max(page, 1) - 1) * page_size)
    return {"items": items, "total": tong, "page": page, "page_size": page_size}


def get_tour(slug: str):
    """Chi tiết tour + các đợt còn chỗ kèm thông tin khuyến mãi + địa điểm lịch trình."""
    tour = tour_repo.get_tour(slug)
    if not tour:
        return None

    raw_deps = tour_repo.departures(tour["id"])
    enriched_deps = [lam_giau_thong_tin_gia(d) for d in raw_deps]
    tour["departures"] = enriched_deps

    # Cập nhật price_from và original_price phản ánh đợt khởi hành rẻ nhất còn mở
    if enriched_deps:
        valid_effs = [d for d in enriched_deps if d.get("effective_price") is not None]
        if valid_effs:
            cheapest = min(valid_effs, key=lambda d: d["effective_price"])
            tour["price_from"] = cheapest["effective_price"]
            tour["original_price"] = cheapest.get("list_price") or cheapest["effective_price"]
            if tour["original_price"] > tour["price_from"]:
                tour["is_sale"] = True
                tour["discount_pct"] = round((tour["original_price"] - tour["price_from"]) / tour["original_price"] * 100)
            else:
                tour["is_sale"] = False
                tour["discount_pct"] = 0

    # Gắn tên/toạ độ vào từng ngày để frontend vẽ được lịch trình lên bản đồ.
    chi_tiet = tour_repo.places_of_tour(tour.get("itinerary"))
    for ngay in tour.get("itinerary") or []:
        ngay["places"] = [chi_tiet[i] for i in (ngay.get("place_ids") or [])
                          if i in chi_tiet]
    return tour


def nha_cho(booking_id: int, tx=None) -> bool:
    """Nhả chỗ của đơn booking về departure, chống trả chỗ 2 lần (BR-L3, E11).

    Gọi xuống `tour_repo.release_booking_seats()`.
    Nhờ cờ `seats_released`, thao tác này an toàn tuyệt đối và idempotent:
    Nếu gọi lần 2, 3... thì hàm sẽ trả về False và không cộng thêm chỗ vào `seats_left`.
    """
    if tx is not None:
        res = tour_repo.release_booking_seats(booking_id, tx=tx)
        return bool(res.get("released"))

    with transaction() as new_tx:
        res = tour_repo.release_booking_seats(booking_id, tx=new_tx)
        return bool(res.get("released"))


def chuyen_trang_thai(
    booking_id: int,
    tu: Optional[str],
    sang: str,
    ly_do: str,
    actor_id: Optional[int] = None,
    tx=None,
) -> dict:
    """Máy trạng thái dùng chung DUY NHẤT cho booking (Phase 2.3).

    Chặn mọi chuyển đổi không hợp lệ theo sơ đồ §6 và BR-L1..L5.
    1. Kiểm tra trạng thái đích có hợp lệ trong hệ thống.
    2. Chặn chuyển từ trạng thái terminal đi tiếp (BR-L1).
    3. Kiểm tra ma trận chuyển trạng thái hợp lệ.
    4. Trong phạm vi Phase 2, chỉ cho phép các chuyển:
       - PENDING_PAYMENT -> EXPIRED (quá hạn giữ chỗ, trả chỗ)
       - PENDING_PAYMENT -> CANCELLED_BY_CUSTOMER (khách hủy, trả chỗ)
       - PENDING_PAYMENT -> CANCELLED_BY_OPERATOR (hệ thống/operator hủy, trả chỗ)
       Các chuyển liên quan PAID/CONFIRMED được dành cho Phase sau.
    5. Khi chuyển sang EXPIRED / CANCELLED_*, tự động gọi `nha_cho()` trong cùng transaction.
    6. Mọi chuyển trạng thái thật đều ghi `booking_status_history` trong CÙNG transaction.
    """
    if sang not in ALL_BOOKING_STATUSES:
        raise InvalidStatusTransitionError(f"Trạng thái đích '{sang}' không hợp lệ trong hệ thống.")

    def _do_chuyen(active_tx):
        # Lấy booking với lock FOR UPDATE để chống race condition khi chuyển trạng thái
        booking = tour_repo.get_booking(booking_id, tx=active_tx, for_update=True)
        if not booking:
            raise BookingNotFoundError(f"Không tìm thấy đơn đặt tour #{booking_id}")

        current_status = booking.get("status")

        # Kiểm tra khớp với trạng thái kỳ vọng 'tu' nếu được chỉ định
        if tu is not None and current_status != tu:
            raise InvalidStatusTransitionError(
                f"Trạng thái hiện tại của đơn #{booking_id} là '{current_status}', không phải '{tu}'"
            )

        # Chặn chuyển từ terminal đi tiếp (BR-L1)
        if current_status in TERMINAL_BOOKING_STATUSES:
            valid_next = VALID_STATUS_TRANSITIONS.get(current_status, set())
            if sang not in valid_next:
                raise InvalidStatusTransitionError(
                    f"Đơn hàng #{booking_id} đã ở trạng thái kết thúc ({current_status}), "
                    f"không thể chuyển sang '{sang}' (BR-L1)."
                )

        # Kiểm tra ma trận chuyển đổi hợp lệ chung theo §6
        valid_targets = VALID_STATUS_TRANSITIONS.get(current_status, set())
        if sang not in valid_targets:
            raise InvalidStatusTransitionError(
                f"Không được phép chuyển trạng thái từ '{current_status}' sang '{sang}'."
            )

        # Kiểm tra phạm vi Phase 3-lite: chặn các chuyển của phase sau (như CONFIRMED)
        if (current_status, sang) not in ALLOWED_STATUS_TRANSITIONS:
            raise InvalidStatusTransitionError(
                f"Chuyển trạng thái từ '{current_status}' sang '{sang}' chưa được hỗ trợ trong Phase 3-lite "
                f"(chỉ hỗ trợ PENDING_PAYMENT -> PAID | EXPIRED | CANCELLED_BY_CUSTOMER | CANCELLED_BY_OPERATOR)."
            )

        # Nếu chuyển sang EXPIRED hoặc CANCELLED_*: tự động trả chỗ
        released = False
        if sang in {"EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR"}:
            released = nha_cho(booking_id, tx=active_tx)

        # Cập nhật trạng thái booking
        ok = tour_repo.update_booking_status(
            booking_id=booking_id,
            new_status=sang,
            expected_old_status=current_status,
            tx=active_tx,
        )
        if not ok:
            raise InvalidStatusTransitionError(
                f"Không thể cập nhật trạng thái đơn #{booking_id} sang '{sang}' (xung đột đồng thời)."
            )

        # Ghi nhật ký vào booking_status_history trong CÙNG transaction (BR-L2)
        history_id = tour_repo.add_booking_status_history(
            booking_id=booking_id,
            from_status=current_status,
            to_status=sang,
            actor_id=actor_id,
            reason=ly_do,
            tx=active_tx,
        )

        logger.info(
            "Đổi trạng thái booking #%s: %s -> %s (lý do: %s, actor: %s, nhả chỗ: %s, history: %s)",
            booking_id, current_status, sang, ly_do, actor_id, released, history_id,
        )

        return {
            "booking_id": booking_id,
            "from_status": current_status,
            "to_status": sang,
            "reason": ly_do,
            "actor_id": actor_id,
            "seats_released": released,
        }

    if tx is not None:
        return _do_chuyen(tx)

    with transaction() as new_tx:
        return _do_chuyen(new_tx)


def book(data: dict, user_id=None):
    """Đặt tour: giữ chỗ trước rồi mới ghi đơn trong CÙNG MỘT transaction (P0 + Phase 2.1).

    Quy trình:
    1. Giữ chỗ nguyên tử (seats_left >= guests).
    2. Snapshot đơn giá tại thời điểm đặt (unit_list_price, unit_sale_price).
    3. Sinh mã đơn chuẩn tra cứu dạng TX-YYYYMMDD-NNNN an toàn concurrency (Phase 2.2).
    4. Thiết lập hạn giữ chỗ mặc định 30 phút (hold_expires_at = now + 30m).
    5. Tạo đơn ở trạng thái PENDING_PAYMENT trong cùng transaction (Phase 2.1).
    6. Ghi bản ghi trạng thái ban đầu vào booking_status_history (NULL -> PENDING_PAYMENT) (BR-L2, Phase 2.4).
    7. Nếu có lỗi, transaction tự động rollback toàn bộ, seats_left khôi phục số cũ.
    """
    guests = int(data.get("guests") or 1)
    departure_id = data.get("departure_id")

    # Retry nếu xảy ra xung đột mã đơn cực hiếm khi không truyền code cố định
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with transaction() as tx:
                total = None
                unit_list_price = None
                unit_sale_price = None
                don_gia = None

                if departure_id:
                    con = tour_repo.giu_cho(departure_id, guests, tx=tx)
                    if not con:
                        raise HetChoError("Đợt khởi hành này không còn đủ chỗ. Hãy chọn ngày khác.")

                    # Tính giá bán hiệu lực tại thời điểm đặt để snapshot (BR-B5)
                    don_gia = gia_ban_hieu_luc(con)
                    unit_list_price = con.get("list_price") or con.get("price")
                    if con.get("sale_price") and don_gia == con.get("sale_price"):
                        unit_sale_price = con.get("sale_price")
                    else:
                        unit_sale_price = None

                    if don_gia:
                        total = don_gia * guests

                # Sinh mã đơn chuẩn TX-YYYYMMDD-NNNN (Phase 2.2)
                code = data.get("code") or tour_repo.generate_booking_code(tx=tx)
                hold_expires_at = datetime.now(TZ_VN) + timedelta(minutes=30)

                # Tạo đơn trạng thái PENDING_PAYMENT
                booking_id = tour_repo.create_booking(
                    data=data,
                    user_id=user_id,
                    total_price=total,
                    tx=tx,
                    unit_list_price=unit_list_price,
                    unit_sale_price=unit_sale_price,
                    code=code,
                    hold_expires_at=hold_expires_at,
                )

                # Ghi nhật ký trạng thái đầu tiên (BR-L2): NULL -> PENDING_PAYMENT
                tour_repo.add_booking_status_history(
                    booking_id=booking_id,
                    from_status=None,
                    to_status="PENDING_PAYMENT",
                    actor_id=user_id,
                    reason="Khách tạo đơn đặt tour",
                    tx=tx,
                )

                logger.info(
                    "Đặt tour #%s (mã %s): tour=%s đợt=%s, %d khách, tổng=%s, hết hạn=%s",
                    booking_id, code, data["tour_id"], departure_id, guests, total, hold_expires_at,
                )

                return {
                    "id": booking_id,
                    "code": code,
                    "status": "PENDING_PAYMENT",
                    "total_price": total,
                    "unit_effective_price": don_gia,
                    "hold_expires_at": hold_expires_at.isoformat(),
                }
        except Exception as e:
            if "unique" in str(e).lower() and attempt < max_retries - 1 and not data.get("code"):
                logger.warning("Trùng mã booking code, thử lại lần %d...", attempt + 1)
                continue
            raise


def xu_ly_booking_het_han(thoi_diem: Optional[datetime] = None) -> dict:
    """Job nền quét và dọn các booking hết hạn hoặc quá hạn khởi hành (Phase 2.6).

    Nghiệp vụ:
    a) Tất cả đơn PENDING_PAYMENT có hold_expires_at < thoi_diem (mặc định now)
       -> chuyển EXPIRED và nha_cho (E2).
    b) Tất cả đơn PENDING_PAYMENT có departure depart_date <= hôm nay (theo Asia/Ho_Chi_Minh)
       -> chuyển CANCELLED_BY_OPERATOR và nha_cho (E23).

    Mỗi đơn được xử lý trong transaction riêng biệt để đơn lỗi không ảnh hưởng đơn khác.
    Chạy lại nhiều lần an toàn và không trả chỗ lặp lại nhờ cờ seats_released (E11/BR-L3).
    """
    now = thoi_diem or datetime.now(TZ_VN)
    today_vn = now.date()

    expired_count = 0
    cancelled_count = 0
    errors = []

    # a) Xử lý đơn quá hạn 30 phút giữ chỗ
    expired_list = tour_repo.find_expired_bookings(thoi_diem=now)
    for b in expired_list:
        bid = b["id"]
        try:
            chuyen_trang_thai(
                booking_id=bid,
                tu="PENDING_PAYMENT",
                sang="EXPIRED",
                ly_do="Quá hạn giữ chỗ 30 phút",
                actor_id=None,
            )
            expired_count += 1
        except Exception as e:
            logger.error("Lỗi khi chuyển EXPIRED cho đơn #%s: %s", bid, e)
            errors.append({"booking_id": bid, "action": "EXPIRED", "error": str(e)})

    # b) Xử lý đơn PENDING_PAYMENT khi đợt khởi hành đã tới ngày (depart_date <= today_vn)
    past_depart_list = tour_repo.find_pending_bookings_past_depart_date(ngay=today_vn)
    for b in past_depart_list:
        bid = b["id"]
        try:
            chuyen_trang_thai(
                booking_id=bid,
                tu="PENDING_PAYMENT",
                sang="CANCELLED_BY_OPERATOR",
                ly_do="Đến ngày khởi hành nhưng chưa thanh toán",
                actor_id=None,
            )
            cancelled_count += 1
        except Exception as e:
            logger.error("Lỗi khi hủy đơn quá hạn khởi hành #%s: %s", bid, e)
            errors.append({"booking_id": bid, "action": "CANCELLED_BY_OPERATOR", "error": str(e)})

    logger.info(
        "Job dọn đơn hết hạn hoàn tất: %d đơn EXPIRED, %d đơn CANCELLED_BY_OPERATOR, %d lỗi",
        expired_count, cancelled_count, len(errors),
    )

    return {
        "expired_count": expired_count,
        "cancelled_count": cancelled_count,
        "total_processed": expired_count + cancelled_count,
        "errors": errors,
    }


def list_my_bookings(user_id: int, limit: int = 100) -> list:
    """Danh sách đơn đặt tour của khách hàng đang đăng nhập (Phase 2.7).

    Bổ sung thông tin tính toán: tiền tiết kiệm (savings), cờ khuyến mãi (is_sale).
    """
    rows = tour_repo.list_user_bookings(user_id=user_id, limit=limit)
    for r in rows:
        ulp = r.get("unit_list_price")
        usp = r.get("unit_sale_price")
        guests = int(r.get("guests") or 1)
        if ulp and usp and usp < ulp:
            r["is_sale"] = True
            r["savings"] = (ulp - usp) * guests
        else:
            r["is_sale"] = False
            r["savings"] = 0

        # Định dạng chuỗi ngày giờ nếu có
        if r.get("hold_expires_at") and isinstance(r["hold_expires_at"], datetime):
            r["hold_expires_at"] = r["hold_expires_at"].isoformat()
        if r.get("created_at") and isinstance(r["created_at"], datetime):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("depart_date") and isinstance(r["depart_date"], (date, datetime)):
            r["depart_date"] = r["depart_date"].isoformat()

    return rows


# ═══════════════════════════════════════════════════════════════════════════
# Phase 3-lite: Nghiệp vụ thanh toán thủ công (Manual Payments Service)
# ═══════════════════════════════════════════════════════════════════════════

def tao_thanh_toan(
    booking_id: int,
    method: str = "CHUYEN_KHOAN",
    amount: Optional[int] = None,
    note: Optional[str] = None,
    actor_id: Optional[int] = None,
    tx=None,
) -> dict:
    """Tạo bản ghi thanh toán mới cho đơn đặt tour (Phase 3.2).

    Nghiệp vụ:
    1. Kiểm tra booking tồn tại, đang ở trạng thái PENDING_PAYMENT.
    2. Kiểm tra hạn giữ chỗ: Nếu đã quá hạn hold_expires_at hoặc terminal -> từ chối (E3).
    3. Xác định số tiền:
       - Mặc định amount = total_price của booking (snapshot).
       - Nếu truyền amount khác total_price: Ghi nhận trạng thái là MISMATCH ngay từ đầu
         (giả định tự quyết: lưu vết để admin đối soát lệch tiền, booking giữ nguyên PENDING_PAYMENT).
       - Nếu amount khớp total_price: Trạng thái là PENDING.
    4. Sinh mã giao dịch txn_ref duy nhất dạng PM-YYYYMMDD-NNNN (advisory lock an toàn đồng thời).
    5. Tạo payment trong transaction.
    """
    def _do_tao(active_tx):
        # 1. Lấy thông tin booking
        booking = tour_repo.get_booking(booking_id, tx=active_tx, for_update=True)
        if not booking:
            raise BookingNotFoundError(f"Không tìm thấy đơn đặt tour #{booking_id}")

        current_status = booking.get("status")
        if current_status != "PENDING_PAYMENT":
            raise PaymentInvalidError(
                f"Đơn hàng #{booking_id} đang ở trạng thái '{current_status}', không thể tạo thanh toán."
            )

        # 2. Kiểm tra hạn giữ chỗ hold_expires_at
        now_vn = datetime.now(TZ_VN)
        hold_at = booking.get("hold_expires_at")
        if hold_at:
            if isinstance(hold_at, str):
                try:
                    hold_at = datetime.fromisoformat(hold_at)
                except Exception:
                    hold_at = None
            if hold_at:
                if hold_at.tzinfo is None:
                    hold_at = hold_at.replace(tzinfo=TZ_VN)
                if now_vn > hold_at:
                    raise PaymentInvalidError(
                        f"Đơn #{booking_id} đã hết hạn giữ chỗ ({hold_at.strftime('%Y-%m-%d %H:%M:%S')}), "
                        f"không thể thanh toán (E3: không tự khôi phục chỗ)."
                    )

        # 3. Xác định số tiền & trạng thái thanh toán ban đầu
        total_price = booking.get("total_price") or 0
        if amount is None:
            so_tien = total_price
        else:
            so_tien = int(amount)
            if so_tien <= 0:
                raise PaymentInvalidError("Số tiền thanh toán phải lớn hơn 0.")

        status = "PENDING" if so_tien == total_price else "MISMATCH"

        # 4. Sinh mã giao dịch chuẩn PM-YYYYMMDD-NNNN
        txn_ref = tour_repo.generate_payment_txn_ref(tx=active_tx)

        # 5. Lưu bản ghi thanh toán
        payment_data = {
            "booking_id": booking_id,
            "method": method,
            "amount": so_tien,
            "status": status,
            "txn_ref": txn_ref,
            "note": note,
            "confirmed_by": None,
            "confirmed_at": None,
        }
        payment_id = tour_repo.create_payment(payment_data, tx=active_tx)

        logger.info(
            "Tạo payment #%s (mã %s): booking=#%s, amount=%s, status=%s, method=%s",
            payment_id, txn_ref, booking_id, so_tien, status, method,
        )

        return {
            "id": payment_id,
            "booking_id": booking_id,
            "booking_code": booking.get("code"),
            "method": method,
            "amount": so_tien,
            "status": status,
            "txn_ref": txn_ref,
            "note": note,
            "created_at": now_vn.isoformat(),
        }

    if tx is not None:
        return _do_tao(tx)

    with transaction() as new_tx:
        return _do_tao(new_tx)


def xac_nhan_thanh_toan(
    payment_id: int,
    actor_id: int,
    note: Optional[str] = None,
    tx=None,
) -> dict:
    """Admin xác nhận thanh toán đã nhận tiền cho một payment (Phase 3.3).

    Quy trình kiểm soát nghiệp vụ:
    1. Idempotent: Nếu payment đã SUCCESS trước đó -> trả về kết quả hiện tại, không tạo thêm hiệu ứng.
    2. Nếu payment ở trạng thái FAILED -> báo lỗi không thể xác nhận.
    3. Kiểm tra booking tương ứng:
       - Nếu booking đã EXPIRED hoặc ở trạng thái TERMINAL (CANCELLED_*) -> cập nhật payment
         sang FAILED, không tự chuyển booking (admin xử lý thủ công sau).
       - Nếu booking quá hạn hold_expires_at nhưng chưa dọn -> chuyển booking sang EXPIRED
         (nhả chỗ đúng 1 lần), cập nhật payment sang FAILED.
       - Nếu amount của payment KHÔNG khớp booking total_price -> cập nhật payment sang MISMATCH,
         KHÔNG thay đổi trạng thái booking (giữ PENDING_PAYMENT).
    4. Ràng buộc BR-P1: Kiểm tra đơn hàng chưa có bất kỳ payment nào khác đạt SUCCESS.
    5. Khi tất cả hợp lệ:
       - Cập nhật payment: status='SUCCESS', confirmed_by=actor_id, confirmed_at=now.
       - Chuyển booking PENDING_PAYMENT -> PAID bằng hàm chuyen_trang_thai (giữ chỗ, ghi history).
    6. Toàn bộ thao tác chạy trong CÙNG một transaction.
    """
    def _do_xac_nhan(active_tx):
        # 1. Khóa bản ghi payment để tránh race condition xác nhận đồng thời
        payment = tour_repo.get_payment(payment_id, tx=active_tx, for_update=True)
        if not payment:
            raise PaymentNotFoundError(f"Không tìm thấy giao dịch thanh toán #{payment_id}")

        # Idempotent: nếu đã SUCCESS thì trả về ngay
        if payment.get("status") == "SUCCESS":
            logger.info("Payment #%s đã SUCCESS trước đó (idempotent request).", payment_id)
            return {
                "success": True,
                "payment_id": payment_id,
                "status": "SUCCESS",
                "booking_id": payment.get("booking_id"),
                "booking_status": payment.get("booking_status"),
                "amount": payment.get("amount"),
                "txn_ref": payment.get("txn_ref"),
                "message": "Giao dịch đã được xác nhận thành công trước đó (idempotent).",
                "idempotent": True,
            }

        if payment.get("status") == "FAILED":
            raise PaymentInvalidError(f"Giao dịch #{payment_id} đã thất bại (FAILED), không thể xác nhận.")

        booking_id = payment["booking_id"]
        # Khóa booking tương ứng
        booking = tour_repo.get_booking(booking_id, tx=active_tx, for_update=True)
        if not booking:
            raise BookingNotFoundError(f"Không tìm thấy đơn đặt tour #{booking_id}")

        current_booking_status = booking.get("status")
        now_vn = datetime.now(TZ_VN)

        # 2. Xử lý trường hợp booking đã ở trạng thái TERMINAL (EXPIRED, CANCELLED_*)
        if current_booking_status in TERMINAL_BOOKING_STATUSES:
            fail_reason = f"{note or ''}; Đơn đặt tour #{booking_id} đã ở trạng thái {current_booking_status}."
            tour_repo.update_payment_status(
                payment_id=payment_id,
                status="FAILED",
                confirmed_by=actor_id,
                confirmed_at=now_vn,
                note=fail_reason.strip("; "),
                tx=active_tx,
            )
            logger.warning(
                "Payment #%s bị đánh dấu FAILED vì booking #%s đã %s",
                payment_id, booking_id, current_booking_status,
            )
            return {
                "success": False,
                "payment_id": payment_id,
                "status": "FAILED",
                "booking_id": booking_id,
                "booking_status": current_booking_status,
                "amount": payment.get("amount"),
                "txn_ref": payment.get("txn_ref"),
                "message": (
                    f"Thanh toán thất bại (FAILED): Đơn đặt tour #{booking_id} đã ở trạng thái "
                    f"'{current_booking_status}'. Admin cần xử lý thủ công (hoàn tiền hoặc tạo đơn mới)."
                ),
            }

        # 3. Kiểm tra nếu booking quá hạn hold_expires_at
        hold_at = booking.get("hold_expires_at")
        if hold_at:
            if isinstance(hold_at, str):
                try:
                    hold_at = datetime.fromisoformat(hold_at)
                except Exception:
                    hold_at = None
            if hold_at:
                if hold_at.tzinfo is None:
                    hold_at = hold_at.replace(tzinfo=TZ_VN)
                if now_vn > hold_at:
                    # Đơn quá hạn giữ chỗ -> chuyển sang EXPIRED và đánh dấu payment FAILED
                    chuyen_trang_thai(
                        booking_id=booking_id,
                        tu="PENDING_PAYMENT",
                        sang="EXPIRED",
                        ly_do="Đơn hết hạn giữ chỗ khi kiểm tra xác nhận thanh toán",
                        actor_id=actor_id,
                        tx=active_tx,
                    )
                    tour_repo.update_payment_status(
                        payment_id=payment_id,
                        status="FAILED",
                        confirmed_by=actor_id,
                        confirmed_at=now_vn,
                        note=f"{note or ''}; Đơn quá hạn giữ chỗ 30 phút".strip("; "),
                        tx=active_tx,
                    )
                    logger.warning(
                        "Payment #%s bị FAILED và booking #%s chuyển EXPIRED vì quá hạn giữ chỗ",
                        payment_id, booking_id,
                    )
                    return {
                        "success": False,
                        "payment_id": payment_id,
                        "status": "FAILED",
                        "booking_id": booking_id,
                        "booking_status": "EXPIRED",
                        "amount": payment.get("amount"),
                        "txn_ref": payment.get("txn_ref"),
                        "message": (
                            f"Thanh toán thất bại (FAILED): Đơn đặt tour #{booking_id} đã quá hạn giữ chỗ "
                            f"và được chuyển sang EXPIRED (chỗ đã trả về)."
                        ),
                    }

        # 4. Kiểm tra khớp số tiền giữa payment và booking total_price
        booking_total = booking.get("total_price") or 0
        pay_amount = payment.get("amount") or 0

        if pay_amount != booking_total:
            mismatch_note = (
                f"{note or ''}; Sai lệch số tiền: payment={pay_amount} != total_price={booking_total}".strip("; ")
            )
            tour_repo.update_payment_status(
                payment_id=payment_id,
                status="MISMATCH",
                confirmed_by=actor_id,
                confirmed_at=now_vn,
                note=mismatch_note,
                tx=active_tx,
            )
            logger.warning(
                "Payment #%s bị MISMATCH: số tiền %s != booking total %s",
                payment_id, pay_amount, booking_total,
            )
            return {
                "success": False,
                "payment_id": payment_id,
                "status": "MISMATCH",
                "booking_id": booking_id,
                "booking_status": current_booking_status,
                "amount": pay_amount,
                "txn_ref": payment.get("txn_ref"),
                "message": (
                    f"Số tiền thanh toán ({pay_amount:,.0f} đ) không khớp với tổng tiền đơn hàng "
                    f"({booking_total:,.0f} đ). Bản ghi thanh toán chuyển sang MISMATCH, "
                    f"đơn hàng giữ nguyên {current_booking_status}."
                ),
            }

        # 5. Kiểm tra ràng buộc BR-P1: Mỗi booking tối đa 1 payment SUCCESS
        succ_cnt = tour_repo.count_successful_payments(booking_id, tx=active_tx)
        if succ_cnt > 0:
            raise PaymentInvalidError(
                f"Đơn hàng #{booking_id} đã có giao dịch thanh toán thành công khác (BR-P1: mỗi đơn chỉ 1 SUCCESS)."
            )

        # 6. Thanh toán thành công: Cập nhật payment SUCCESS và chuyển booking sang PAID
        tour_repo.update_payment_status(
            payment_id=payment_id,
            status="SUCCESS",
            confirmed_by=actor_id,
            confirmed_at=now_vn,
            note=note,
            expected_status=payment.get("status"),
            tx=active_tx,
        )

        chuyen_trang_thai(
            booking_id=booking_id,
            tu="PENDING_PAYMENT",
            sang="PAID",
            ly_do=f"Admin #{actor_id} xác nhận thanh toán thành công qua mã {payment.get('txn_ref')}",
            actor_id=actor_id,
            tx=active_tx,
        )

        logger.info(
            "Xác nhận thanh toán #%s SUCCESS: booking=#%s -> PAID, actor=#%s, amount=%s",
            payment_id, booking_id, actor_id, pay_amount,
        )

        return {
            "success": True,
            "payment_id": payment_id,
            "status": "SUCCESS",
            "booking_id": booking_id,
            "booking_status": "PAID",
            "amount": pay_amount,
            "txn_ref": payment.get("txn_ref"),
            "confirmed_by": actor_id,
            "confirmed_at": now_vn.isoformat(),
            "message": f"Xác nhận thanh toán thành công. Đơn hàng #{booking_id} đã chuyển sang PAID.",
        }

    if tx is not None:
        return _do_xac_nhan(tx)

    with transaction() as new_tx:
        return _do_xac_nhan(new_tx)

