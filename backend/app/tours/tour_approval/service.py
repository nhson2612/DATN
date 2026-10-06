"""UC-AD02 — duyệt, từ chối và gửi duyệt tour (UC-T01 bước 5 và 6).

Luật áp dụng: BR-T1 (lịch trình phải đúng bằng số ngày của tour), A1 của UC-T01
(thiếu trường bắt buộc thì giữ DRAFT, không cho gửi duyệt), A2 (admin từ chối kèm
lý do để nhà điều hành sửa rồi gửi lại).
"""

from app.tours.tour_approval import repository as repo


class TourApprovalError(Exception):
    """Lỗi nghiệp vụ của luồng duyệt tour, tầng API đổi thành HTTP 400."""


TRANG_THAI_GUI_DUOC = ("DRAFT", "REJECTED")


def _thieu_gi(tour: dict) -> list:
    """Danh sách trường còn thiếu theo UC-T01, dùng cho A1."""
    thieu = []
    if not (tour.get("name") or "").strip():
        thieu.append("tên tour")
    if not (tour.get("summary") or "").strip():
        thieu.append("mô tả ngắn")
    if not (tour.get("description") or "").strip():
        thieu.append("mô tả đầy đủ")
    if not tour.get("province_id"):
        thieu.append("điểm đến chính (tỉnh, thành)")
    if not (tour.get("duration_days") or 0) >= 1:
        thieu.append("số ngày")
    if not (tour.get("departure_location") or "").strip():
        thieu.append("địa điểm khởi hành")
    if not tour.get("transportation"):
        thieu.append("phương tiện di chuyển")
    if not tour.get("tags"):
        thieu.append("tag tour")
    if not (tour.get("cover_url") or "").strip():
        thieu.append("ảnh bìa")
    if not tour.get("cancellation_policy"):
        thieu.append("chính sách hủy")

    lich_trinh = tour.get("itinerary") or []
    so_ngay = int(tour.get("duration_days") or 0)
    if not lich_trinh:
        thieu.append("lịch trình theo ngày")
    elif so_ngay and len(lich_trinh) != so_ngay:
        # BR-T1: nhập 3 ngày mà chỉ mô tả 2 ngày thì không cho gửi duyệt.
        thieu.append(
            f"lịch trình đủ {so_ngay} ngày (đang có {len(lich_trinh)} ngày)"
        )
    else:
        for i, ngay in enumerate(lich_trinh):
            if not (ngay.get("title") or "").strip():
                thieu.append(f"tiêu đề ngày {i + 1}")
    return thieu


def gui_duyet_tour(tour_id: int, current_user: dict) -> dict:
    """Nhà điều hành gửi tour cho admin duyệt: DRAFT/REJECTED -> PENDING_APPROVAL."""
    tour = repo.get_tour(tour_id)
    if not tour:
        raise TourApprovalError(f"Không tìm thấy tour #{tour_id}.")

    if not current_user.get("is_admin"):
        if tour.get("operator_id") != current_user.get("operator_id"):
            raise TourApprovalError("Tour này không thuộc nhà điều hành đang đăng nhập.")

    if tour.get("status") not in TRANG_THAI_GUI_DUOC:
        raise TourApprovalError(
            f"Tour đang ở trạng thái {tour.get('status')}, chỉ gửi duyệt được khi "
            "tour là bản nháp hoặc vừa bị từ chối."
        )

    thieu = _thieu_gi(tour)
    if thieu:
        raise TourApprovalError("Chưa gửi duyệt được, còn thiếu: " + ", ".join(thieu) + ".")

    return repo.doi_trang_thai(tour_id, "PENDING_APPROVAL", False, None)


def danh_sach_cho_duyet() -> list:
    return repo.danh_sach_cho_duyet()


def duyet_tour(tour_id: int) -> dict:
    """Admin duyệt tour: PENDING_APPROVAL -> ACTIVE, và mở bán trên web khách."""
    tour = repo.get_tour(tour_id)
    if not tour:
        raise TourApprovalError(f"Không tìm thấy tour #{tour_id}.")
    if tour.get("status") != "PENDING_APPROVAL":
        raise TourApprovalError(
            f"Tour #{tour_id} đang ở trạng thái {tour.get('status')}, không phải chờ duyệt."
        )
    return repo.doi_trang_thai(tour_id, "ACTIVE", True, None)


def tu_choi_tour(tour_id: int, ly_do: str) -> dict:
    """Admin từ chối tour kèm lý do: PENDING_APPROVAL -> REJECTED (UC-T01/A2)."""
    ly_do = (ly_do or "").strip()
    if not ly_do:
        raise TourApprovalError("Từ chối tour phải ghi lý do để nhà điều hành biết đường sửa.")

    tour = repo.get_tour(tour_id)
    if not tour:
        raise TourApprovalError(f"Không tìm thấy tour #{tour_id}.")
    if tour.get("status") != "PENDING_APPROVAL":
        raise TourApprovalError(
            f"Tour #{tour_id} đang ở trạng thái {tour.get('status')}, không phải chờ duyệt."
        )
    return repo.doi_trang_thai(tour_id, "REJECTED", False, ly_do)
