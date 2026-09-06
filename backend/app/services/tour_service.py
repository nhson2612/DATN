"""Tour trọn gói — kiểu đi du lịch thứ nhất.

Khác hẳn phần tự túc: ở đây lịch trình, chỗ ở và giá đều do công ty soạn sẵn,
khách chỉ chọn ngày khởi hành rồi đặt. Giá là dữ liệu THẬT do admin nhập, nên
lọc theo giá ở đây có ý nghĩa — khác `price_level` của POI vốn chỉ chứa giá trị
mặc định "Trung bình".
"""

import json
import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.database import transaction
from app.core.logging import get_logger
from app.repositories import operator_repo, tour_repo

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


class TourNotFoundError(Exception):
    """Không tìm thấy tour."""


class TourPermissionDeniedError(Exception):
    """Không có quyền truy cập hoặc thao tác tour này (BR-O1)."""


class TourBusinessRuleError(Exception):
    """Vi phạm quy tắc nghiệp vụ tour (BR-T1, BR-T3, BR-T4, BR-T5)."""


class DepartureNotFoundError(Exception):
    """Không tìm thấy đợt khởi hành."""



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


def list_tour_provinces() -> list[dict]:
    """Danh sách tỉnh/thành có tour đang hoạt động phục vụ bộ lọc."""
    return tour_repo.list_tour_provinces()


def _chuan_hoa_images_api(tour: dict, photos_by_pid: Optional[dict] = None) -> None:
    """Đảm bảo tour['images'] luôn là list[str] URL thật từ itinerary.

    - Nếu DB cũ chưa migrate (images là None hoặc thiếu): fallback list rỗng [].
    - Nếu images là chuỗi JSON: parse về list.
    - Loại bỏ ảnh phong cảnh generic cũ (/assets/images/tour-*, /assets/images/vietnam-*, /assets/images/hero-slide-*).
    - Nếu images rỗng nhưng itinerary có địa điểm có ảnh trong place_photos:
      tự tổng hợp lại từ itinerary lúc đọc.
    - Cập nhật cover_url: nếu cover_url rỗng hoặc là generic, gán cover_url = images[0] nếu có.
    """
    raw = tour.get("images")
    if raw is None:
        images_list = []
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            images_list = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            images_list = [raw] if raw.strip() else []
    elif isinstance(raw, list):
        images_list = raw
    else:
        images_list = [raw]

    images = [str(x).strip() for x in images_list if str(x).strip()]

    # Nếu tour có itinerary và images chứa ảnh generic cũ (/assets/images/...), loại bỏ ảnh generic
    has_itinerary = bool(tour.get("itinerary"))
    if has_itinerary:
        images = [x for x in images if not x.startswith("/assets/images/")]

    # Fallback: nếu images rỗng nhưng có itinerary, tự tổng hợp lại từ place_photos
    if not images and has_itinerary:
        itinerary = tour.get("itinerary") or []
        pids = []
        for day in itinerary:
            for pid in (day.get("place_ids") or []):
                if pid not in pids:
                    pids.append(pid)
        if pids:
            if photos_by_pid is None:
                itin_photos = tour_repo.get_itinerary_photos(itinerary)
            else:
                itin_photos = []
                seen = set()
                for pid in pids:
                    for url in photos_by_pid.get(pid, []):
                        if url and url not in seen:
                            seen.add(url)
                            itin_photos.append(url)
            if itin_photos:
                images = itin_photos

    tour["images"] = images

    # Cập nhật cover_url nếu cover_url rỗng hoặc là generic
    cover = tour.get("cover_url")
    is_generic_cover = cover and str(cover).startswith("/assets/images/")
    if (not cover or is_generic_cover) and images:
        tour["cover_url"] = images[0]
    elif is_generic_cover and not images and has_itinerary:
        tour["cover_url"] = None


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
    page=1,
    page_size=24,
):
    if price_max is None and max_price is not None:
        price_max = max_price
    items, tong = tour_repo.list_tours(
        province_id=province_id,
        depart_from=depart_from,
        depart_to=depart_to,
        price_min=price_min,
        price_max=price_max,
        max_price=price_max,
        max_days=max_days,
        min_days=min_days,
        guests=guests,
        sort=sort,
        limit=page_size,
        offset=(max(page, 1) - 1) * page_size,
    )

    # Tối ưu: Gom tất cả place_id của các tour cần fallback để query batch 1 lần
    pids_to_fetch = set()
    for t in items:
        raw_imgs = t.get("images") or []
        if isinstance(raw_imgs, str):
            try:
                raw_imgs = json.loads(raw_imgs)
            except Exception:
                raw_imgs = []
        is_empty_or_generic = not raw_imgs or (
            isinstance(raw_imgs, list) and all(str(x).startswith("/assets/images/") for x in raw_imgs)
        )
        if is_empty_or_generic and t.get("itinerary"):
            for day in t.get("itinerary") or []:
                for pid in (day.get("place_ids") or []):
                    pids_to_fetch.add(pid)

    photos_by_pid = tour_repo.get_photos_for_places(list(pids_to_fetch)) if pids_to_fetch else {}

    for t in items:
        _chuan_hoa_images_api(t, photos_by_pid=photos_by_pid)
    return {"items": items, "total": tong, "page": page, "page_size": page_size}


def get_tour(slug: str):
    """Chi tiết tour + các đợt còn chỗ kèm thông tin khuyến mãi + địa điểm lịch trình."""
    tour = tour_repo.get_tour(slug)
    if not tour:
        return None

    _chuan_hoa_images_api(tour)

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

        # Kiểm tra quá hạn giữ chỗ 30 phút
        status = r.get("status")
        hold_at = r.get("hold_expires_at")
        is_hold_expired = False
        if status == "PENDING_PAYMENT" and hold_at:
            hold_at_dt = None
            if isinstance(hold_at, datetime):
                hold_at_dt = hold_at
            elif isinstance(hold_at, str):
                try:
                    hold_at_dt = datetime.fromisoformat(hold_at)
                except Exception:
                    hold_at_dt = None

            if hold_at_dt:
                now_vn = datetime.now(TZ_VN)
                if hold_at_dt.tzinfo is None:
                    hold_at_dt = hold_at_dt.replace(tzinfo=TZ_VN)
                if now_vn > hold_at_dt:
                    is_hold_expired = True

        r["is_hold_expired"] = is_hold_expired

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


# ═══════════════════════════════════════════════════════════════════════════
# Phase 5.2: Nghiệp vụ Tour dành cho Tour Operator (BR-O1 / BR-T1..T5)
# ═══════════════════════════════════════════════════════════════════════════

def _normalize_json_obj(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return val


def tao_tour_operator(data: dict, current_user: dict) -> dict:
    """Tạo tour mới dành cho Operator hoặc Admin (UC-T01).

    - BR-T1: duration_days >= 1.
    - BR-T2: slug duy nhất, tự sinh nếu chưa có.
    - Gán operator_id từ token (hoặc từ data nếu là admin).
    - Mặc định trạng thái DRAFT nếu không truyền.
    """
    from app.services.destination_service import slugify

    duration_days = int(data.get("duration_days") or 1)
    if duration_days < 1:
        raise TourBusinessRuleError("Số ngày của tour (duration_days) phải lớn hơn hoặc bằng 1 theo quy tắc BR-T1.")

    name = (data.get("name") or "").strip()
    if not name:
        raise TourBusinessRuleError("Tên tour không được để trống.")

    slug = data.get("slug")
    if not slug:
        base_slug = slugify(name)
        slug = base_slug
        suffix = 1
        while tour_repo.get_tour_by_slug(slug) is not None:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
    else:
        existing = tour_repo.get_tour_by_slug(slug)
        if existing:
            raise TourBusinessRuleError(f"Slug '{slug}' đã tồn tại trong hệ thống (BR-T2).")

    is_admin = current_user.get("is_admin", False)
    if is_admin:
        operator_id = data.get("operator_id")
        if not operator_id:
            raise TourBusinessRuleError(
                "Admin tạo tour cần truyền operator_id để tour không bị mồ côi (thiếu chủ sở hữu)."
            )
        op = operator_repo.find_by_id(operator_id)
        if not op or op.get("status") != "ACTIVE":
            raise TourBusinessRuleError(f"Không tìm thấy operator ACTIVE #{operator_id}.")
    else:
        operator_id = current_user.get("operator_id")
        if not operator_id:
            raise TourPermissionDeniedError("Tài khoản không có thông tin operator hợp lệ.")

    tour_dict = dict(data)
    tour_dict["slug"] = slug
    tour_dict["name"] = name
    tour_dict["duration_days"] = duration_days
    tour_dict["operator_id"] = operator_id
    if "status" not in tour_dict or not tour_dict["status"]:
        tour_dict["status"] = "DRAFT"

    tour_id = tour_repo.create_tour(tour_dict, upsert=False)
    if not tour_id:
        raise TourBusinessRuleError(f"Slug '{slug}' vừa bị tour khác chiếm (BR-T2).")
    created = tour_repo.get_tour_by_id(tour_id)
    return created


def lay_chi_tiet_tour_operator(tour_id: int, current_user: dict) -> dict:
    """Lấy chi tiết tour theo id kèm kiểm tra quyền sở hữu BR-O1."""
    tour = tour_repo.get_tour_by_id(tour_id)
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{tour_id}.")

    is_admin = current_user.get("is_admin", False)
    if not is_admin:
        if tour.get("operator_id") != current_user.get("operator_id"):
            raise TourPermissionDeniedError("Bạn không có quyền truy cập tour của nhà điều hành khác (BR-O1).")

    return tour


def danh_sach_tour_operator(
    current_user: dict,
    query_operator_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Liệt kê tour theo operator_id hoặc tất cả nếu là admin."""
    is_admin = current_user.get("is_admin", False)
    if is_admin:
        target_operator_id = query_operator_id
    else:
        target_operator_id = current_user.get("operator_id")

    offset = (page - 1) * page_size
    tours = tour_repo.list_operator_tours(
        operator_id=target_operator_id,
        status=status,
        limit=page_size,
        offset=offset,
    )
    total = tour_repo.count_operator_tours(operator_id=target_operator_id, status=status)
    return {
        "tours": tours,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def cap_nhat_tour_operator(tour_id: int, data: dict, current_user: dict) -> dict:
    """Cập nhật tour có kiểm tra BR-O1, BR-T3, BR-T4."""
    from app.services.destination_service import slugify

    tour_cu = tour_repo.get_tour_by_id(tour_id)
    if not tour_cu:
        raise TourNotFoundError(f"Không tìm thấy tour #{tour_id}.")

    is_admin = current_user.get("is_admin", False)
    if not is_admin:
        if tour_cu.get("operator_id") != current_user.get("operator_id"):
            raise TourPermissionDeniedError("Bạn không có quyền chỉnh sửa tour của nhà điều hành khác (BR-O1).")

    duration_days = int(data.get("duration_days") or tour_cu.get("duration_days") or 1)
    if duration_days < 1:
        raise TourBusinessRuleError("Số ngày của tour (duration_days) phải lớn hơn hoặc bằng 1 theo quy tắc BR-T1.")

    # BR-T3: Tour đã có booking CONFIRMED thì KHÔNG ĐƯỢC sửa lịch trình, số ngày, chính sách hủy
    if tour_repo.tour_has_confirmed_bookings(tour_id):
        if "duration_days" in data and int(data["duration_days"]) != int(tour_cu.get("duration_days", 1)):
            raise TourBusinessRuleError(
                "Tour đã có đơn đặt tour được xác nhận (CONFIRMED). "
                "Theo quy tắc BR-T3, không được thay đổi số ngày (duration_days)."
            )
        if "itinerary" in data and _normalize_json_obj(data["itinerary"]) != _normalize_json_obj(tour_cu.get("itinerary")):
            raise TourBusinessRuleError(
                "Tour đã có đơn đặt tour được xác nhận (CONFIRMED). "
                "Theo quy tắc BR-T3, không được thay đổi lịch trình (itinerary)."
            )
        if "cancellation_policy" in data and _normalize_json_obj(data["cancellation_policy"]) != _normalize_json_obj(tour_cu.get("cancellation_policy")):
            raise TourBusinessRuleError(
                "Tour đã có đơn đặt tour được xác nhận (CONFIRMED). "
                "Theo quy tắc BR-T3, không được thay đổi chính sách hủy (cancellation_policy)."
            )

    # BR-T4: Sửa hạn chế khi tour đang ACTIVE (chỉ mô tả, ảnh, highlights, included, excluded, status)
    if tour_cu.get("status") == "ACTIVE":
        # Kiểm tra nếu cố đổi các trường cốt lõi
        if "duration_days" in data and int(data["duration_days"]) != int(tour_cu.get("duration_days", 1)):
            raise TourBusinessRuleError(
                "Tour đang ở trạng thái ACTIVE. Theo quy tắc BR-T4, chỉ được cập nhật mô tả, hình ảnh, điểm nhấn và dịch vụ bao gồm/không bao gồm. "
                "Để đổi số ngày, vui lòng chuyển tour về DRAFT trước."
            )
        if "itinerary" in data and _normalize_json_obj(data["itinerary"]) != _normalize_json_obj(tour_cu.get("itinerary")):
            raise TourBusinessRuleError(
                "Tour đang ở trạng thái ACTIVE. Theo quy tắc BR-T4, chỉ được cập nhật mô tả, hình ảnh, điểm nhấn và dịch vụ bao gồm/không bao gồm. "
                "Để đổi lịch trình, vui lòng chuyển tour về DRAFT trước."
            )
        if "province_id" in data and data["province_id"] != tour_cu.get("province_id"):
            raise TourBusinessRuleError(
                "Tour đang ở trạng thái ACTIVE. Theo quy tắc BR-T4, không được đổi điểm đến tỉnh/thành khi tour đang mở bán."
            )
        if "cancellation_policy" in data and _normalize_json_obj(data["cancellation_policy"]) != _normalize_json_obj(tour_cu.get("cancellation_policy")):
            raise TourBusinessRuleError(
                "Tour đang ở trạng thái ACTIVE. Theo quy tắc BR-T4, không được đổi chính sách hủy khi tour đang mở bán."
            )
        if "name" in data and data["name"].strip() != tour_cu.get("name", "").strip():
            raise TourBusinessRuleError(
                "Tour đang ở trạng thái ACTIVE. Theo quy tắc BR-T4, không được đổi tên tour khi đang mở bán. Vui lòng chuyển về DRAFT nếu muốn đổi."
            )

    # Kiểm tra slug nếu đổi
    new_slug = data.get("slug")
    if new_slug and new_slug != tour_cu.get("slug"):
        exist = tour_repo.get_tour_by_slug(new_slug)
        if exist and exist.get("id") != tour_id:
            raise TourBusinessRuleError(f"Slug '{new_slug}' đã được sử dụng bởi tour khác.")

    update_payload = dict(data)
    update_payload["duration_days"] = duration_days

    # Giữ nguyên operator_id của tour, trừ phi admin chỉ định đổi
    if not is_admin:
        update_payload["operator_id"] = tour_cu.get("operator_id")

    tour_repo.update_tour(tour_id, update_payload)
    return tour_repo.get_tour_by_id(tour_id)


def xoa_tour_operator(tour_id: int, current_user: dict) -> dict:
    """Xoá tour của operator theo quy tắc BR-T5:

    - Nếu tour đã từng có booking: xoá mềm (status=INACTIVE, active=FALSE).
    - Nếu tour chưa từng có booking: xoá cứng khỏi CSDL.
    """
    tour = tour_repo.get_tour_by_id(tour_id)
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{tour_id}.")

    is_admin = current_user.get("is_admin", False)
    if not is_admin:
        if tour.get("operator_id") != current_user.get("operator_id"):
            raise TourPermissionDeniedError("Bạn không có quyền xoá tour của nhà điều hành khác (BR-O1).")

    has_booking = tour_repo.tour_has_bookings(tour_id)
    if has_booking:
        tour_repo.delete_tour_soft(tour_id)
        return {
            "success": True,
            "tour_id": tour_id,
            "soft_deleted": True,
            "message": "Tour đã có đơn đặt phòng nên được chuyển sang trạng thái ngừng hoạt động (INACTIVE) theo quy tắc BR-T5.",
        }
    else:
        tour_repo.delete_tour_hard(tour_id)
        return {
            "success": True,
            "tour_id": tour_id,
            "soft_deleted": False,
            "message": "Đã xoá tour thành công khỏi hệ thống.",
        }


# ═══════════════════════════════════════════════════════════════════════════
# Phase 5.3: Quản lý Đợt khởi hành (Departure Management) cho Operator / Admin
# ═══════════════════════════════════════════════════════════════════════════

def _kiem_tra_quyen_tour(tour: dict, current_user: dict):
    """Kiểm tra quyền thao tác trên tour theo quy tắc BR-O1."""
    is_admin = current_user.get("is_admin", False)
    if is_admin:
        return
    tour_op_id = tour.get("operator_id")
    user_op_id = current_user.get("operator_id")
    if tour_op_id is None or user_op_id is None or tour_op_id != user_op_id:
        raise TourPermissionDeniedError("Bạn không có quyền thao tác trên tour của nhà điều hành khác (BR-O1).")


def _kiem_tra_sale_hop_le(list_price, sale_price):
    """Kiểm tra sale_price với list_price trước khi lưu đợt khởi hành.

    Bảng tour_departures có CHECK tương tự; validate ở service để trả 400
    (TourBusinessRuleError) thay vì để DB văng lỗi constraint -> HTTP 500.
    """
    if sale_price is None:
        return
    try:
        sp = int(sale_price)
    except (ValueError, TypeError):
        raise TourBusinessRuleError("Giá khuyến mãi (sale_price) phải là số nguyên.")
    if sp <= 0 or (list_price is not None and sp >= int(list_price)):
        raise TourBusinessRuleError(
            f"Giá khuyến mãi ({sp}) phải lớn hơn 0 và nhỏ hơn giá gốc ({list_price})."
        )


def _kiem_tra_cua_so_sale(sale_starts_at, sale_ends_at):
    """Kiểm tra cửa sổ thời gian sale: sale_starts_at <= sale_ends_at khi cả hai có giá trị (Rule 2)."""
    if sale_starts_at is None or sale_ends_at is None:
        return sale_starts_at, sale_ends_at

    s_start = sale_starts_at
    s_end = sale_ends_at
    if isinstance(s_start, str):
        try:
            s_start = datetime.fromisoformat(s_start)
        except ValueError:
            raise TourBusinessRuleError(f"Định dạng sale_starts_at không hợp lệ: '{s_start}'.")
    if isinstance(s_end, str):
        try:
            s_end = datetime.fromisoformat(s_end)
        except ValueError:
            raise TourBusinessRuleError(f"Định dạng sale_ends_at không hợp lệ: '{s_end}'.")

    # Chuẩn hoá múi giờ để so sánh an toàn
    dt_start = s_start if s_start.tzinfo else s_start.replace(tzinfo=TZ_VN)
    dt_end = s_end if s_end.tzinfo else s_end.replace(tzinfo=TZ_VN)

    if dt_start > dt_end:
        raise TourBusinessRuleError(
            f"Thời gian kết thúc khuyến mãi ({dt_end}) phải lớn hơn hoặc bằng "
            f"thời gian bắt đầu ({dt_start})."
        )
    return s_start, s_end



def tao_departure_operator(tour_id: int, data: dict, current_user: dict) -> dict:
    """Tạo đợt khởi hành mới cho tour (Phase 5.3).

    Quy tắc nghiệp vụ:
    - BR-O1: Chỉ operator sở hữu tour hoặc admin mới được tạo đợt.
    - BR-D1: depart_date >= hôm nay + 2 ngày (Asia/Ho_Chi_Minh).
    - BR-D2: (tour_id, depart_date) là duy nhất. Không ghi đè.
    - BR-D3: 0 <= seats_left <= seats_total; khởi tạo seats_left = seats_total.
    - list_price > 0, seats_total >= 1, min_pax >= 1.
    - Đồng bộ price_from của tour sau khi tạo.
    """
    tour = tour_repo.get_tour_by_id(tour_id)
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{tour_id}.")

    _kiem_tra_quyen_tour(tour, current_user)

    # 1. Kiểm tra các trường bắt buộc
    if "depart_date" not in data or data["depart_date"] is None:
        raise TourBusinessRuleError("Thiếu trường bắt buộc depart_date.")
    if "list_price" not in data or data["list_price"] is None:
        raise TourBusinessRuleError("Thiếu trường bắt buộc list_price.")
    if "seats_total" not in data or data["seats_total"] is None:
        raise TourBusinessRuleError("Thiếu trường bắt buộc seats_total.")

    # 2. Xử lý và kiểm tra ngày khởi hành (BR-D1)
    dep_date = data["depart_date"]
    if isinstance(dep_date, str):
        try:
            dep_date = date.fromisoformat(dep_date)
        except ValueError:
            raise TourBusinessRuleError(f"Định dạng ngày depart_date không hợp lệ: '{dep_date}'. Yêu cầu YYYY-MM-DD.")

    today_vn = datetime.now(TZ_VN).date()
    min_lead_date = today_vn + timedelta(days=2)
    if dep_date < min_lead_date:
        raise TourBusinessRuleError(
            f"Ngày khởi hành ({dep_date}) phải từ {min_lead_date} trở đi "
            f"(tối thiểu 2 ngày trước khởi hành theo BR-D1)."
        )

    # 3. Kiểm tra giá niêm yết và số chỗ
    try:
        list_price = int(data["list_price"])
    except (ValueError, TypeError):
        raise TourBusinessRuleError("Giá gốc (list_price) phải là số nguyên.")
    if list_price <= 0:
        raise TourBusinessRuleError("Giá gốc (list_price) phải lớn hơn 0.")
    _kiem_tra_sale_hop_le(list_price, data.get("sale_price"))

    try:
        seats_total = int(data["seats_total"])
    except (ValueError, TypeError):
        raise TourBusinessRuleError("Tổng số chỗ (seats_total) phải là số nguyên.")
    if seats_total < 1:
        raise TourBusinessRuleError("Tổng số chỗ (seats_total) phải lớn hơn hoặc bằng 1.")

    min_pax = int(data.get("min_pax") or 1)
    if min_pax < 1:
        raise TourBusinessRuleError("Số khách tối thiểu (min_pax) phải lớn hơn hoặc bằng 1.")

    status = data.get("status") or "OPEN"
    valid_statuses = {'OPEN', 'FULL', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED'}
    if status not in valid_statuses:
        raise TourBusinessRuleError(f"Trạng thái đợt khởi hành '{status}' không hợp lệ.")

    # 4. Kiểm tra trùng ngày (BR-D2)
    existing = tour_repo.get_departure_by_tour_and_date(tour_id, dep_date)
    if existing:
        raise TourBusinessRuleError(f"Đợt khởi hành ngày {dep_date} của tour này đã tồn tại (BR-D2).")

    # 5. Lưu đợt khởi hành mới
    payload = dict(data)
    payload["depart_date"] = dep_date
    payload["list_price"] = list_price
    payload["seats_total"] = seats_total
    payload["seats_left"] = seats_total  # BR-D3
    payload["min_pax"] = min_pax
    payload["status"] = status

    created = tour_repo.create_departure(tour_id, payload)
    tour_repo.sync_tour_price_from(tour_id)
    return lam_giau_thong_tin_gia(created)


def danh_sach_departure_operator(
    tour_id: int,
    current_user: dict,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Lấy danh sách các đợt khởi hành của tour cho operator sở hữu hoặc admin."""
    tour = tour_repo.get_tour_by_id(tour_id)
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{tour_id}.")

    _kiem_tra_quyen_tour(tour, current_user)

    offset = (page - 1) * page_size
    departures = tour_repo.list_departures_by_tour(
        tour_id=tour_id,
        status=status,
        from_date=from_date,
        limit=page_size,
        offset=offset,
    )
    total = tour_repo.count_departures_by_tour(
        tour_id=tour_id,
        status=status,
        from_date=from_date,
    )

    enriched = []
    for d in departures:
        st = d.get("seats_total") or 0
        sl = d.get("seats_left") or 0
        d["sold_seats"] = max(0, st - sl)
        enriched.append(lam_giau_thong_tin_gia(d))

    return {
        "departures": enriched,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def lay_chi_tiet_departure_operator(
    departure_id: int,
    current_user: dict,
    tour_id: Optional[int] = None,
) -> dict:
    """Lấy thông tin chi tiết một đợt khởi hành kèm kiểm tra quyền BR-O1."""
    dep = tour_repo.get_departure_by_id(departure_id)
    if not dep:
        raise DepartureNotFoundError(f"Không tìm thấy đợt khởi hành #{departure_id}.")

    if tour_id is not None and dep["tour_id"] != tour_id:
        raise TourBusinessRuleError(f"Đợt khởi hành #{departure_id} không thuộc tour #{tour_id}.")

    tour = tour_repo.get_tour_by_id(dep["tour_id"])
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{dep['tour_id']}.")

    _kiem_tra_quyen_tour(tour, current_user)

    dep["sold_seats"] = tour_repo.get_departure_sold_seats(departure_id)
    dep["bookings_count"] = tour_repo.count_departure_bookings(departure_id)
    return lam_giau_thong_tin_gia(dep)


def cap_nhat_departure_operator(
    departure_id: int,
    data: dict,
    current_user: dict,
    tour_id: Optional[int] = None,
) -> dict:
    """Cập nhật đợt khởi hành của operator kèm kiểm tra BR-D1, BR-D2, BR-D3, BR-D4/E6.

    Quy tắc nghiệp vụ:
    - BR-O1: Chỉ operator sở hữu tour hoặc admin mới được sửa.
    - BR-D1: Nếu sửa depart_date -> depart_date mới >= hôm nay + 2 ngày.
    - BR-D2: Nếu sửa depart_date -> không trùng với đợt khác của cùng tour.
    - BR-D4/E6: Không được giảm seats_total xuống dưới số chỗ đã bán.
    - BR-D3: Luôn đảm bảo 0 <= seats_left <= seats_total.
    - Đồng bộ price_from của tour sau khi sửa.
    """
    dep = tour_repo.get_departure_by_id(departure_id)
    if not dep:
        raise DepartureNotFoundError(f"Không tìm thấy đợt khởi hành #{departure_id}.")

    if tour_id is not None and dep["tour_id"] != tour_id:
        raise TourBusinessRuleError(f"Đợt khởi hành #{departure_id} không thuộc tour #{tour_id}.")

    tour = tour_repo.get_tour_by_id(dep["tour_id"])
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{dep['tour_id']}.")

    _kiem_tra_quyen_tour(tour, current_user)

    update_payload = {}

    # 1. Cập nhật ngày khởi hành (BR-D1, BR-D2)
    if "depart_date" in data and data["depart_date"] is not None:
        new_date = data["depart_date"]
        if isinstance(new_date, str):
            try:
                new_date = date.fromisoformat(new_date)
            except ValueError:
                raise TourBusinessRuleError(f"Định dạng ngày depart_date không hợp lệ: '{new_date}'.")

        if new_date != dep["depart_date"]:
            today_vn = datetime.now(TZ_VN).date()
            min_lead_date = today_vn + timedelta(days=2)
            if new_date < min_lead_date:
                raise TourBusinessRuleError(
                    f"Ngày khởi hành ({new_date}) phải từ {min_lead_date} trở đi "
                    f"(tối thiểu 2 ngày trước khởi hành theo BR-D1)."
                )
            dup = tour_repo.get_departure_by_tour_and_date(dep["tour_id"], new_date)
            if dup and dup["id"] != departure_id:
                raise TourBusinessRuleError(f"Đợt khởi hành ngày {new_date} của tour này đã tồn tại (BR-D2).")
            update_payload["depart_date"] = new_date

    # 2. Cập nhật giá niêm yết
    if "list_price" in data and data["list_price"] is not None:
        try:
            lp = int(data["list_price"])
        except (ValueError, TypeError):
            raise TourBusinessRuleError("Giá gốc (list_price) phải là số nguyên.")
        if lp <= 0:
            raise TourBusinessRuleError("Giá gốc (list_price) phải lớn hơn 0.")

        # BR-SL5 / E13: Đợt đã có booking (đang giữ/đã bán, chưa release) -> không cho tăng list_price
        cur_lp = dep.get("list_price") if dep.get("list_price") is not None else dep.get("price")
        if cur_lp is not None and lp > cur_lp:
            sold_seats = tour_repo.get_departure_sold_seats(departure_id)
            if sold_seats > 0:
                raise TourBusinessRuleError(
                    f"Đợt khởi hành đã có {sold_seats} chỗ đang giữ hoặc đã bán, "
                    f"không được phép tăng giá gốc (list_price) từ {cur_lp} lên {lp} (BR-SL5/E13)."
                )
        update_payload["list_price"] = lp

    # Sale phải luôn nhỏ hơn list_price mới nhất (cả khi giảm list_price)
    next_list_price = update_payload.get("list_price", dep.get("list_price"))
    if "sale_price" in data:
        _kiem_tra_sale_hop_le(next_list_price, data.get("sale_price"))
    else:
        _kiem_tra_sale_hop_le(next_list_price, dep.get("sale_price"))

    # Kiểm tra cửa sổ thời gian sale nếu có cập nhật
    next_starts = data["sale_starts_at"] if "sale_starts_at" in data else dep.get("sale_starts_at")
    next_ends = data["sale_ends_at"] if "sale_ends_at" in data else dep.get("sale_ends_at")
    if "sale_starts_at" in data or "sale_ends_at" in data:
        _kiem_tra_cua_so_sale(next_starts, next_ends)


    # 3. Cập nhật min_pax
    if "min_pax" in data and data["min_pax"] is not None:
        try:
            mp = int(data["min_pax"])
        except (ValueError, TypeError):
            raise TourBusinessRuleError("Số khách tối thiểu (min_pax) phải là số nguyên.")
        if mp < 1:
            raise TourBusinessRuleError("Số khách tối thiểu (min_pax) phải lớn hơn hoặc bằng 1.")
        update_payload["min_pax"] = mp

    # 4. Cập nhật trạng thái đợt
    if "status" in data and data["status"] is not None:
        st = data["status"]
        valid_statuses = {'OPEN', 'FULL', 'CLOSED', 'DEPARTED', 'COMPLETED', 'CANCELLED'}
        if st not in valid_statuses:
            raise TourBusinessRuleError(f"Trạng thái đợt khởi hành '{st}' không hợp lệ.")
        update_payload["status"] = st

    # 5. Cập nhật số chỗ (BR-D4/E6 và BR-D3)
    sold_seats = tour_repo.get_departure_sold_seats(departure_id)
    cur_seats_total = dep["seats_total"]
    cur_seats_left = dep["seats_left"]

    if "seats_total" in data and data["seats_total"] is not None:
        try:
            new_seats_total = int(data["seats_total"])
        except (ValueError, TypeError):
            raise TourBusinessRuleError("Tổng số chỗ (seats_total) phải là số nguyên.")
        if new_seats_total < 1:
            raise TourBusinessRuleError("Tổng số chỗ (seats_total) phải lớn hơn hoặc bằng 1.")

        # BR-D4 / E6: Không được giảm xuống dưới số chỗ đã bán
        if new_seats_total < sold_seats:
            raise TourBusinessRuleError(
                f"Không thể giảm tổng số chỗ xuống {new_seats_total} vì đợt đã bán {sold_seats} chỗ (BR-D4/E6)."
            )

        update_payload["seats_total"] = new_seats_total

        # Điều chỉnh seats_left nếu không truyền tường minh
        if "seats_left" not in data or data["seats_left"] is None:
            update_payload["seats_left"] = new_seats_total - sold_seats
        else:
            try:
                new_seats_left = int(data["seats_left"])
            except (ValueError, TypeError):
                raise TourBusinessRuleError("Số chỗ còn lại (seats_left) phải là số nguyên.")
            max_seats_left = new_seats_total - sold_seats
            if new_seats_left < 0 or new_seats_left > max_seats_left:
                raise TourBusinessRuleError(
                    f"Số chỗ còn lại ({new_seats_left}) phải từ 0 đến {max_seats_left} "
                    f"vì đợt đang có {sold_seats} chỗ đã bán/giữ (BR-D3/BR-D4)."
                )
            update_payload["seats_left"] = new_seats_left
    elif "seats_left" in data and data["seats_left"] is not None:
        try:
            new_seats_left = int(data["seats_left"])
        except (ValueError, TypeError):
            raise TourBusinessRuleError("Số chỗ còn lại (seats_left) phải là số nguyên.")
        max_seats_left = cur_seats_total - sold_seats
        if new_seats_left < 0 or new_seats_left > max_seats_left:
            raise TourBusinessRuleError(
                f"Số chỗ còn lại ({new_seats_left}) phải từ 0 đến {max_seats_left} "
                f"vì đợt đang có {sold_seats} chỗ đã bán/giữ (BR-D3/BR-D4)."
            )
        update_payload["seats_left"] = new_seats_left

    # Giữ các trường sale nếu có truyền vào (chuẩn bị cho 5.4)
    for k in ("sale_price", "sale_starts_at", "sale_ends_at"):
        if k in data:
            update_payload[k] = data[k]

    updated = tour_repo.update_departure(departure_id, update_payload)
    tour_repo.sync_tour_price_from(dep["tour_id"])

    updated["sold_seats"] = tour_repo.get_departure_sold_seats(departure_id)
    return lam_giau_thong_tin_gia(updated)


def xoa_departure_operator(
    departure_id: int,
    current_user: dict,
    tour_id: Optional[int] = None,
) -> dict:
    """Xoá đợt khởi hành của operator:

    - Nếu đợt chưa có booking nào: xoá cứng khỏi CSDL.
    - Nếu đợt đã có booking (bất kể trạng thái): từ chối 400 (hủy đợt thuộc Phase 6).
    """
    dep = tour_repo.get_departure_by_id(departure_id)
    if not dep:
        raise DepartureNotFoundError(f"Không tìm thấy đợt khởi hành #{departure_id}.")

    if tour_id is not None and dep["tour_id"] != tour_id:
        raise TourBusinessRuleError(f"Đợt khởi hành #{departure_id} không thuộc tour #{tour_id}.")

    tour = tour_repo.get_tour_by_id(dep["tour_id"])
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{dep['tour_id']}.")

    _kiem_tra_quyen_tour(tour, current_user)

    # Kiểm tra đơn đặt tour (Rule 7)
    booking_count = tour_repo.count_departure_bookings(departure_id)
    if booking_count > 0:
        raise TourBusinessRuleError(
            f"Đợt khởi hành #{departure_id} đã có {booking_count} đơn đặt tour (booking), không được xoá. "
            f"Việc hủy đợt đã có khách thuộc quy trình xử lý hoàn tiền của Phase 6."
        )

    tour_repo.delete_departure(departure_id)
    tour_repo.sync_tour_price_from(dep["tour_id"])

    return {
        "success": True,
        "departure_id": departure_id,
        "tour_id": dep["tour_id"],
        "message": f"Đã xoá đợt khởi hành #{departure_id} thành công.",
    }


def dat_gia_sale_departure(
    departure_id: int,
    data: dict,
    current_user: dict,
    tour_id: Optional[int] = None,
) -> dict:
    """Operator đặt hoặc điều chỉnh giá khuyến mãi (sale) cho đợt khởi hành (Phase 5.4, UC-T03).

    Quy tắc nghiệp vụ:
    - BR-O1: Operator sở hữu tour hoặc admin mới được thao tác; operator khác -> 403.
    - BR-SL1 / BR-D7: 0 < sale_price < list_price.
    - Cửa sổ sale: sale_starts_at <= sale_ends_at khi cả hai có giá trị (Rule 2).
    - Đồng bộ price_from của tour theo giá bán hiệu lực thấp nhất (Rule 5).
    """
    dep = tour_repo.get_departure_by_id(departure_id)
    if not dep:
        raise DepartureNotFoundError(f"Không tìm thấy đợt khởi hành #{departure_id}.")

    if tour_id is not None and dep["tour_id"] != tour_id:
        raise TourBusinessRuleError(f"Đợt khởi hành #{departure_id} không thuộc tour #{tour_id}.")

    tour = tour_repo.get_tour_by_id(dep["tour_id"])
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{dep['tour_id']}.")

    _kiem_tra_quyen_tour(tour, current_user)

    # 1. Xác định sale_price
    if "sale_price" in data and data["sale_price"] is not None:
        try:
            sp = int(data["sale_price"])
        except (ValueError, TypeError):
            raise TourBusinessRuleError("Giá khuyến mãi (sale_price) phải là số nguyên.")
    else:
        sp = dep.get("sale_price")
        if sp is None:
            raise TourBusinessRuleError("Chưa có giá khuyến mãi (sale_price). Vui lòng nhập sale_price lớn hơn 0.")

    lp = dep.get("list_price") if dep.get("list_price") is not None else dep.get("price")
    _kiem_tra_sale_hop_le(lp, sp)

    # 2. Xác định và kiểm tra cửa sổ thời gian
    starts = data["sale_starts_at"] if "sale_starts_at" in data else dep.get("sale_starts_at")
    ends = data["sale_ends_at"] if "sale_ends_at" in data else dep.get("sale_ends_at")
    starts, ends = _kiem_tra_cua_so_sale(starts, ends)

    update_payload = {
        "sale_price": sp,
        "sale_starts_at": starts,
        "sale_ends_at": ends,
    }
    updated = tour_repo.update_departure(departure_id, update_payload)
    tour_repo.sync_tour_price_from(dep["tour_id"])

    updated["sold_seats"] = tour_repo.get_departure_sold_seats(departure_id)
    return lam_giau_thong_tin_gia(updated)


def go_gia_sale_departure(
    departure_id: int,
    current_user: dict,
    tour_id: Optional[int] = None,
) -> dict:
    """Operator gỡ giá khuyến mãi của đợt khởi hành (Phase 5.4, UC-T03).

    Quy tắc nghiệp vụ:
    - BR-O1: Operator sở hữu tour hoặc admin mới được thao tác; operator khác -> 403.
    - Xoá sale_price và làm sạch cửa sổ thời gian (sale_starts_at = None, sale_ends_at = None).
    - Đồng bộ lại price_from của tour theo giá bán hiệu lực mới (Rule 5).
    """
    dep = tour_repo.get_departure_by_id(departure_id)
    if not dep:
        raise DepartureNotFoundError(f"Không tìm thấy đợt khởi hành #{departure_id}.")

    if tour_id is not None and dep["tour_id"] != tour_id:
        raise TourBusinessRuleError(f"Đợt khởi hành #{departure_id} không thuộc tour #{tour_id}.")

    tour = tour_repo.get_tour_by_id(dep["tour_id"])
    if not tour:
        raise TourNotFoundError(f"Không tìm thấy tour #{dep['tour_id']}.")

    _kiem_tra_quyen_tour(tour, current_user)

    update_payload = {
        "sale_price": None,
        "sale_starts_at": None,
        "sale_ends_at": None,
    }
    updated = tour_repo.update_departure(departure_id, update_payload)
    tour_repo.sync_tour_price_from(dep["tour_id"])

    updated["sold_seats"] = tour_repo.get_departure_sold_seats(departure_id)
    return lam_giau_thong_tin_gia(updated)

