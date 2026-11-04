"""Kiểm tra luồng tạo link thanh toán và webhook của payOS (VietQR)."""

import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.core.config import settings
from app.tours.search_tours import repository as tour_repo
from app.tours.search_tours import service

TZ_VN = ZoneInfo("Asia/Ho_Chi_Minh")


class PayOSTest(unittest.TestCase):
    def setUp(self):
        self.patch_client_id = patch.object(settings, "payos_client_id", "test_client_id")
        self.patch_api_key = patch.object(settings, "payos_api_key", "test_api_key")
        self.patch_checksum = patch.object(settings, "payos_checksum_key", "test_checksum_key")
        self.patch_client_id.start()
        self.patch_api_key.start()
        self.patch_checksum.start()

    def tearDown(self):
        self.patch_client_id.stop()
        self.patch_api_key.stop()
        self.patch_checksum.stop()

    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.create_payment")
    @patch("app.tours.search_tours.repository.generate_payment_txn_ref")
    @patch("app.tours.search_tours.repository.set_payment_provider_refs")
    @patch("payos.PayOS")
    def test_tao_checkout_payos_thanh_cong(
        self, mock_payos_cls, mock_set_refs, mock_gen_txn, mock_create_pm, mock_get_bk
    ):
        mock_get_bk.return_value = {
            "id": 101,
            "code": "TX-101",
            "status": "PENDING_PAYMENT",
            "total_price": 1500000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=25),
        }
        mock_gen_txn.return_value = "PM-TEST-001"
        mock_create_pm.return_value = 501
        mock_set_refs.return_value = True

        mock_payos_instance = MagicMock()
        mock_payos_cls.return_value = mock_payos_instance

        mock_res = MagicMock()
        mock_res.payment_link_id = "plink_123"
        mock_res.checkout_url = "https://pay.payos.vn/web/plink_123"
        mock_res.qr_code = "000201010212..."
        mock_res.account_name = "NGUYEN HUY SON"
        mock_res.account_number = "VQRQANIRA4950"
        mock_res.bin = "970422"
        mock_res.to_dict.return_value = {"order_code": 1010001, "payment_link_id": "plink_123"}
        mock_payos_instance.payment_requests.create.return_value = mock_res

        res = service.tao_checkout_payos(booking_id=101)

        self.assertTrue(res["success"])
        self.assertEqual(res["payment_id"], 501)
        self.assertEqual(res["checkout_url"], "https://pay.payos.vn/web/plink_123")
        self.assertEqual(res["account_name"], "NGUYEN HUY SON")
        self.assertEqual(res["account_number"], "VQRQANIRA4950")
        mock_set_refs.assert_called_once()

    @patch("app.tours.search_tours.repository.get_payment_by_provider_order")
    @patch("app.tours.search_tours.repository.get_booking")
    @patch("app.tours.search_tours.repository.count_successful_payments")
    @patch("app.tours.search_tours.repository.update_payment_status")
    @patch("app.tours.search_tours.service.chuyen_trang_thai")
    @patch("payos.PayOS")
    def test_xu_ly_payos_webhook_thanh_cong(
        self,
        mock_payos_cls,
        mock_chuyen_tt,
        mock_update_pm,
        mock_count_succ,
        mock_get_bk,
        mock_get_pm_by_provider,
    ):
        mock_payos_instance = MagicMock()
        mock_payos_cls.return_value = mock_payos_instance

        webhook_data = MagicMock()
        webhook_data.order_code = 1010001
        webhook_data.amount = 1500000
        webhook_data.code = "00"
        webhook_data.reference = "FT987654321"
        webhook_data.payment_link_id = "plink_123"
        webhook_data.model_dump.return_value = {"order_code": 1010001}
        mock_payos_instance.webhooks.verify.return_value = webhook_data

        mock_get_pm_by_provider.return_value = {
            "id": 501,
            "booking_id": 101,
            "amount": 1500000,
            "status": "PENDING",
        }
        mock_get_bk.return_value = {
            "id": 101,
            "status": "PENDING_PAYMENT",
            "total_price": 1500000,
            "hold_expires_at": datetime.now(TZ_VN) + timedelta(minutes=20),
        }
        mock_count_succ.return_value = 0

        res = service.xu_ly_payos_webhook(payload={"dummy": "payload"})

        self.assertTrue(res["received"])
        self.assertTrue(res["handled"])
        self.assertEqual(res["booking_status"], "PAID")
        mock_update_pm.assert_called_once()
        mock_chuyen_tt.assert_called_once_with(
            booking_id=101,
            tu="PENDING_PAYMENT",
            sang="PAID",
            ly_do="Thanh toán thành công qua VietQR payOS (orderCode=1010001)",
            actor_id=None,
            tx=unittest.mock.ANY,
        )


if __name__ == "__main__":
    unittest.main()
