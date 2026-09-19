"""Kiểm tra Stripe refund không gọi mạng thật."""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.core.config import settings
from app.tours.search_tours import service


class StripeRefundTest(unittest.TestCase):
    @patch("stripe.Refund.create")
    def test_creates_full_refund_for_payment_intent(self, create):
        create.return_value = {"id": "re_test_123", "status": "succeeded"}
        with patch.object(settings, "stripe_secret_key", "sk_test_example"):
            refund = service._hoan_tien_stripe(
                payment_intent="pi_test_123", amount=200000, reason="Hủy đợt tour",
            )
        self.assertEqual(refund["status"], "succeeded")
        self.assertEqual(create.call_args.kwargs["payment_intent"], "pi_test_123")
        self.assertEqual(create.call_args.kwargs["amount"], 200000)
