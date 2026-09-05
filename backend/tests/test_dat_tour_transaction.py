"""Kiểm thử cơ chế Transaction cho giữ chỗ + tạo đơn (P0).

Mục tiêu cốt lõi:
Chứng minh khi `create_booking` gặp lỗi (ném exception), số chỗ trống `seats_left`
trong đợt khởi hành KHÔNG hề bị trừ — khắc phục dứt điểm lỗ hổng thất thoát chỗ.
"""

import os
import unittest
from datetime import date, timedelta
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.core.database import execute_query, transaction
from app.repositories import tour_repo
from app.services import tour_service


def _db_available():
    try:
        execute_query("SELECT 1 FROM tours LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "Cần CSDL Postgres có bảng tours")


@requires_db
class TestDatTourTransaction(unittest.TestCase):
    """Kiểm thử tính nguyên tử của quy trình giữ chỗ và tạo đơn đặt tour."""

    def setUp(self):
        # Tạo dữ liệu tour và đợt khởi hành riêng biệt để test
        self.slug = "tour-test-transaction-p0"
        self.tour_id = tour_repo.create_tour({
            "slug": self.slug,
            "name": "Tour Test Transaction P0",
            "summary": "Tour dùng cho kiểm thử transaction",
            "description": "Mô tả kiểm thử",
            "duration_days": 2,
            "price_from": 1_500_000,
        })
        self.depart_date = date.today() + timedelta(days=15)
        # Khởi tạo đợt khởi hành với 10 chỗ trống
        tour_repo.add_departure(
            tour_id=self.tour_id,
            depart_date=self.depart_date,
            list_price=1_500_000,
            seats=10,
        )
        # Lấy departure_id vừa tạo
        deps = tour_repo.departures(self.tour_id)
        self.assertTrue(deps, "Phải tạo được đợt khởi hành thử nghiệm")
        self.departure_id = deps[0]["id"]
        self.assertEqual(deps[0]["seats_left"], 10)

    def tearDown(self):
        # Dọn dẹp sạch sẽ dữ liệu test
        execute_query("DELETE FROM tour_bookings WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tour_departures WHERE tour_id = %s", (self.tour_id,))
        execute_query("DELETE FROM tours WHERE id = %s", (self.tour_id,))

    def _get_seats_left(self) -> int:
        rows = execute_query(
            "SELECT seats_left FROM tour_departures WHERE id = %s",
            (self.departure_id,),
        )
        return rows[0]["seats_left"] if rows else -1

    def test_transaction_rollback_khi_co_loi_sql(self):
        """Chứng minh context manager transaction() tự động rollback khi gặp lỗi."""
        so_cho_ban_dau = self._get_seats_left()

        with self.assertRaises(Exception):
            with transaction() as tx:
                # Câu lệnh 1: trừ 3 chỗ thành công
                tx.execute(
                    "UPDATE tour_departures SET seats_left = seats_left - 3 WHERE id = %s",
                    (self.departure_id,),
                )
                # Câu lệnh 2: cố tình chạy câu SQL sai để gây lỗi
                tx.execute("SELECT * FROM bang_khong_he_ton_tai_12345")

        # Sau khi exception ném ra và rollback, seats_left phải giữ nguyên
        self.assertEqual(self._get_seats_left(), so_cho_ban_dau)

    def test_transaction_commit_khi_thanh_cong(self):
        """Chứng minh transaction() commit toàn bộ thay đổi khi thoát sạch sẽ."""
        so_cho_ban_dau = self._get_seats_left()
        with transaction() as tx:
            tx.execute(
                "UPDATE tour_departures SET seats_left = seats_left - 2 WHERE id = %s",
                (self.departure_id,),
            )
        self.assertEqual(self._get_seats_left(), so_cho_ban_dau - 2)

    def test_gia_lap_create_booking_loi_thi_seats_left_khong_doi(self):
        """TRỌNG TÂM P0: Giả lập create_booking ném exception -> seats_left KHÔNG đổi.

        Đây là kịch bản thực tế: trừ chỗ thành công nhưng ghi đơn vào bảng tour_bookings
        thất bại (mất kết nối, validate lỗi, lỗi ghi đĩa). Nhờ transaction, chỗ trống
        được khôi phục nguyên vẹn.
        """
        so_cho_ban_dau = self._get_seats_left()
        self.assertEqual(so_cho_ban_dau, 10)

        data_dat_tour = {
            "tour_id": self.tour_id,
            "departure_id": self.departure_id,
            "full_name": "Nguyễn Văn Test",
            "phone": "0987654321",
            "guests": 2,
        }

        # Giả lập create_booking gặp sự cố văng lỗi
        with patch("app.repositories.tour_repo.create_booking", side_effect=RuntimeError("Lỗi hệ thống khi ghi đơn")):
            with self.assertRaises(RuntimeError):
                tour_service.book(data_dat_tour)

        # BẤT BIẾN QUAN TRỌNG: seats_left không được phép giảm xuống 8 mà phải giữ nguyên 10!
        so_cho_sau_khi_loi = self._get_seats_left()
        self.assertEqual(
            so_cho_sau_khi_loi,
            so_cho_ban_dau,
            f"Lỗi P0: seats_left bị trừ từ {so_cho_ban_dau} xuống {so_cho_sau_khi_loi} dù tạo đơn thất bại!",
        )

        # Kiểm tra không có đơn mồ côi nào được tạo
        bookings = execute_query(
            "SELECT count(*) AS count FROM tour_bookings WHERE tour_id = %s",
            (self.tour_id,),
        )
        self.assertEqual(bookings[0]["count"], 0)

    def test_dat_tour_thanh_cong_trong_transaction(self):
        """Đặt tour bình thường: giữ chỗ và tạo đơn cùng commit thành công."""
        data_dat_tour = {
            "tour_id": self.tour_id,
            "departure_id": self.departure_id,
            "full_name": "Trần Thị Khách",
            "phone": "0912345678",
            "guests": 3,
        }

        kq = tour_service.book(data_dat_tour)
        self.assertTrue(kq["id"], "Phải trả về ID của đơn đặt tour")
        self.assertEqual(kq["total_price"], 1_500_000 * 3)

        # seats_left phải bị trừ đúng 3 chỗ (từ 10 xuống 7)
        self.assertEqual(self._get_seats_left(), 7)

        # Đơn booking phải tồn tại trong database
        bookings = execute_query(
            "SELECT * FROM tour_bookings WHERE id = %s",
            (kq["id"],),
        )
        self.assertTrue(bookings)
        self.assertEqual(bookings[0]["guests"], 3)
        self.assertEqual(bookings[0]["total_price"], 4_500_000)

    def test_goi_doc_lap_giu_cho_va_create_booking_khong_can_tx(self):
        """Đảm bảo tính tương thích ngược: các hàm repo vẫn gọi độc lập được khi tx=None."""
        # Gọi giu_cho độc lập
        con = tour_repo.giu_cho(self.departure_id, 1)
        self.assertIsNotNone(con)
        self.assertEqual(self._get_seats_left(), 9)

        # Gọi create_booking độc lập
        bid = tour_repo.create_booking(
            data={"tour_id": self.tour_id, "full_name": "Khách A", "phone": "0900000000", "guests": 1},
            total_price=1_500_000,
        )
        self.assertIsNotNone(bid)


if __name__ == "__main__":
    unittest.main()
