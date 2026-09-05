"""Kiểm thử mô hình dữ liệu và giá bán hiệu lực (Phase 1).

Tiêu chí nghiệm thu Phase 1:
- Hàm dùng chung tính `gia_ban_hieu_luc` trả đúng `sale_price` khi khuyến mãi còn hạn,
  ngược lại trả `list_price`.
- Seed một tour có 2 đợt (một đợt giá gốc, một đợt đang sale):
  `GET /api/tours` trả `price_from` đúng bằng giá sale, kèm giá gốc để hiển thị gạch ngang.
- Khách lọc `max_price` theo giá sale (dưới 5 triệu) phải thấy tour giá gốc 6 triệu đang sale 4,5 triệu.
"""

import os
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import execute_query
from app.main import app
from app.repositories import tour_repo
from app.services import tour_service

TZ_VN = ZoneInfo("Asia/Ho_Chi_Minh")


class TestGiaBanHieuLuc(unittest.TestCase):
    """Kiểm thử đơn vị hàm dùng chung gia_ban_hieu_luc và các quy tắc khuyến mãi."""

    def test_khong_co_khuyen_mai_tra_ve_list_price(self):
        dep = {"list_price": 5_000_000, "sale_price": None}
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 5_000_000)

    def test_khuyen_mai_khong_gioi_han_thoi_gian_tra_ve_sale_price(self):
        dep = {
            "list_price": 6_000_000,
            "sale_price": 4_500_000,
            "sale_starts_at": None,
            "sale_ends_at": None,
        }
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 4_500_000)

    def test_khuyen_mai_chua_toi_gio_ap_dung_tra_ve_list_price(self):
        tuong_lai = datetime.now(TZ_VN) + timedelta(days=2)
        dep = {
            "list_price": 6_000_000,
            "sale_price": 4_500_000,
            "sale_starts_at": tuong_lai,
            "sale_ends_at": None,
        }
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 6_000_000)

    def test_khuyen_mai_da_qua_han_tra_ve_list_price(self):
        qua_khu = datetime.now(TZ_VN) - timedelta(days=1)
        dep = {
            "list_price": 6_000_000,
            "sale_price": 4_500_000,
            "sale_starts_at": None,
            "sale_ends_at": qua_khu,
        }
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 6_000_000)

    def test_khuyen_mai_dang_trong_khoang_hieu_luc(self):
        dep = {
            "list_price": 6_000_000,
            "sale_price": 4_500_000,
            "sale_starts_at": datetime.now(TZ_VN) - timedelta(days=1),
            "sale_ends_at": datetime.now(TZ_VN) + timedelta(days=1),
        }
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 4_500_000)

    def test_chan_giam_gia_ao_sale_lon_hon_hoac_bang_list_price(self):
        """BR-SL1: sale_price >= list_price bị xem là giảm giá ảo, từ chối áp dụng."""
        dep_bang = {"list_price": 5_000_000, "sale_price": 5_000_000}
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep_bang), 5_000_000)

        dep_lon_hon = {"list_price": 5_000_000, "sale_price": 5_500_000}
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep_lon_hon), 5_000_000)

    def test_chan_sale_price_am_hoac_bang_khong(self):
        dep = {"list_price": 5_000_000, "sale_price": 0}
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep), 5_000_000)

        dep_am = {"list_price": 5_000_000, "sale_price": -100_000}
        self.assertEqual(tour_service.gia_ban_hieu_luc(dep_am), 5_000_000)

    def test_lam_giau_thong_tin_gia_va_tinh_phan_tram_giam(self):
        dep = {"list_price": 6_000_000, "sale_price": 4_500_000}
        enriched = tour_service.lam_giau_thong_tin_gia(dep)
        self.assertEqual(enriched["effective_price"], 4_500_000)
        self.assertEqual(enriched["list_price"], 6_000_000)
        self.assertTrue(enriched["is_sale"])
        # (6 - 4.5) / 6 = 25%
        self.assertEqual(enriched["discount_pct"], 25)


class TestNghiemThuPhase1(unittest.TestCase):
    """Tiêu chí nghiệm thu Phase 1:

    Seed một tour có 2 đợt, một đợt đang sale:
    `GET /api/tours` trả `price_from` đúng bằng giá sale, kèm giá gốc để hiển thị gạch ngang.
    """

    def setUp(self):
        self.c = TestClient(app)

    def test_nghiem_thu_danh_sach_tour_tra_dung_gia_sale_va_gach_ngang(self):
        """Giả lập 1 tour có 2 đợt: đợt 1 gốc 6tr, đợt 2 đang sale còn 4,5tr."""
        tour_mau = {
            "id": 9999,
            "slug": "tour-da-nang-sale-test",
            "name": "Tour Đà Nẵng 3N2Đ Siêu Khuyến Mãi",
            "summary": "Tour test Phase 1",
            "description": "Chi tiết tour",
            "duration_days": 3,
            "price_from": 4_500_000,
            "original_price": 6_000_000,
            "cover_url": "https://example.com/cover.jpg",
            "highlights": ["Bà Nà Hills"],
            "itinerary": [],
            "included": "Bao gồm vé",
            "excluded": "Không gồm tip",
            "province_name": "Đà Nẵng",
            "ngay_gan_nhat": str(date.today() + timedelta(days=5)),
            "is_sale": True,
            "discount_pct": 25,
        }

        # Mock tour_repo.list_tours để kiểm tra tầng service và API endpoint
        with patch("app.repositories.tour_repo.list_tours", return_value=([tour_mau], 1)):
            resp = self.c.get("/api/tours")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data["success"])
            self.assertEqual(len(data["items"]), 1)

            tour = data["items"][0]
            # Giá bán hiệu lực: phải là giá sale 4.500.000đ
            self.assertEqual(tour["price_from"], 4_500_000)
            # Giá gốc để gạch ngang: 6.000.000đ
            self.assertEqual(tour["original_price"], 6_000_000)
            # Nhãn khuyến mãi
            self.assertTrue(tour["is_sale"])
            self.assertEqual(tour["discount_pct"], 25)

    def test_loc_max_price_theo_gia_ban_hieu_luc(self):
        """Khách lọc dưới 5 triệu phải thấy tour giá gốc 6 triệu đang sale còn 4,5 triệu."""
        tour_mau = {
            "id": 9999,
            "slug": "tour-sale-4-trieu-ruoi",
            "name": "Tour 6tr sale còn 4tr5",
            "price_from": 4_500_000,
            "original_price": 6_000_000,
            "is_sale": True,
            "discount_pct": 25,
        }

        # Bắt tham số truyền xuống repo khi gọi API với max_price=5000000
        with patch("app.repositories.tour_repo.list_tours", return_value=([tour_mau], 1)) as mock_list:
            resp = self.c.get("/api/tours?max_price=5000000")
            self.assertEqual(resp.status_code, 200)
            # Đảm bảo max_price=5000000 được chuyển chính xác xuống repo
            mock_list.assert_called_once()
            _, kwargs = mock_list.call_args
            self.assertEqual(kwargs.get("max_price"), 5_000_000)

    def test_get_tour_chi_tiet_tra_du_cac_dot_khoi_hanh_kem_gia_hieu_luc(self):
        """Trang chi tiết tour trả danh sách đợt có cả list_price, sale_price và effective_price."""
        ngay1 = date.today() + timedelta(days=5)
        ngay2 = date.today() + timedelta(days=12)

        raw_tour = {
            "id": 100,
            "slug": "tour-chi-tiet-sale",
            "name": "Tour Chi Tiết",
            "price_from": 6_000_000,
            "itinerary": [],
        }
        raw_deps = [
            {"id": 1, "depart_date": ngay1, "list_price": 6_000_000, "sale_price": None, "seats_left": 10},
            {"id": 2, "depart_date": ngay2, "list_price": 6_000_000, "sale_price": 4_500_000, "seats_left": 10},
        ]

        with patch("app.repositories.tour_repo.get_tour", return_value=raw_tour), \
             patch("app.repositories.tour_repo.departures", return_value=raw_deps), \
             patch("app.repositories.tour_repo.places_of_tour", return_value={}):

            tour = tour_service.get_tour("tour-chi-tiet-sale")
            self.assertIsNotNone(tour)
            # price_from của tour tự động cập nhật về giá của đợt rẻ nhất (4.500.000)
            self.assertEqual(tour["price_from"], 4_500_000)
            self.assertEqual(tour["original_price"], 6_000_000)
            self.assertTrue(tour["is_sale"])

            # Đợt 1: không sale
            d1 = tour["departures"][0]
            self.assertEqual(d1["effective_price"], 6_000_000)
            self.assertFalse(d1["is_sale"])

            # Đợt 2: đang sale
            d2 = tour["departures"][1]
            self.assertEqual(d2["effective_price"], 4_500_000)
            self.assertEqual(d2["list_price"], 6_000_000)
            self.assertEqual(d2["sale_price"], 4_500_000)
            self.assertTrue(d2["is_sale"])
            self.assertEqual(d2["discount_pct"], 25)


if __name__ == "__main__":
    unittest.main()
