"""Kiểm thử Phase 2 — Vòng đời booking + hết hạn giữ chỗ.

Bao gồm:
1. Sinh mã đơn tra cứu TX-YYYYMMDD-NNNN an toàn đồng thời (2.2).
2. Máy trạng thái dùng chung chuyen_trang_thai và ma trận chuyển đổi hợp lệ (2.3).
3. Chặn chuyển từ trạng thái terminal đi tiếp (BR-L1).
4. Nhả chỗ nha_cho và cờ seats_released chống trả chỗ 2 lần (2.5, BR-L3, E11).
5. Job nền xu_ly_booking_het_han dọn đơn quá hạn 30 phút (E2) và quá ngày khởi hành (E23) (2.6).
6. API GET /api/tours/bookings/me xem đơn của chính mình (2.7).
"""

import os
import re
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import execute_query, transaction
from app.main import app
from app.repositories import tour_repo
from app.services import tour_service
from app.services.tour_service import (
    ALL_BOOKING_STATUSES,
    PHASE_2_ALLOWED_TRANSITIONS,
    TERMINAL_BOOKING_STATUSES,
    VALID_STATUS_TRANSITIONS,
    BookingNotFoundError,
    InvalidStatusTransitionError,
    TZ_VN,
)


def _db_available():
    try:
        execute_query("SELECT 1 FROM tours LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "Cần CSDL Postgres có bảng tours")


class TestSinhMaDon(unittest.TestCase):
    """Kiểm thử yêu cầu 2.2: Sinh mã đơn tra cứu chuẩn TX-YYYYMMDD-NNNN."""

    def test_dinh_dang_ma_don_chuan(self):
        """Mã đơn phải có dạng TX-YYYYMMDD-NNNN với NNNN tối thiểu 4 chữ số."""
        code = tour_repo.generate_booking_code()
        pattern = r"^TX-\d{8}-\d{4,}$"
        self.assertRegex(code, pattern, f"Mã đơn '{code}' không đúng định dạng chuẩn TX-YYYYMMDD-NNNN")

    def test_sinh_ma_don_theo_ngay_chi_dinh(self):
        """Kiểm tra sinh mã đơn theo ngày cụ thể."""
        target_d = date(2026, 9, 5)
        code = tour_repo.generate_booking_code(target_date=target_d)
        self.assertTrue(code.startswith("TX-20260905-"), f"Mã '{code}' phải bắt đầu bằng TX-20260905-")


class TestMayTrangThaiNghiepVu(unittest.TestCase):
    """Kiểm thử yêu cầu 2.3: Máy trạng thái dùng chung và các ràng buộc BR-L1."""

    def setUp(self):
        self.fake_booking = {
            "id": 999,
            "status": "PENDING_PAYMENT",
            "departure_id": 100,
            "guests": 2,
            "seats_released": False,
        }

    def test_trang_thai_dich_khong_hop_le(self):
        """Trạng thái đích không nằm trong ALL_BOOKING_STATUSES phải bị từ chối ngay."""
        with self.assertRaises(InvalidStatusTransitionError):
            tour_service.chuyen_trang_thai(
                booking_id=999,
                tu="PENDING_PAYMENT",
                sang="TRANG_THAI_BAY_BONG",
                ly_do="Test trạng thái sai",
            )

    @patch("app.repositories.tour_repo.get_booking")
    def test_trang_thai_thuc_te_khong_khop_ky_vong(self, mock_get):
        """Nếu truyền 'tu' mà trạng thái thực tế không khớp -> ném InvalidStatusTransitionError."""
        mock_get.return_value = {**self.fake_booking, "status": "PENDING_PAYMENT"}
        with self.assertRaises(InvalidStatusTransitionError) as ctx:
            tour_service.chuyen_trang_thai(
                booking_id=999,
                tu="CONFIRMED",  # Kỳ vọng CONFIRMED nhưng thực tế là PENDING_PAYMENT
                sang="EXPIRED",
                ly_do="Test lệch trạng thái kỳ vọng",
            )
        self.assertIn("không phải 'CONFIRMED'", str(ctx.exception))

    @patch("app.repositories.tour_repo.get_booking")
    def test_chan_chuyen_tu_terminal_status_br_l1(self, mock_get):
        """BR-L1: Đơn đã ở trạng thái kết thúc (terminal) KHÔNG ĐƯỢC PHÉP chuyển tiếp."""
        for term_status in TERMINAL_BOOKING_STATUSES:
            mock_get.return_value = {**self.fake_booking, "status": term_status}
            # Thử chuyển sang PENDING_PAYMENT hoặc PAID từ terminal
            with self.assertRaises(InvalidStatusTransitionError):
                tour_service.chuyen_trang_thai(
                    booking_id=999,
                    tu=None,
                    sang="PAID",
                    ly_do="Cố chuyển từ terminal",
                )

    @patch("app.repositories.tour_repo.get_booking")
    def test_chan_chuyen_ngoai_pham_vi_phase_hien_tai(self, mock_get):
        """Trạng thái của phase sau chưa được mở (CONFIRMED) phải bị chặn.

        PENDING_PAYMENT -> PAID đã mở từ Phase 3-lite (thanh toán thủ công), nên ca
        này kiểm tra chuyển sang CONFIRMED — chưa có luồng nào hỗ trợ.
        """
        mock_get.return_value = {**self.fake_booking, "status": "PENDING_PAYMENT"}
        with self.assertRaises(InvalidStatusTransitionError) as ctx:
            tour_service.chuyen_trang_thai(
                booking_id=999,
                tu="PENDING_PAYMENT",
                sang="CONFIRMED",
                ly_do="Xác nhận (chưa có luồng hỗ trợ)",
            )
        self.assertIn("Không được phép chuyển trạng thái", str(ctx.exception))

    @patch("app.repositories.tour_repo.add_booking_status_history")
    @patch("app.repositories.tour_repo.update_booking_status")
    @patch("app.services.tour_service.nha_cho")
    @patch("app.repositories.tour_repo.get_booking")
    def test_chuyen_hop_le_pending_sang_expired(self, mock_get, mock_nha_cho, mock_update, mock_hist):
        """PENDING_PAYMENT -> EXPIRED là hợp lệ trong Phase 2 và tự động gọi nha_cho."""
        mock_get.return_value = {**self.fake_booking, "status": "PENDING_PAYMENT"}
        mock_update.return_value = True
        mock_nha_cho.return_value = True
        mock_hist.return_value = 1

        kq = tour_service.chuyen_trang_thai(
            booking_id=999,
            tu="PENDING_PAYMENT",
            sang="EXPIRED",
            ly_do="Quá hạn giữ chỗ 30 phút",
            actor_id=None,
        )
        self.assertEqual(kq["to_status"], "EXPIRED")
        self.assertTrue(kq["seats_released"])
        mock_nha_cho.assert_called_once()
        mock_update.assert_called_once()
        mock_hist.assert_called_once()

    @patch("app.repositories.tour_repo.add_booking_status_history")
    @patch("app.repositories.tour_repo.update_booking_status")
    @patch("app.services.tour_service.nha_cho")
    @patch("app.repositories.tour_repo.get_booking")
    def test_chuyen_hop_le_pending_sang_cancelled_by_operator(self, mock_get, mock_nha_cho, mock_update, mock_hist):
        """PENDING_PAYMENT -> CANCELLED_BY_OPERATOR là hợp lệ và tự động nhả chỗ."""
        mock_get.return_value = {**self.fake_booking, "status": "PENDING_PAYMENT"}
        mock_update.return_value = True
        mock_nha_cho.return_value = True
        mock_hist.return_value = 2

        kq = tour_service.chuyen_trang_thai(
            booking_id=999,
            tu="PENDING_PAYMENT",
            sang="CANCELLED_BY_OPERATOR",
            ly_do="Đến ngày khởi hành nhưng chưa thanh toán",
        )
        self.assertEqual(kq["to_status"], "CANCELLED_BY_OPERATOR")
        self.assertTrue(kq["seats_released"])
        mock_nha_cho.assert_called_once()


class TestNhaChoChongTraHaiLan(unittest.TestCase):
    """Kiểm thử yêu cầu 2.5: Hàm nha_cho chống trả chỗ hai lần (BR-L3, E11)."""

    @patch("app.repositories.tour_repo.release_booking_seats")
    def test_nha_cho_lan_dau_thanh_cong(self, mock_release):
        """Lần đầu gọi nha_cho -> trả True."""
        mock_release.return_value = {"released": True, "departure_id": 1, "seats": 2}
        kq = tour_service.nha_cho(123)
        self.assertTrue(kq)

    @patch("app.repositories.tour_repo.release_booking_seats")
    def test_nha_cho_lan_hai_bi_chan_khong_tra_them(self, mock_release):
        """Lần hai gọi nha_cho -> cờ seats_released chặn, trả False."""
        mock_release.return_value = {"released": False, "reason": "already_released_or_not_found"}
        kq = tour_service.nha_cho(123)
        self.assertFalse(kq)


class TestJobDonDonHetHan(unittest.TestCase):
    """Kiểm thử yêu cầu 2.6: Job nền quét dọn đơn hết hạn (E2, E23)."""

    @patch("app.services.tour_service.chuyen_trang_thai")
    @patch("app.repositories.tour_repo.find_pending_bookings_past_depart_date")
    @patch("app.repositories.tour_repo.find_expired_bookings")
    def test_xu_ly_booking_het_han_chay_dung_nghiep_vu(self, mock_expired, mock_past, mock_chuyen):
        """Quá hạn 30 phút -> EXPIRED; Quá ngày khởi hành -> CANCELLED_BY_OPERATOR."""
        mock_expired.return_value = [{"id": 101}, {"id": 102}]
        mock_past.return_value = [{"id": 103}]

        kq = tour_service.xu_ly_booking_het_han()
        self.assertEqual(kq["expired_count"], 2)
        self.assertEqual(kq["cancelled_count"], 1)
        self.assertEqual(kq["total_processed"], 3)
        self.assertEqual(len(kq["errors"]), 0)

        # Kiểm tra chuyen_trang_thai được gọi đúng 3 lần
        self.assertEqual(mock_chuyen.call_count, 3)


@requires_db
class TestIntegrationPhase2DB(unittest.TestCase):
    """Kiểm thử tích hợp trên DB thật: tạo tour, đặt đơn, nhả chỗ, kiểm tra số chỗ."""

    def setUp(self):
        self.client = TestClient(app)
        self.slug = "tour-test-phase2-lifecycle"

        # Dọn dẹp trước nếu có dữ liệu cũ từ lần chạy trước
        old_tours = execute_query("SELECT id FROM tours WHERE slug = %s", (self.slug,))
        for ot in (old_tours or []):
            if tour_repo._has_table("booking_status_history"):
                execute_query("DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)", (ot["id"],))
            execute_query("DELETE FROM tour_bookings WHERE tour_id = %s", (ot["id"],))
            execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (ot["id"],))
            execute_query("DELETE FROM tours WHERE id = %s", (ot["id"],))

        self.tour_id = tour_repo.create_tour({
            "slug": self.slug,
            "name": "Tour Test Phase 2 Lifecycle",
            "summary": "Tour kiểm thử vòng đời booking",
            "duration_days": 3,
            "price_from": 2_000_000,
        })
        self.depart_date = date.today() + timedelta(days=20)
        tour_repo.add_departure(
            tour_id=self.tour_id,
            depart_date=self.depart_date,
            list_price=2_000_000,
            seats=15,
        )
        deps = tour_repo.departures(self.tour_id)
        self.assertTrue(deps)
        self.departure_id = deps[0]["id"]
        # Đảm bảo reset seats_left về 15
        execute_query("UPDATE tour_departures SET seats_left = 15, seats_total = 15 WHERE id = %s", (self.departure_id,))

    def tearDown(self):
        if tour_repo._has_table("booking_status_history"):
            execute_query("DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)", (self.tour_id,))
        execute_query("DELETE FROM tour_bookings WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tours WHERE id = %s", (self.tour_id,))

    def _get_seats_left(self):
        rows = execute_query(
            "SELECT seats_left FROM tour_departures WHERE id = %s",
            (self.departure_id,),
        )
        return rows[0]["seats_left"] if rows else -1

    def test_flow_dat_tour_va_nha_cho_nguyen_tu(self):
        """Đặt tour trừ 3 chỗ -> còn 12 chỗ -> nhả chỗ lần 1 -> 15 chỗ -> nhả chỗ lần 2 -> vẫn 15 chỗ."""
        ban_dau = self._get_seats_left()
        self.assertEqual(ban_dau, 15)

        # 1. Đặt tour 3 khách
        kq = tour_service.book({
            "tour_id": self.tour_id,
            "departure_id": self.departure_id,
            "full_name": "Khách Test Phase 2",
            "phone": "0988776655",
            "guests": 3,
        })
        booking_id = kq["id"]
        self.assertIsNotNone(booking_id)
        self.assertTrue(kq["code"].startswith("TX-"))

        # seats_left phải bị trừ từ 15 xuống 12
        self.assertEqual(self._get_seats_left(), 12)

        # 2. Chuyển trạng thái sang EXPIRED -> phải tự động nhả chỗ về 15
        tour_service.chuyen_trang_thai(
            booking_id=booking_id,
            tu="PENDING_PAYMENT",
            sang="EXPIRED",
            ly_do="Hết hạn giữ chỗ trong test tích hợp",
        )
        self.assertEqual(self._get_seats_left(), 15)

        # 3. Thử gọi nha_cho lần 2 trên cùng booking_id -> seats_left KHÔNG ĐƯỢC tăng lên 18
        tour_service.nha_cho(booking_id)
        self.assertEqual(self._get_seats_left(), 15, "Lỗi E11: seats_left bị tăng lặp lại khi gọi nhả chỗ lần hai!")

    def test_api_bookings_me_yeu_cau_dang_nhap(self):
        """GET /api/tours/bookings/me khi chưa đăng nhập phải trả 401."""
        r = self.client.get("/api/tours/bookings/me")
        self.assertEqual(r.status_code, 401)

    def test_api_bookings_me_tra_dung_don_cua_user(self):
        """GET /api/tours/bookings/me trả danh sách đơn của user đã đăng nhập."""
        # Đăng nhập bằng user seed
        login_res = self.client.post("/api/auth/login", json={
            "email": settings.seed_user_email,
            "password": settings.seed_user_password,
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Lấy thông tin user id
        user_rows = execute_query("SELECT id FROM users WHERE email = %s", (settings.seed_user_email,))
        self.assertTrue(user_rows)
        uid = user_rows[0]["id"]

        # Tạo một booking gán với user này
        kq = tour_service.book({
            "tour_id": self.tour_id,
            "departure_id": self.departure_id,
            "full_name": "Người Dùng Đăng Nhập",
            "phone": "0911223344",
            "guests": 2,
        }, user_id=uid)

        # Gọi API xem danh sách đơn
        r = self.client.get("/api/tours/bookings/me", headers=headers)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        my_ids = [b["id"] for b in data["bookings"]]
        self.assertIn(kq["id"], my_ids, "API /bookings/me phải chứa id của đơn vừa tạo của user")

        my_booking = next(b for b in data["bookings"] if b["id"] == kq["id"])
        self.assertTrue(my_booking.get("code"), "Đơn phải có mã code")
        self.assertEqual(my_booking["guests"], 2)
        self.assertEqual(my_booking["tour_name"], "Tour Test Phase 2 Lifecycle")


if __name__ == "__main__":
    unittest.main()
