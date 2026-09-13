"""Kiểm thử Phase 3 — Stripe-hosted Checkout (Backend).

Bao gồm các kịch bản bắt buộc theo spec:
1. tao_checkout_stripe thiếu STRIPE_SECRET_KEY -> PaymentGatewayUnavailableError, payment FAILED.
2. tao_checkout_stripe gọi stripe.checkout.Session.create với currency='vnd', unit_amount == total_price (không nhân 100).
3. Booking không PENDING_PAYMENT hoặc quá hạn hold_expires_at -> chặn với PaymentInvalidError.
4. Webhook chữ ký sai -> PaymentInvalidError (400 qua API).
5. Webhook event không phải checkout.session.completed -> bỏ qua, không đổi trạng thái.
6. Webhook hợp lệ -> payment SUCCESS + booking PENDING_PAYMENT -> PAID trong một transaction.
7. Webhook trùng (payment đã SUCCESS) -> idempotent, trả nguyên trạng.
8. Webhook khi booking EXPIRED / quá hạn -> payment SUCCESS với needs_refund=True, booking KHÔNG thành PAID (A6/E3).
9. Sai tiền -> payment MISMATCH, booking giữ PENDING_PAYMENT.
10. lay_trang_thai_thanh_toan an toàn, không lộ secret.
11. Job xu_ly_booking_het_han expire các session Stripe còn mở.
12. API endpoints: POST /checkout, GET /status, POST /stripe/webhook.
"""

import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

# Giả lập module stripe nếu môi trường chưa cài đặt gói stripe
if "stripe" not in sys.modules:
    mock_stripe = MagicMock()

    class MockSignatureVerificationError(Exception):
        pass

    mock_stripe.error = MagicMock()
    mock_stripe.error.SignatureVerificationError = MockSignatureVerificationError
    sys.modules["stripe"] = mock_stripe

from fastapi.testclient import TestClient

from app.core.config import reload_settings, settings
from app.main import app
from app.tours.search_tours import repository as tour_repo
from app.tours.search_tours import service as tour_service
from app.tours.search_tours.service import (
    BookingNotFoundError,
    PaymentGatewayUnavailableError,
    PaymentInvalidError,
    TZ_VN,
)


class TestTaoCheckoutStripeService(unittest.TestCase):
    """Kiểm thử yêu cầu 1, 2, 3: Service tao_checkout_stripe."""

    def setUp(self):
        self.fake_booking = {
            "id": 100,
            "code": "TX-20260907-0001",
            "status": "PENDING_PAYMENT",
            "total_price": 5_000_000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=25),
        }

    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.create_payment")
    @patch("app.tours.search_tours.repository.generate_payment_txn_ref")
    @patch("app.tours.search_tours.repository.get_booking")
    def test_1_thieu_stripe_secret_key_nem_unavailable_va_payment_failed(
        self, mock_get_b, mock_gen_ref, mock_create_p, mock_upd_p
    ):
        """1. tao_checkout_stripe thiếu STRIPE_SECRET_KEY -> PaymentGatewayUnavailableError, payment bị FAILED."""
        mock_get_b.return_value = self.fake_booking
        mock_gen_ref.return_value = "PM-20260907-0001"
        mock_create_p.return_value = 1

        with patch.object(settings, "stripe_secret_key", None):
            with self.assertRaises(PaymentGatewayUnavailableError) as ctx:
                tour_service.tao_checkout_stripe(booking_id=100)

            self.assertIn("Chưa cấu hình STRIPE_SECRET_KEY", str(ctx.exception))
            # Kiểm tra payment bị đánh dấu FAILED kèm note
            mock_upd_p.assert_called_once()
            args, kwargs = mock_upd_p.call_args
            self.assertEqual(kwargs.get("payment_id"), 1)
            self.assertEqual(kwargs.get("status"), "FAILED")
            self.assertIn("STRIPE_SECRET_KEY", kwargs.get("note", ""))

    @patch("app.tours.search_tours.repository.set_payment_stripe_refs")
    @patch("stripe.checkout.Session.create")
    @patch("app.tours.search_tours.repository.create_payment")
    @patch("app.tours.search_tours.repository.generate_payment_txn_ref")
    @patch("app.tours.search_tours.repository.get_booking")
    def test_2_tao_checkout_stripe_goi_session_create_vnd_khong_nhan_100(
        self, mock_get_b, mock_gen_ref, mock_create_p, mock_stripe_create, mock_set_refs
    ):
        """2. tao_checkout_stripe gọi stripe.checkout.Session.create với currency='vnd',

        unit_amount == total_price (zero-decimal, KHÔNG nhân 100), trả checkout_url, lưu session id.
        """
        mock_get_b.return_value = self.fake_booking
        mock_gen_ref.return_value = "PM-20260907-0002"
        mock_create_p.return_value = 2

        # Mock Stripe Checkout Session object trả về
        mock_session = MagicMock()
        mock_session.id = "cs_test_session_123"
        mock_session.url = "https://checkout.stripe.com/c/pay/cs_test_session_123"
        mock_session.to_dict.return_value = {
            "id": "cs_test_session_123",
            "url": "https://checkout.stripe.com/c/pay/cs_test_session_123",
        }
        mock_stripe_create.return_value = mock_session

        with patch.object(settings, "stripe_secret_key", "sk_test_fake_key_123"):
            res = tour_service.tao_checkout_stripe(
                booking_id=100,
                actor_id=5,
                redirect_base="http://localhost:5173",
            )

        self.assertTrue(res["success"])
        self.assertEqual(res["payment_id"], 2)
        self.assertEqual(res["amount"], 5_000_000)
        self.assertEqual(res["stripe_session_id"], "cs_test_session_123")
        self.assertEqual(res["checkout_url"], "https://checkout.stripe.com/c/pay/cs_test_session_123")

        # Kiểm tra tham số truyền vào stripe.checkout.Session.create
        mock_stripe_create.assert_called_once()
        call_kwargs = mock_stripe_create.call_args[1]
        self.assertEqual(call_kwargs["mode"], "payment")
        self.assertEqual(call_kwargs["currency"], "vnd")
        self.assertEqual(call_kwargs["client_reference_id"], "100")
        self.assertEqual(
            call_kwargs["metadata"],
            {"booking_id": "100", "txn_ref": "PM-20260907-0002", "payment_id": "2"},
        )
        self.assertIn("{CHECKOUT_SESSION_ID}", call_kwargs["success_url"])
        self.assertIn("booking_id=100", call_kwargs["success_url"])

        # Quan trọng: VND là zero-decimal, unit_amount phải bằng đúng 5_000_000 (KHÔNG PHẢI 500_000_000)
        line_items = call_kwargs["line_items"]
        self.assertEqual(len(line_items), 1)
        price_data = line_items[0]["price_data"]
        self.assertEqual(price_data["currency"], "vnd")
        self.assertEqual(price_data["unit_amount"], 5_000_000)

        # Kiểm tra lưu refs Stripe vào CSDL
        mock_set_refs.assert_called_once()
        refs_kwargs = mock_set_refs.call_args[1]
        self.assertEqual(refs_kwargs["payment_id"], 2)
        self.assertEqual(refs_kwargs["stripe_session_id"], "cs_test_session_123")

    @patch("app.tours.search_tours.repository.get_booking")
    def test_3_booking_khong_phai_pending_bi_chan(self, mock_get_b):
        """3. Booking không ở trạng thái PENDING_PAYMENT -> chặn với PaymentInvalidError."""
        mock_get_b.return_value = {**self.fake_booking, "status": "CONFIRMED"}

        with self.assertRaises(PaymentInvalidError) as ctx:
            tour_service.tao_checkout_stripe(booking_id=100)

        self.assertIn("CONFIRMED", str(ctx.exception))

    @patch("app.tours.search_tours.repository.get_booking")
    def test_3b_booking_qua_han_hold_expires_at_bi_chan(self, mock_get_b):
        """3. Booking đã quá hạn hold_expires_at -> chặn với PaymentInvalidError (E3)."""
        expired_hold = datetime.now(TZ_VN) - timedelta(minutes=10)
        mock_get_b.return_value = {**self.fake_booking, "hold_expires_at": expired_hold}

        with self.assertRaises(PaymentInvalidError) as ctx:
            tour_service.tao_checkout_stripe(booking_id=100)

        self.assertIn("hết hạn giữ chỗ", str(ctx.exception))

    @patch("app.tours.search_tours.repository.get_booking")
    def test_3c_booking_khong_ton_tai(self, mock_get_b):
        """Booking không tồn tại -> ném BookingNotFoundError."""
        mock_get_b.return_value = None

        with self.assertRaises(BookingNotFoundError):
            tour_service.tao_checkout_stripe(booking_id=9999)


class TestStripeWebhookService(unittest.TestCase):
    """Kiểm thử yêu cầu 4, 5, 6, 7, 8, 9: Service xu_ly_stripe_webhook."""

    def setUp(self):
        self.fake_session_id = "cs_test_completed_123"
        self.fake_payload = b'{"id": "evt_test"}'
        self.fake_sig = "t=123456,v1=fake_signature"

        self.fake_session_obj = {
            "id": self.fake_session_id,
            "client_reference_id": "100",
            "metadata": {"booking_id": "100", "payment_id": "10"},
            "amount_total": 5_000_000,
            "payment_intent": "pi_test_123",
        }

        self.fake_payment = {
            "id": 10,
            "booking_id": 100,
            "method": "STRIPE",
            "amount": 5_000_000,
            "status": "PENDING",
            "stripe_session_id": self.fake_session_id,
        }

        self.fake_booking = {
            "id": 100,
            "status": "PENDING_PAYMENT",
            "total_price": 5_000_000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=20),
        }

    @patch("stripe.Webhook.construct_event")
    def test_4_webhook_chu_ky_sai_nem_payment_invalid_error(self, mock_construct):
        """4. Webhook chữ ký sai -> ném PaymentInvalidError."""
        mock_construct.side_effect = Exception("Chữ ký không khớp")

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            with self.assertRaises(PaymentInvalidError) as ctx:
                tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

            self.assertIn("Chữ ký webhook Stripe không hợp lệ", str(ctx.exception))

    @patch("stripe.Webhook.construct_event")
    def test_5_webhook_event_khong_phai_checkout_completed_bo_qua(self, mock_construct):
        """5. Webhook event không phải checkout.session.completed -> bỏ qua, không đổi trạng thái."""
        mock_construct.return_value = {
            "type": "payment_intent.succeeded",
            "data": {"object": {}},
        }

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertTrue(res["received"])
        self.assertFalse(res["handled"])
        self.assertEqual(res["event_type"], "payment_intent.succeeded")

    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.count_successful_payments")
    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.get_payment_by_stripe_session")
    @patch("stripe.Webhook.construct_event")
    def test_6_webhook_hop_le_payment_success_va_booking_paid(
        self, mock_construct, mock_get_p, mock_get_b, mock_count, mock_upd_p, mock_chuyen
    ):
        """6. Webhook hợp lệ -> payment SUCCESS + booking PENDING_PAYMENT -> PAID trong một transaction."""
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": self.fake_session_obj},
        }
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = self.fake_booking
        mock_count.return_value = 0
        mock_upd_p.return_value = True

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertTrue(res["received"])
        self.assertTrue(res["handled"])
        self.assertEqual(res["booking_id"], 100)
        self.assertEqual(res["booking_status"], "PAID")

        # Kiểm tra cập nhật payment SUCCESS
        mock_upd_p.assert_called_once()
        upd_kwargs = mock_upd_p.call_args[1]
        self.assertEqual(upd_kwargs["payment_id"], 10)
        self.assertEqual(upd_kwargs["status"], "SUCCESS")
        self.assertEqual(upd_kwargs["stripe_payment_intent_id"], "pi_test_123")
        self.assertFalse(upd_kwargs["needs_refund"])

        # Kiểm tra chuyển trạng thái booking sang PAID
        mock_chuyen.assert_called_once()
        chuyen_kwargs = mock_chuyen.call_args[1]
        self.assertEqual(chuyen_kwargs["booking_id"], 100)
        self.assertEqual(chuyen_kwargs["tu"], "PENDING_PAYMENT")
        self.assertEqual(chuyen_kwargs["sang"], "PAID")

    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("app.tours.search_tours.repository.get_payment_by_stripe_session")
    @patch("stripe.Webhook.construct_event")
    def test_7_webhook_trung_payment_da_success_idempotent(
        self, mock_construct, mock_get_p, mock_chuyen
    ):
        """7. Webhook trùng (payment đã SUCCESS) -> idempotent, không tạo hiệu ứng phụ."""
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": self.fake_session_obj},
        }
        mock_get_p.return_value = {
            **self.fake_payment,
            "status": "SUCCESS",
            "booking_status": "PAID",
        }

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertTrue(res["received"])
        self.assertTrue(res["handled"])
        self.assertEqual(res["outcome"], "already_success")
        self.assertEqual(res["booking_status"], "PAID")
        # Không được gọi lại chuyển trạng thái
        mock_chuyen.assert_not_called()

    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.get_payment_by_stripe_session")
    @patch("stripe.Webhook.construct_event")
    def test_8_webhook_khi_booking_da_expired_needs_refund(
        self, mock_construct, mock_get_p, mock_get_b, mock_upd_p, mock_chuyen
    ):
        """8. Webhook khi booking đã EXPIRED -> needs_refund=True, booking KHÔNG thành PAID (A6/E3)."""
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": self.fake_session_obj},
        }
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = {**self.fake_booking, "status": "EXPIRED"}

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertTrue(res["received"])
        self.assertTrue(res["handled"])
        self.assertEqual(res["outcome"], "needs_refund")

        # Payment phải được cập nhật SUCCESS kèm cờ needs_refund=True
        mock_upd_p.assert_called_once()
        upd_kwargs = mock_upd_p.call_args[1]
        self.assertEqual(upd_kwargs["status"], "SUCCESS")
        self.assertTrue(upd_kwargs["needs_refund"])
        self.assertIn("A6/E3", upd_kwargs["note"])

        # KHÔNG gọi chuyển booking sang PAID
        mock_chuyen.assert_not_called()

    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.get_payment_by_stripe_session")
    @patch("stripe.Webhook.construct_event")
    def test_8b_webhook_khi_booking_pending_nhung_qua_han_hold_expires_at(
        self, mock_construct, mock_get_p, mock_get_b, mock_upd_p, mock_chuyen
    ):
        """8b. Webhook khi booking đang PENDING_PAYMENT nhưng đã quá hạn giữ chỗ

        -> chuyển booking sang EXPIRED và đánh dấu needs_refund=True.
        """
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": self.fake_session_obj},
        }
        mock_get_p.return_value = self.fake_payment
        expired_hold = datetime.now(TZ_VN) - timedelta(minutes=5)
        mock_get_b.return_value = {**self.fake_booking, "hold_expires_at": expired_hold}

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertEqual(res["outcome"], "needs_refund")
        # Booking phải được chuyển sang EXPIRED để nhả chỗ
        mock_chuyen.assert_called_once()
        chuyen_kwargs = mock_chuyen.call_args[1]
        self.assertEqual(chuyen_kwargs["sang"], "EXPIRED")

        # Payment SUCCESS + needs_refund=True
        mock_upd_p.assert_called_once()
        self.assertTrue(mock_upd_p.call_args[1]["needs_refund"])

    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.get_payment_by_stripe_session")
    @patch("stripe.Webhook.construct_event")
    def test_9_webhook_sai_tien_mismatch(
        self, mock_construct, mock_get_p, mock_get_b, mock_upd_p, mock_chuyen
    ):
        """9. Sai tiền (amount_total != payment.amount) -> MISMATCH, booking giữ PENDING_PAYMENT."""
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    **self.fake_session_obj,
                    "amount_total": 4_000_000,  # Tổng tiền gửi về 4tr, đơn 5tr
                }
            },
        }
        mock_get_p.return_value = self.fake_payment
        mock_get_b.return_value = self.fake_booking

        with patch.object(settings, "stripe_webhook_secret", "whsec_test_secret"):
            res = tour_service.xu_ly_stripe_webhook(self.fake_payload, self.fake_sig)

        self.assertTrue(res["received"])
        self.assertTrue(res["handled"])
        self.assertEqual(res["outcome"], "mismatch")

        mock_upd_p.assert_called_once()
        self.assertEqual(mock_upd_p.call_args[1]["status"], "MISMATCH")
        # Booking không bị chuyển sang PAID
        mock_chuyen.assert_not_called()


class TestLayTrangThaiThanhToan(unittest.TestCase):
    """Kiểm thử hàm lay_trang_thai_thanh_toan."""

    @patch("app.tours.search_tours.repository.get_booking_payments")
    @patch("app.tours.search_tours.repository.get_booking")
    def test_lay_trang_thai_thanh_cong_khong_lo_secret(self, mock_get_b, mock_get_p):
        """Tra cứu trạng thái đơn hàng và payment mới nhất an toàn."""
        mock_get_b.return_value = {
            "id": 100,
            "code": "TX-20260907-0001",
            "status": "PENDING_PAYMENT",
            "total_price": 5_000_000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=15),
        }
        mock_get_p.return_value = [
            {
                "id": 10,
                "status": "PENDING",
                "method": "STRIPE",
                "amount": 5_000_000,
                "stripe_session_id": "cs_test_123",
            }
        ]

        res = tour_service.lay_trang_thai_thanh_toan(100)
        self.assertEqual(res["booking_id"], 100)
        self.assertEqual(res["code"], "TX-20260907-0001")
        self.assertEqual(res["status"], "PENDING_PAYMENT")
        self.assertEqual(res["payment_status"], "PENDING")
        self.assertEqual(res["payment_method"], "STRIPE")
        self.assertFalse(res["is_hold_expired"])
        self.assertNotIn("stripe_secret_key", str(res))


class TestJobStripeSessionExpire(unittest.TestCase):
    """Kiểm thử mở rộng job xu_ly_booking_het_han dọn dẹp Stripe Checkout Session."""

    @patch("stripe.checkout.Session.expire")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.repository.list_stripe_sessions_can_expire")
    @patch("app.tours.search_tours.repository.find_pending_bookings_past_depart_date")
    @patch("app.tours.search_tours.repository.find_expired_bookings")
    def test_xu_ly_booking_het_han_expire_stripe_sessions(
        self, mock_find_exp, mock_find_past, mock_list_st, mock_upd_p, mock_st_expire
    ):
        """Job dọn đơn hết hạn gọi Session.expire trên các session Stripe còn mở."""
        mock_find_exp.return_value = []
        mock_find_past.return_value = []
        mock_list_st.return_value = [
            {"id": 20, "stripe_session_id": "cs_can_expire_1"},
            {"id": 21, "stripe_session_id": "cs_can_expire_2"},
        ]

        with patch.object(settings, "stripe_secret_key", "sk_test_fake"):
            res = tour_service.xu_ly_booking_het_han()

        self.assertEqual(mock_st_expire.call_count, 2)
        mock_st_expire.assert_any_call("cs_can_expire_1")
        mock_st_expire.assert_any_call("cs_can_expire_2")
        self.assertEqual(mock_upd_p.call_count, 2)


class TestApiStripeRoutes(unittest.TestCase):
    """Kiểm thử các API routes của Phase 3 Stripe Checkout."""

    def setUp(self):
        self.client = TestClient(app)

    @patch("app.core.security.execute_query")
    @patch("app.tours.search_tours.service.tao_checkout_stripe")
    @patch("app.tours.search_tours.repository.get_booking")
    def test_api_checkout_route_thanh_cong(self, mock_get_b, mock_tao_st, mock_sql):
        """Khách gọi POST /api/tours/bookings/{id}/checkout -> 200 OK."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": "user@test.vn"})
        mock_sql.return_value = [{"id": 10, "email": "user@test.vn", "role": "customer", "full_name": "Khách"}]
        mock_get_b.return_value = {"id": 100, "user_id": 10}
        mock_tao_st.return_value = {
            "payment_id": 1,
            "checkout_url": "https://checkout.stripe.com/pay/test",
            "stripe_session_id": "cs_test",
        }

        res = self.client.post(
            "/api/tours/bookings/100/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={"redirect_base": "http://localhost:5173"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])
        self.assertEqual(res.json()["checkout_url"], "https://checkout.stripe.com/pay/test")

    @patch("app.core.security.execute_query")
    @patch("app.tours.search_tours.service.lay_trang_thai_thanh_toan")
    @patch("app.tours.search_tours.repository.get_booking")
    def test_api_status_route_thanh_cong(self, mock_get_b, mock_lay_tt, mock_sql):
        """Khách gọi GET /api/tours/bookings/{id}/status -> 200 OK."""
        from app.core.security import create_access_token
        token = create_access_token({"sub": "user@test.vn"})
        mock_sql.return_value = [{"id": 10, "email": "user@test.vn", "role": "customer", "full_name": "Khách"}]
        mock_get_b.return_value = {"id": 100, "user_id": 10}
        mock_lay_tt.return_value = {
            "booking_id": 100,
            "status": "PENDING_PAYMENT",
            "payment_status": "PENDING",
            "is_hold_expired": False,
        }

        res = self.client.get(
            "/api/tours/bookings/100/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])
        self.assertEqual(res.json()["payment_status"], "PENDING")

    @patch("app.tours.search_tours.service.xu_ly_stripe_webhook")
    def test_api_webhook_route_khong_can_auth(self, mock_webhook):
        """Stripe gọi POST /api/tours/stripe/webhook KHÔNG cần header Authorization -> 200 OK."""
        mock_webhook.return_value = {
            "received": True,
            "handled": True,
            "booking_id": 100,
            "booking_status": "PAID",
        }

        res = self.client.post(
            "/api/tours/stripe/webhook",
            headers={"stripe-signature": "t=123,v1=signature"},
            content=b'{"id": "evt_test"}',
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])
        self.assertEqual(res.json()["booking_status"], "PAID")


if __name__ == "__main__":
    unittest.main()
