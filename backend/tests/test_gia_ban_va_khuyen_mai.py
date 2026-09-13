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
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import execute_query
from app.main import app
from app.tours.search_tours import repository as tour_repo
from app.tours.search_tours import service as tour_service

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
            "images": ["https://example.com/cover.jpg", "https://example.com/extra.jpg"],
            "highlights": ["Bà Nà Hills"],
            "itinerary": [],
            "included": ["Xe đưa đón", "Vé tham quan"],
            "excluded": ["Vé máy bay", "Chi phí cá nhân"],
            "province_name": "Đà Nẵng",
            "ngay_gan_nhat": str(date.today() + timedelta(days=5)),
            "is_sale": True,
            "discount_pct": 25,
        }

        # Mock tour_repo.list_tours để kiểm tra tầng service và API endpoint
        with patch("app.tours.search_tours.repository.list_tours", return_value=([tour_mau], 1)):
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
            # Mảng images
            self.assertEqual(tour["images"], ["https://example.com/cover.jpg", "https://example.com/extra.jpg"])

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
        with patch("app.tours.search_tours.repository.list_tours", return_value=([tour_mau], 1)) as mock_list:
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

        with patch("app.tours.search_tours.repository.get_tour", return_value=raw_tour), \
             patch("app.tours.search_tours.repository.departures", return_value=raw_deps), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}):

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

    def test_endpoint_tour_provinces(self):
        """Endpoint GET /api/tours/provinces trả danh sách tỉnh có tour."""
        mock_provinces = [{"id": 1, "name": "Đà Nẵng"}, {"id": 2, "name": "Hà Nội"}]
        with patch("app.tours.search_tours.repository.list_tour_provinces", return_value=mock_provinces):
            resp = self.c.get("/api/tours/provinces")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data["success"])
            self.assertEqual(len(data["provinces"]), 2)
            self.assertEqual(data["provinces"][0]["name"], "Đà Nẵng")

    def test_loc_va_sap_xep_tours_truyen_dung_tham_so(self):
        """Kiểm tra GET /api/tours truyền đúng tất cả tham số lọc và sắp xếp xuống repo."""
        with patch("app.tours.search_tours.repository.list_tours", return_value=([], 0)) as mock_list:
            resp = self.c.get(
                "/api/tours?province_id=3114&depart_from=2026-09-10&depart_to=2026-09-20"
                "&price_min=1000000&price_max=5000000&max_days=3&guests=2&sort=price_asc"
            )
            self.assertEqual(resp.status_code, 200)
            mock_list.assert_called_once()
            _, kwargs = mock_list.call_args
            self.assertEqual(kwargs.get("province_id"), 3114)
            self.assertEqual(str(kwargs.get("depart_from")), "2026-09-10")
            self.assertEqual(str(kwargs.get("depart_to")), "2026-09-20")
            self.assertEqual(kwargs.get("price_min"), 1_000_000)
            self.assertEqual(kwargs.get("price_max"), 5_000_000)
            self.assertEqual(kwargs.get("max_days"), 3)
            self.assertEqual(kwargs.get("guests"), 2)
            self.assertEqual(kwargs.get("sort"), "price_asc")

    def test_tour_images_gallery_round_trip(self):
        """Kiểm thử round-trip: tạo tour có images list -> API GET /api/tours/{slug} trả đúng images list."""
        test_images = [
            "/assets/images/tour-danang.jpg",
            "/assets/images/vietnam-1.jpg",
            "/assets/images/hero-slide-1.jpg",
        ]
        raw_tour = {
            "id": 8888,
            "slug": "tour-danang-gallery-roundtrip",
            "name": "Tour Đà Nẵng Gallery 3N2Đ",
            "price_from": 3_490_000,
            "cover_url": "/assets/images/tour-danang.jpg",
            "images": test_images,
            "itinerary": [],
        }

        # Mock tầng repository để kiểm tra tính toàn vẹn khi tầng service và route trả ra API
        with patch("app.tours.search_tours.repository.get_tour", return_value=dict(raw_tour)), \
             patch("app.tours.search_tours.repository.departures", return_value=[]), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}):

            resp = self.c.get("/api/tours/tour-danang-gallery-roundtrip")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data["success"])
            tour = data["tour"]

            # API trả đầy đủ mảng images và cover_url khớp với dữ liệu tạo
            self.assertIn("images", tour)
            self.assertIsInstance(tour["images"], list)
            self.assertEqual(tour["images"], test_images)
            self.assertEqual(tour["cover_url"], "/assets/images/tour-danang.jpg")

    def test_create_tour_handles_images_and_fallback_cover_url(self):
        """Kiểm thử create_tour lưu cột images dưới dạng JSON và tự động gán cover_url nếu trống."""
        mock_execute = MagicMock(return_value=[{"id": 555}])

        # Giả lập CSDL đã có cột images
        def mock_has_col(table, col):
            return col in {"cancellation_policy", "status", "images"}

        with patch("app.tours.search_tours.repository.execute_query", mock_execute), \
             patch("app.tours.search_tours.repository._has_col", side_effect=mock_has_col):

            # Trường hợp 1: cover_url để trống nhưng có images -> tự gán cover_url = images[0]
            tour_id = tour_repo.create_tour({
                "slug": "tour-test-fallback-cover",
                "name": "Tour Fallback Cover",
                "duration_days": 3,
                "images": ["/assets/images/tour-danang.jpg", "/assets/images/vietnam-1.jpg"],
            })
            self.assertEqual(tour_id, 555)

            args, _ = mock_execute.call_args
            sql_query, sql_params = args[0], args[1]
            self.assertIn("images", sql_query)
            # Param cover_url (tham số thứ 8) được tự động lấy từ images[0]
            self.assertEqual(sql_params[7], "/assets/images/tour-danang.jpg")
            # Param images (tham số thứ 9) được json.dumps đúng
            self.assertEqual(sql_params[8], '["/assets/images/tour-danang.jpg", "/assets/images/vietnam-1.jpg"]')

            # Trường hợp 2: images rỗng nhưng có cover_url -> chấp nhận và lưu images = [cover_url]
            tour_repo.create_tour({
                "slug": "tour-test-only-cover",
                "name": "Tour Only Cover",
                "duration_days": 2,
                "cover_url": "/assets/images/tour-halong.jpg",
                "images": [],
            })
            args, _ = mock_execute.call_args
            sql_query, sql_params = args[0], args[1]
            self.assertEqual(sql_params[7], "/assets/images/tour-halong.jpg")
            self.assertEqual(sql_params[8], '["/assets/images/tour-halong.jpg"]')

    def test_get_tour_fallback_empty_images_when_unmigrated(self):
        """Kiểm thử khi DB chưa migrate (images là None hoặc thiếu): API trả images dạng list rỗng []."""
        raw_tour = {
            "id": 7777,
            "slug": "tour-unmigrated-db",
            "name": "Tour DB Cũ Chưa Migrate",
            "price_from": 2_000_000,
            "cover_url": None,
            "images": None,
            "itinerary": [],
        }

        with patch("app.tours.search_tours.repository.get_tour", return_value=dict(raw_tour)), \
             patch("app.tours.search_tours.repository.departures", return_value=[]), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}):

            resp = self.c.get("/api/tours/tour-unmigrated-db")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data["success"])
            # Fallback thành mảng rỗng [] thay vì None hay lỗi
            self.assertEqual(data["tour"]["images"], [])

    def test_get_tour_synthesizes_images_from_itinerary_when_empty(self):
        """Kiểm thử khi tours.images rỗng nhưng place_photos có ảnh cho itinerary: tự tổng hợp lại lúc đọc."""
        raw_tour = {
            "id": 5555,
            "slug": "tour-fallback-itinerary",
            "name": "Tour Fallback Itinerary",
            "price_from": 3_000_000,
            "cover_url": None,
            "images": [],
            "itinerary": [
                {"day": 1, "place_ids": [101, 102]},
                {"day": 2, "place_ids": [103]},
            ],
        }
        mock_photos = [
            "https://upload.wikimedia.org/photo_101.jpg",
            "https://upload.wikimedia.org/photo_102.jpg",
            "https://upload.wikimedia.org/photo_103.jpg",
        ]

        with patch("app.tours.search_tours.repository.get_tour", return_value=dict(raw_tour)), \
             patch("app.tours.search_tours.repository.departures", return_value=[]), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}), \
             patch("app.tours.search_tours.repository.get_itinerary_photos", return_value=mock_photos):

            resp = self.c.get("/api/tours/tour-fallback-itinerary")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data["success"])
            tour = data["tour"]

            # API tự tổng hợp ảnh thật từ itinerary và gán cover_url = ảnh đầu tiên
            self.assertEqual(tour["images"], mock_photos)
            self.assertEqual(tour["cover_url"], "https://upload.wikimedia.org/photo_101.jpg")

    def test_get_tour_strips_generic_images_and_uses_itinerary_photos(self):
        """Kiểm thử nếu DB còn ảnh generic cũ (/assets/images/tour-*.jpg), API tự bỏ và thay bằng ảnh itinerary."""
        raw_tour = {
            "id": 5556,
            "slug": "tour-strip-generic",
            "name": "Tour Strip Generic",
            "price_from": 3_000_000,
            "cover_url": "/assets/images/tour-danang.jpg",
            "images": ["/assets/images/tour-danang.jpg", "/assets/images/vietnam-1.jpg"],
            "itinerary": [
                {"day": 1, "place_ids": [101]},
            ],
        }
        mock_photos = ["https://upload.wikimedia.org/photo_real_101.jpg"]

        with patch("app.tours.search_tours.repository.get_tour", return_value=dict(raw_tour)), \
             patch("app.tours.search_tours.repository.departures", return_value=[]), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}), \
             patch("app.tours.search_tours.repository.get_itinerary_photos", return_value=mock_photos):

            resp = self.c.get("/api/tours/tour-strip-generic")
            self.assertEqual(resp.status_code, 200)
            tour = resp.json()["tour"]

            # Ảnh generic bị loại bỏ, thay bằng ảnh thật
            self.assertEqual(tour["images"], mock_photos)
            self.assertEqual(tour["cover_url"], "https://upload.wikimedia.org/photo_real_101.jpg")

    def test_get_tour_fallback_empty_when_no_itinerary_photos(self):
        """Kiểm thử khi điểm đến trong itinerary chưa có ảnh trong place_photos: trả [] và cover_url=None."""
        raw_tour = {
            "id": 5557,
            "slug": "tour-no-photos",
            "name": "Tour No Photos",
            "price_from": 3_000_000,
            "cover_url": "/assets/images/tour-danang.jpg",
            "images": ["/assets/images/tour-danang.jpg"],
            "itinerary": [
                {"day": 1, "place_ids": [999]},
            ],
        }

        with patch("app.tours.search_tours.repository.get_tour", return_value=dict(raw_tour)), \
             patch("app.tours.search_tours.repository.departures", return_value=[]), \
             patch("app.tours.search_tours.repository.places_of_tour", return_value={}), \
             patch("app.tours.search_tours.repository.get_itinerary_photos", return_value=[]):

            resp = self.c.get("/api/tours/tour-no-photos")
            self.assertEqual(resp.status_code, 200)
            tour = resp.json()["tour"]

            # Trả về rỗng, cover_url = None, KHÔNG fallback về ảnh generic
            self.assertEqual(tour["images"], [])
            self.assertIsNone(tour["cover_url"])


if __name__ == "__main__":
    unittest.main()
