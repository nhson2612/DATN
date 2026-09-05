"""Kiểm thử Phase 3-lite — Thanh toán thủ công (chuyển khoản + admin xác nhận).

Bao gồm:
1. Sinh mã giao dịch chuẩn PM-YYYYMMDD-NNNN an toàn đồng thời (3.2).
2. Tạo payment PENDING, tự động gán amount = total_price của booking (3.2).
3. Confirm đúng tiền -> payment SUCCESS + booking PAID + ghi history (3.3, BR-P1).
4. Confirm khi đơn đã EXPIRED / quá hạn -> payment FAILED, không trả chỗ hai lần (3.3, E3, E11).
5. Confirm sai tiền -> payment MISMATCH, booking giữ nguyên PENDING_PAYMENT (3.3).
6. Confirm lần hai -> Idempotent, không có payment SUCCESS thứ hai (3.3).
7. Ràng buộc BR-P1: Mỗi booking tối đa một SUCCESS (partial unique index / nghiệp vụ).
8. Phân quyền API: chỉ admin được duyệt và xem danh sách payment (3.4).
9. Dọn dẹp an toàn trong tearDown (kiểm tra _has_table trước khi xoá).
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
    ALLOWED_STATUS_TRANSITIONS,
    PHASE_3_ALLOWED_TRANSITIONS,
    TERMINAL_BOOKING_STATUSES,
    BookingNotFoundError,
    InvalidStatusTransitionError,
    PaymentInvalidError,
    PaymentNotFoundError,
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
requires_payments_table = unittest.skipUnless(
    HAS_DB and tour_repo._has_table("payments"),
    "Cần bảng payments trong CSDL để chạy integration test Phase 3",
)


class TestSinhMaPaymentTxnRef(unittest.TestCase):
    """Kiểm thử yêu cầu 3.2: Sinh mã giao dịch chuẩn PM-YYYYMMDD-NNNN."""

    def test_dinh_dang_ma_txn_ref_chuan(self):
        """Mã giao dịch phải có dạng PM-YYYYMMDD-NNNN với NNNN tối thiểu 4 chữ số."""
        ref = tour_repo.generate_payment_txn_ref()
        pattern = r"^PM-\d{8}-\d{4,}$"
        self.assertRegex(ref, pattern, f"Mã giao dịch '{ref}' không đúng định dạng chuẩn PM-YYYYMMDD-NNNN")

    def test_sinh_ma_theo_ngay_chi_dinh(self):
        """Mã giao dịch sinh theo ngày cụ thể."""
        target_d = date(2026, 9, 5)
        ref = tour_repo.generate_payment_txn_ref(target_date=target_d)
        self.assertTrue(ref.startswith("PM-20260905-"), f"Mã '{ref}' phải bắt đầu bằng PM-20260905-")


class TestTaoPaymentService(unittest.TestCase):
    """Kiểm thử yêu cầu 3.2: Service tao_thanh_toan."""

    def setUp(self):
        self.fake_booking = {
            "id": 100,
            "code": "TX-20260905-0001",
            "status": "PENDING_PAYMENT",
            "total_price": 5_000_000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=25),
        }

    @patch("app.repositories.tour_repo.create_payment")
    @patch("app.repositories.tour_repo.generate_payment_txn_ref")
    @patch("app.repositories.tour_repo.get_booking")
    def test_tao_payment_pending_mac_dinh_amount(self, mock_get_b, mock_gen_ref, mock_create_p):
        """Tạo payment khi không truyền amount -> lấy mặc định total_price, trạng thái PENDING."""
        mock_get_b.return_value = self.fake_booking
        mock_gen_ref.return_value = "PM-20260905-0001"
        mock_create_p.return_value = 1

        kq = tour_service.tao_thanh_toan(
            booking_id=100,
            method="CHUYEN_KHOAN",
            amount=None,
            note="Khách chuyển khoản VCB",
            actor_id=10,
        )

        self.assertEqual(kq["status"], "PENDING")
        self.assertEqual(kq["amount"], 5_000_000)
        self.assertEqual(kq["txn_ref"], "PM-20260905-0001")
        mock_create_p.assert_called_once()

    @patch("app.repositories.tour_repo.get_booking")
    def test_tao_payment_chan_khi_booking_khong_phai_pending(self, mock_get_b):
        """Booking đã ở trạng thái khác PENDING_PAYMENT (ví dụ EXPIRED) -> từ chối tạo payment."""
        mock_get_b.return_value = {**self.fake_booking, "status": "EXPIRED"}

        with self.assertRaises(PaymentInvalidError) as ctx:
            tour_service.tao_thanh_toan(booking_id=100)
        self.assertIn("EXPIRED", str(ctx.exception))

    @patch("app.repositories.tour_repo.get_booking")
    def test_tao_payment_chan_khi_qua_han_hold_expires_at(self, mock_get_b):
        """Booking đã quá hạn hold_expires_at -> từ chối tạo thanh toán (E3: không tự khôi phục chỗ)."""
        expired_hold = datetime.now(TZ_VN) - timedelta(minutes=5)
        mock_get_b.return_value = {**self.fake_booking, "hold_expires_at": expired_hold}

        with self.assertRaises(PaymentInvalidError) as ctx:
            tour_service.tao_thanh_toan(booking_id=100)
        self.assertIn("hết hạn giữ chỗ", str(ctx.exception))

    @patch("app.repositories.tour_repo.create_payment")
    @patch("app.repositories.tour_repo.generate_payment_txn_ref")
    @patch("app.repositories.tour_repo.get_booking")
    def test_tao_payment_sai_tien_danh_dau_mismatch(self, mock_get_b, mock_gen_ref, mock_create_p):
        """Truyền amount khác total_price -> tạo payment trạng thái MISMATCH."""
        mock_get_b.return_value = self.fake_booking
        mock_gen_ref.return_value = "PM-20260905-0002"
        mock_create_p.return_value = 2

        kq = tour_service.tao_thanh_toan(
            booking_id=100,
            amount=4_000_000,  # Sai lệch: tổng đơn là 5tr nhưng chỉ chuyển 4tr
        )
        self.assertEqual(kq["status"], "MISMATCH")
        self.assertEqual(kq["amount"], 4_000_000)


class TestXacNhanPaymentService(unittest.TestCase):
    """Kiểm thử yêu cầu 3.3: Service xac_nhan_thanh_toan của Admin."""

    def setUp(self):
        self.fake_payment = {
            "id": 50,
            "booking_id": 100,
            "method": "CHUYEN_KHOAN",
            "amount": 5_000_000,
            "status": "PENDING",
            "txn_ref": "PM-20260905-0001",
        }
        self.fake_booking = {
            "id": 100,
            "status": "PENDING_PAYMENT",
            "total_price": 5_000_000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=20),
            "departure_id": 1,
            "guests": 2,
            "seats_released": False,
        }

    @patch("app.services.tour_service.chuyen_trang_thai")
    @patch("app.repositories.tour_repo.update_payment_status")
    @patch("app.repositories.tour_repo.count_successful_payments")
    @patch("app.repositories.tour_repo.get_booking")
    @patch("app.repositories.tour_repo.get_payment")
    def test_confirm_dung_tien_success_va_booking_paid(
        self, mock_get_p, mock_get_b, mock_count, mock_upd_p, mock_chuyen
    ):
        """Confirm đúng tiền -> payment SUCCESS, booking PAID, gọi chuyen_trang_thai."""
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = self.fake_booking
        mock_count.return_value = 0
        mock_upd_p.return_value = True

        kq = tour_service.xac_nhan_thanh_toan(payment_id=50, actor_id=1, note="Đã nhận đủ tiền VCB")

        self.assertTrue(kq["success"])
        self.assertEqual(kq["status"], "SUCCESS")
        self.assertEqual(kq["booking_status"], "PAID")

        # Kiểm tra cập nhật trạng thái payment SUCCESS
        mock_upd_p.assert_called_once()
        # Kiểm tra chuyển trạng thái booking sang PAID bằng máy trạng thái
        mock_chuyen.assert_called_once()
        args, kwargs = mock_chuyen.call_args
        self.assertEqual(kwargs.get("tu"), "PENDING_PAYMENT")
        self.assertEqual(kwargs.get("sang"), "PAID")

    @patch("app.repositories.tour_repo.update_payment_status")
    @patch("app.repositories.tour_repo.get_booking")
    @patch("app.repositories.tour_repo.get_payment")
    def test_confirm_khi_don_da_expired_payment_failed(self, mock_get_p, mock_get_b, mock_upd_p):
        """Khi booking đã EXPIRED -> payment bị FAILED, không tự chuyển booking, chỗ không bị trả lặp lại."""
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = {**self.fake_booking, "status": "EXPIRED"}
        mock_upd_p.return_value = True

        kq = tour_service.xac_nhan_thanh_toan(payment_id=50, actor_id=1)

        self.assertFalse(kq["success"])
        self.assertEqual(kq["status"], "FAILED")
        self.assertEqual(kq["booking_status"], "EXPIRED")
        self.assertIn("FAILED", kq["message"])

        # Kiểm tra update payment FAILED
        mock_upd_p.assert_called_once()
        args, kwargs = mock_upd_p.call_args
        self.assertEqual(kwargs.get("status"), "FAILED")

    @patch("app.repositories.tour_repo.update_payment_status")
    @patch("app.repositories.tour_repo.count_successful_payments")
    @patch("app.repositories.tour_repo.get_booking")
    @patch("app.repositories.tour_repo.get_payment")
    def test_confirm_sai_tien_mismatch(self, mock_get_p, mock_get_b, mock_count, mock_upd_p):
        """Số tiền thanh toán lệch tổng đơn -> payment chuyển sang MISMATCH, booking giữ PENDING_PAYMENT."""
        mock_get_p.return_value = {**self.fake_payment, "amount": 3_000_000}
        mock_get_b.return_value = self.fake_booking  # total_price = 5_000_000
        mock_count.return_value = 0
        mock_upd_p.return_value = True

        kq = tour_service.xac_nhan_thanh_toan(payment_id=50, actor_id=1)

        self.assertFalse(kq["success"])
        self.assertEqual(kq["status"], "MISMATCH")
        self.assertEqual(kq["booking_status"], "PENDING_PAYMENT")
        mock_upd_p.assert_called_once()
        args, kwargs = mock_upd_p.call_args
        self.assertEqual(kwargs.get("status"), "MISMATCH")

    @patch("app.services.tour_service.chuyen_trang_thai")
    @patch("app.repositories.tour_repo.get_payment")
    def test_confirm_idempotent_lan_hai(self, mock_get_p, mock_chuyen):
        """Xác nhận lần 2 trên payment đã SUCCESS -> trả về kết quả hiện tại, không gọi lại chuyển trạng thái."""
        mock_get_p.return_value = {
            **self.fake_payment,
            "status": "SUCCESS",
            "booking_status": "PAID",
        }

        kq = tour_service.xac_nhan_thanh_toan(payment_id=50, actor_id=1)

        self.assertTrue(kq["success"])
        self.assertTrue(kq.get("idempotent"))
        self.assertEqual(kq["status"], "SUCCESS")
        # Không được gọi lại máy trạng thái chuyen_trang_thai
        mock_chuyen.assert_not_called()

    @patch("app.repositories.tour_repo.count_successful_payments")
    @patch("app.repositories.tour_repo.get_booking")
    @patch("app.repositories.tour_repo.get_payment")
    def test_rang_buoc_moi_booking_toi_da_mot_success_br_p1(self, mock_get_p, mock_get_b, mock_count):
        """BR-P1: Nếu booking đã có 1 payment SUCCESS thì không cho confirm SUCCESS giao dịch thứ hai."""
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = self.fake_booking
        mock_count.return_value = 1  # Đã có 1 giao dịch SUCCESS

        with self.assertRaises(PaymentInvalidError) as ctx:
            tour_service.xac_nhan_thanh_toan(payment_id=50, actor_id=1)
        self.assertIn("BR-P1", str(ctx.exception))


class TestApiThanhToan(unittest.TestCase):
    """Kiểm thử yêu cầu 3.4: Các API endpoints thanh toán và bảo vệ quyền hạn."""

    def setUp(self):
        self.client = TestClient(app)

    def test_admin_payments_yeu_cau_quyen_admin(self):
        """GET /api/tours/admin/payments khi chưa đăng nhập -> 401."""
        r = self.client.get("/api/tours/admin/payments")
        self.assertEqual(r.status_code, 401)

    def test_confirm_payment_yeu_cau_quyen_admin(self):
        """POST /api/tours/admin/payments/1/confirm khi chưa đăng nhập -> 401."""
        r = self.client.post("/api/tours/admin/payments/1/confirm")
        self.assertEqual(r.status_code, 401)

    @patch("app.core.security.execute_query")
    def test_user_thuong_khong_the_truy_cap_admin_payments(self, mock_sql):
        """User thường (role='customer') gọi admin endpoint -> 403 Forbidden."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": "customer@test.vn"})
        mock_sql.return_value = [{"id": 2, "email": "customer@test.vn", "role": "customer", "full_name": "Khách"}]
        r = self.client.get(
            "/api/tours/admin/payments",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(r.status_code, 403)

    @patch("app.core.security.execute_query")
    @patch("app.repositories.tour_repo.list_payments")
    def test_admin_truy_cap_admin_payments_thanh_cong(self, mock_list_p, mock_sql):
        """Admin (role='admin') gọi GET /api/tours/admin/payments -> 200 OK."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": "admin@test.vn"})
        mock_sql.return_value = [{"id": 1, "email": "admin@test.vn", "role": "admin", "full_name": "Quản Trị Viên"}]
        mock_list_p.return_value = [
            {"id": 1, "booking_id": 10, "booking_code": "TX-01", "tour_name": "Tour", "amount": 1000, "status": "PENDING"}
        ]
        r = self.client.get(
            "/api/tours/admin/payments",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["success"])

    @patch("app.core.security.execute_query")
    @patch("app.services.tour_service.xac_nhan_thanh_toan")
    def test_admin_confirm_payment_qua_api(self, mock_xac_nhan, mock_sql):
        """Admin gọi POST /api/tours/admin/payments/{id}/confirm -> 200 OK."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": "admin@test.vn"})
        mock_sql.return_value = [{"id": 1, "email": "admin@test.vn", "role": "admin", "full_name": "Quản Trị Viên"}]
        mock_xac_nhan.return_value = {
            "success": True,
            "payment_id": 1,
            "status": "SUCCESS",
            "booking_id": 10,
            "booking_status": "PAID",
        }
        r = self.client.post(
            "/api/tours/admin/payments/1/confirm",
            headers={"Authorization": f"Bearer {token}"},
            json={"note": "Xác nhận sao kê khớp"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["success"])


@requires_payments_table
class TestIntegrationPhase3DB(unittest.TestCase):
    """Kiểm thử tích hợp trên DB thật khi đã chạy migration 003_phase3_manual_payments.sql."""

    def setUp(self):
        self.client = TestClient(app)
        self.slug = "tour-test-phase3-manual-payments"

        # Dọn dẹp dữ liệu cũ trước khi chạy
        old_tours = execute_query("SELECT id FROM tours WHERE slug = %s", (self.slug,))
        for ot in (old_tours or []):
            if tour_repo._has_table("payments"):
                execute_query(
                    "DELETE FROM payments WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)",
                    (ot["id"],),
                )
            if tour_repo._has_table("booking_status_history"):
                execute_query(
                    "DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)",
                    (ot["id"],),
                )
            execute_query("DELETE FROM tour_bookings WHERE tour_id = %s", (ot["id"],))
            execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (ot["id"],))
            execute_query("DELETE FROM tours WHERE id = %s", (ot["id"],))

        self.tour_id = tour_repo.create_tour({
            "slug": self.slug,
            "name": "Tour Test Phase 3 Payments",
            "duration_days": 2,
            "price_from": 3_000_000,
        })
        self.depart_date = date.today() + timedelta(days=15)
        tour_repo.add_departure(
            tour_id=self.tour_id,
            depart_date=self.depart_date,
            list_price=3_000_000,
            seats=10,
        )
        deps = tour_repo.departures(self.tour_id)
        self.departure_id = deps[0]["id"]

    def tearDown(self):
        if tour_repo._has_table("payments"):
            execute_query(
                "DELETE FROM payments WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)",
                (self.tour_id,),
            )
        if tour_repo._has_table("booking_status_history"):
            execute_query(
                "DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = %s)",
                (self.tour_id,),
            )
        execute_query("DELETE FROM tour_bookings WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tours WHERE id = %s", (self.tour_id,))

    def test_flow_toan_ven_dat_tour_tao_payment_va_admin_confirm(self):
        """Đặt tour -> Tạo payment PENDING -> Admin confirm -> Payment SUCCESS + Booking PAID."""
        # 1. Đặt tour
        b_res = tour_service.book({
            "tour_id": self.tour_id,
            "departure_id": self.departure_id,
            "full_name": "Người Đặt Tour Phase 3",
            "phone": "0912345678",
            "guests": 2,
        })
        booking_id = b_res["id"]
        total_price = b_res["total_price"]
        self.assertEqual(total_price, 6_000_000)

        # 2. Tạo payment PENDING
        p_res = tour_service.tao_thanh_toan(
            booking_id=booking_id,
            method="CHUYEN_KHOAN",
            amount=total_price,
            note="Khách chuyển qua ngân hàng",
        )
        payment_id = p_res["id"]
        self.assertEqual(p_res["status"], "PENDING")
        self.assertTrue(p_res["txn_ref"].startswith("PM-"))

        # 3. Admin xác nhận nhận đủ tiền
        admin_res = tour_service.xac_nhan_thanh_toan(
            payment_id=payment_id,
            actor_id=1,
            note="Đã kiểm tra sao kê khớp 6.000.000 VND",
        )
        self.assertTrue(admin_res["success"])
        self.assertEqual(admin_res["status"], "SUCCESS")
        self.assertEqual(admin_res["booking_status"], "PAID")

        # Kiểm tra booking trong DB đã chuyển sang PAID
        b_after = tour_repo.get_booking(booking_id)
        self.assertEqual(b_after["status"], "PAID")

        # Kiểm tra history có bản ghi chuyển sang PAID
        hist = tour_repo.get_booking_status_history(booking_id)
        to_statuses = [h["to_status"] for h in hist]
        self.assertIn("PAID", to_statuses)


if __name__ == "__main__":
    unittest.main()
