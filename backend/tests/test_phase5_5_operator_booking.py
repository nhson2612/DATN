"""Kiểm thử Phase 5.5 — Operator xem & quản lý booking của tour mình.

Bao gồm:
1. BR-O1: Operator A tạo tour + đợt + booking PAID; Operator B không xem/xác nhận được booking đó (403 Forbidden).
2. BR-O3: Operator A xem đúng danh sách và chi tiết booking; response không chứa `txn_ref` hay thông tin thanh toán nhạy cảm.
3. Chuyển trạng thái PAID -> CONFIRMED: xác nhận đơn PAID thành công, booking PENDING_PAYMENT -> confirm bị chặn 400.
4. Export guests: GET /api/operator/departures/{departure_id}/guests.csv trả đúng booking của departure (chỉ departure thuộc tour của operator; operator khác bị 403).
5. Dọn dẹp sạch sẽ dữ liệu test trước và sau khi thực thi.
"""

import os
import unittest
from datetime import date, datetime, timedelta

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient

from app.core.database import execute_query
from app.core.security import create_access_token, hash_password
from app.main import app
from app.shared.accounts import repository as user_repo
from app.tours.operator import repository as operator_repo
from app.tours.search_tours import repository as tour_repo
from app.tours.search_tours import service as tour_service


def _db_available():
    try:
        execute_query("SELECT 1 FROM tours LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "Cần CSDL Postgres có bảng tours và operators")


@requires_db
class TestPhase55OperatorBooking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_email = "admin_phase5_5@test.vn"
        cls.op_a_email = "op_a_phase5_5@test.vn"
        cls.op_b_email = "op_b_phase5_5@test.vn"

        cls._cleanup_all()

        # 1. Tạo tài khoản admin test
        hp = hash_password("admin123")
        cls.admin_id = user_repo.create(
            email=cls.admin_email,
            hashed_password=hp,
            full_name="Admin Phase 5.5 Test",
            role="admin",
        )
        cls.admin_token = create_access_token({"sub": cls.admin_email})
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 2. Tạo Operator A
        res_a = cls.client.post(
            "/api/admin/operators",
            headers=cls.admin_headers,
            json={
                "email": cls.op_a_email,
                "password": "passwordA123",
                "full_name": "Nguyễn Văn Operator A",
                "company_name": "Công ty Lữ hành A",
                "tax_code": "0101010101",
                "commission_rate": 0.10,
            },
        )
        assert res_a.status_code == 200, res_a.text
        cls.op_a_info = res_a.json()["operator"]
        cls.op_a_id = cls.op_a_info["id"]

        login_a = cls.client.post(
            "/api/auth/login",
            json={"email": cls.op_a_email, "password": "passwordA123"},
        )
        assert login_a.status_code == 200, login_a.text
        cls.op_a_token = login_a.json()["access_token"]
        cls.op_a_headers = {"Authorization": f"Bearer {cls.op_a_token}"}

        # 3. Tạo Operator B
        res_b = cls.client.post(
            "/api/admin/operators",
            headers=cls.admin_headers,
            json={
                "email": cls.op_b_email,
                "password": "passwordB123",
                "full_name": "Trần Thị Operator B",
                "company_name": "Công ty Lữ hành B",
                "tax_code": "0202020202",
                "commission_rate": 0.10,
            },
        )
        assert res_b.status_code == 200, res_b.text
        cls.op_b_info = res_b.json()["operator"]
        cls.op_b_id = cls.op_b_info["id"]

        login_b = cls.client.post(
            "/api/auth/login",
            json={"email": cls.op_b_email, "password": "passwordB123"},
        )
        assert login_b.status_code == 200, login_b.text
        cls.op_b_token = login_b.json()["access_token"]
        cls.op_b_headers = {"Authorization": f"Bearer {cls.op_b_token}"}

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_all()

    @classmethod
    def _cleanup_all(cls):
        """Dọn dẹp sạch sẽ tất cả dữ liệu tạo ra trong test."""
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-5-%' OR name LIKE '%Phase 5.5%'"
        ) or []
        tour_ids = [t["id"] for t in tours]
        if tour_ids:
            if tour_repo._has_table("payments"):
                execute_query(
                    "DELETE FROM payments WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = ANY(%s))",
                    (tour_ids,),
                )
            if tour_repo._has_table("booking_status_history"):
                execute_query(
                    "DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = ANY(%s))",
                    (tour_ids,),
                )
            execute_query("DELETE FROM tour_bookings WHERE tour_id = ANY(%s)", (tour_ids,))
            execute_query("DELETE FROM tour_departures WHERE tour_id = ANY(%s)", (tour_ids,))
            execute_query("DELETE FROM tours WHERE id = ANY(%s)", (tour_ids,))

        test_emails = [cls.admin_email, cls.op_a_email, cls.op_b_email]
        users = execute_query("SELECT id FROM users WHERE email = ANY(%s)", (test_emails,)) or []
        user_ids = [u["id"] for u in users]
        if user_ids:
            execute_query("DELETE FROM operators WHERE user_id = ANY(%s)", (user_ids,))
            execute_query("DELETE FROM users WHERE id = ANY(%s)", (user_ids,))

    def setUp(self):
        # Dọn các tour được tạo trong mỗi test case
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-5-%' OR name LIKE '%Phase 5.5%'"
        ) or []
        tour_ids = [t["id"] for t in tours]
        if tour_ids:
            if tour_repo._has_table("payments"):
                execute_query(
                    "DELETE FROM payments WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = ANY(%s))",
                    (tour_ids,),
                )
            if tour_repo._has_table("booking_status_history"):
                execute_query(
                    "DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM tour_bookings WHERE tour_id = ANY(%s))",
                    (tour_ids,),
                )
            execute_query("DELETE FROM tour_bookings WHERE tour_id = ANY(%s)", (tour_ids,))
            execute_query("DELETE FROM tour_departures WHERE tour_id = ANY(%s)", (tour_ids,))
            execute_query("DELETE FROM tours WHERE id = ANY(%s)", (tour_ids,))

    def _tao_tour_va_departure_a(self, slug_suffix="1"):
        """Tạo tour và departure thuộc sở hữu của Operator A."""
        res_t = self.client.post(
            "/api/operator/tours",
            headers=self.op_a_headers,
            json={
                "name": f"Tour Phase 5.5 Test {slug_suffix}",
                "slug": f"tour-phase5-5-{slug_suffix}",
                "duration_days": 3,
                "description": "Tour thử nghiệm cho Phase 5.5",
                "status": "ACTIVE",
            },
        )
        self.assertEqual(res_t.status_code, 200, res_t.text)
        tour_id = res_t.json()["tour"]["id"]

        depart_date = (date.today() + timedelta(days=10)).isoformat()
        res_d = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.op_a_headers,
            json={
                "depart_date": depart_date,
                "list_price": 2_000_000,
                "seats_total": 20,
            },
        )
        self.assertEqual(res_d.status_code, 200, res_d.text)
        departure_id = res_d.json()["departure"]["id"]

        return tour_id, departure_id

    def test_01_operator_a_tao_booking_paid_b_bi_chan_403_br_o1(self):
        """1. A tạo tour + đợt + booking PAID; B không xem/xác nhận được booking đó (403)."""
        tour_id_a, dep_id_a = self._tao_tour_va_departure_a("case1")

        # Đặt tour -> tạo booking PENDING_PAYMENT
        book_res = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Khách Test A",
                "phone": "0912345678",
                "email": "khach_a@test.vn",
                "guests": 2,
            }
        )
        booking_id = book_res["id"]

        # Tạo payment và xác nhận thanh toán -> booking chuyển sang PAID
        pay_info = tour_service.tao_thanh_toan(
            booking_id=booking_id,
            method="bank_transfer",
            amount=book_res["total_price"],
            actor_id=self.admin_id,
        )
        payment_id = pay_info["id"]
        tour_service.xac_nhan_thanh_toan(payment_id=payment_id, actor_id=self.admin_id)

        # Kiểm tra trạng thái booking lúc này là PAID
        booking_row = tour_repo.get_booking(booking_id)
        self.assertEqual(booking_row["status"], "PAID")
        self.assertIn("tour_operator_id", booking_row)

        # Kiểm tra Lỗi 1: get_booking an toàn trên DB cũ chưa có cột tours.operator_id
        from unittest.mock import patch
        with patch("app.tours.search_tours.repository._has_col", side_effect=lambda t, c: False if (t == "tours" and c == "operator_id") else tour_repo._has_col(t, c)):
            old_db_booking = tour_repo.get_booking(booking_id)
            self.assertIsNotNone(old_db_booking)
            self.assertEqual(old_db_booking["id"], booking_id)
            self.assertIsNone(old_db_booking.get("tour_operator_id"))

        # 1.1: Operator B xem chi tiết booking của A -> 403 Forbidden (BR-O1)
        res_b_view = self.client.get(
            f"/api/operator/bookings/{booking_id}",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_view.status_code, 403)
        self.assertIn("BR-O1", res_b_view.json()["detail"])

        # 1.2: Operator B cố gắng xác nhận booking của A -> 403 Forbidden (BR-O1)
        res_b_confirm = self.client.post(
            f"/api/operator/bookings/{booking_id}/confirm",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_confirm.status_code, 403)
        self.assertIn("BR-O1", res_b_confirm.json()["detail"])

        # 1.3: Operator B cố tình lọc theo tour_id của A -> 403 Forbidden
        res_b_filter_tour = self.client.get(
            f"/api/operator/bookings?tour_id={tour_id_a}",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_filter_tour.status_code, 403)

        # 1.4: Operator B cố tình lọc theo departure_id của A -> 403 Forbidden
        res_b_filter_dep = self.client.get(
            f"/api/operator/bookings?departure_id={dep_id_a}",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_filter_dep.status_code, 403)

    def test_02_operator_a_xem_dung_danh_sach_va_chi_tiet_khong_lo_txn_ref_br_o3(self):
        """2. A xem đúng danh sách/chi tiết; response không chứa `txn_ref` của payment."""
        tour_id_a, dep_id_a = self._tao_tour_va_departure_a("case2")

        # Đặt tour
        book_res = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Khách Test Bảo Mật",
                "phone": "0988888888",
                "email": "khach_bm@test.vn",
                "guests": 3,
            }
        )
        booking_id = book_res["id"]

        # Tạo payment có mã giao dịch nhạy cảm
        pay_info = tour_service.tao_thanh_toan(
            booking_id=booking_id,
            method="vnpay_sandbox",
            amount=book_res["total_price"],
            actor_id=self.admin_id,
        )
        txn_ref_secret = pay_info["txn_ref"]
        self.assertTrue(txn_ref_secret.startswith("PM-"))
        tour_service.xac_nhan_thanh_toan(payment_id=pay_info["id"], actor_id=self.admin_id)

        # 2.1: A lấy danh sách booking
        res_list = self.client.get(
            "/api/operator/bookings",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_list.status_code, 200)
        data_list = res_list.json()
        self.assertTrue(data_list["success"])
        self.assertGreaterEqual(data_list["total"], 1)

        # Kiểm tra tuyệt đối không có txn_ref trong payload danh sách
        raw_list_str = str(data_list)
        self.assertNotIn("txn_ref", raw_list_str)
        self.assertNotIn(txn_ref_secret, raw_list_str)

        # Tìm booking trong danh sách của A
        found = next((b for b in data_list["bookings"] if b["id"] == booking_id), None)
        self.assertIsNotNone(found)
        self.assertEqual(found["payment_status"], "PAID")
        self.assertEqual(found["payment_amount"], book_res["total_price"])

        # Kiểm tra Lỗi 2: Không bị N+1 payments khi lấy danh sách booking
        from unittest.mock import patch
        with patch("app.tours.search_tours.repository.get_booking_payments", side_effect=AssertionError("Phát hiện N+1: get_booking_payments bị gọi")):
            res_list_no_n1 = self.client.get(
                "/api/operator/bookings",
                headers=self.op_a_headers,
            )
            self.assertEqual(res_list_no_n1.status_code, 200)

        # 2.2: A xem chi tiết booking
        res_detail = self.client.get(
            f"/api/operator/bookings/{booking_id}",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_detail.status_code, 200)
        data_detail = res_detail.json()
        self.assertTrue(data_detail["success"])

        # BR-O3: Kiểm tra tuyệt đối không chứa txn_ref trong response chi tiết
        raw_detail_str = str(data_detail)
        self.assertNotIn("txn_ref", raw_detail_str)
        self.assertNotIn(txn_ref_secret, raw_detail_str)

        booking_obj = data_detail["booking"]
        self.assertEqual(booking_obj["id"], booking_id)
        self.assertEqual(booking_obj["full_name"], "Khách Test Bảo Mật")
        self.assertEqual(booking_obj["payment_status"], "PAID")

        # Payment summary phải có status và amount nhưng không có txn_ref
        payment_summary = data_detail["payment_summary"]
        self.assertEqual(payment_summary["status"], "PAID")
        self.assertEqual(payment_summary["amount"], book_res["total_price"])

        # 2.3: B xem danh sách booking -> không thấy booking của A
        res_b_list = self.client.get(
            "/api/operator/bookings",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_list.status_code, 200)
        b_booking_ids = [b["id"] for b in res_b_list.json()["bookings"]]
        self.assertNotIn(booking_id, b_booking_ids)

    def test_03_xac_nhan_paid_sang_confirmed_va_chan_pending_payment_400(self):
        """3. Xác nhận PAID -> CONFIRMED thành công; booking PENDING_PAYMENT -> confirm bị 400."""
        tour_id_a, dep_id_a = self._tao_tour_va_departure_a("case3")

        # 3.1: Đặt tour 1 -> ở trạng thái PENDING_PAYMENT
        book1 = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Khách Đơn 1 Chưa Trả Tiền",
                "phone": "0911111111",
                "guests": 1,
            }
        )
        booking1_id = book1["id"]
        b1_row = tour_repo.get_booking(booking1_id)
        self.assertEqual(b1_row["status"], "PENDING_PAYMENT")

        # Operator A cố xác nhận đơn PENDING_PAYMENT -> Phải nhận 400 Bad Request
        res_confirm_b1 = self.client.post(
            f"/api/operator/bookings/{booking1_id}/confirm",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_confirm_b1.status_code, 400)
        self.assertIn("PAID", res_confirm_b1.json()["detail"])

        # Trạng thái booking 1 không đổi
        self.assertEqual(tour_repo.get_booking(booking1_id)["status"], "PENDING_PAYMENT")

        # 3.2: Đặt tour 2 -> thanh toán thành PAID
        book2 = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Khách Đơn 2 Đã Trả Tiền",
                "phone": "0922222222",
                "guests": 2,
            }
        )
        booking2_id = book2["id"]
        p2 = tour_service.tao_thanh_toan(
            booking_id=booking2_id,
            amount=book2["total_price"],
            actor_id=self.admin_id,
        )
        tour_service.xac_nhan_thanh_toan(payment_id=p2["id"], actor_id=self.admin_id)
        self.assertEqual(tour_repo.get_booking(booking2_id)["status"], "PAID")

        # Operator A xác nhận đơn PAID -> Thành công 200 CONFIRMED
        res_confirm_b2 = self.client.post(
            f"/api/operator/bookings/{booking2_id}/confirm",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_confirm_b2.status_code, 200)
        self.assertEqual(res_confirm_b2.json()["status"], "CONFIRMED")

        # Kiểm tra trong DB
        b2_after = tour_repo.get_booking(booking2_id)
        self.assertEqual(b2_after["status"], "CONFIRMED")

        # Kiểm tra lịch sử trạng thái được ghi vào booking_status_history (BR-L2)
        history = tour_repo.get_booking_status_history(booking2_id)
        transitions = [(h["from_status"], h["to_status"]) for h in history]
        self.assertIn(("PAID", "CONFIRMED"), transitions)

    def test_04_export_guests_csv_dung_departure_va_chan_cheo_br_o1(self):
        """4. Export guests trả đúng booking của departure (chỉ departure thuộc tour của operator)."""
        tour_id_a, dep_id_a = self._tao_tour_va_departure_a("case4")

        # Tạo 2 booking trên departure của A
        book1 = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Trần Thị Khách Một",
                "phone": "0933333333",
                "email": "khach1@test.vn",
                "guests": 2,
            }
        )
        book2 = tour_service.book(
            {
                "tour_id": tour_id_a,
                "departure_id": dep_id_a,
                "full_name": "Lê Văn Khách Hai",
                "phone": "0944444444",
                "email": "khach2@test.vn",
                "guests": 1,
            }
        )

        # 4.1: Operator B cố xuất danh sách khách của departure A -> 403 Forbidden (BR-O1)
        res_b_csv = self.client.get(
            f"/api/operator/departures/{dep_id_a}/guests.csv",
            headers=self.op_b_headers,
        )
        self.assertEqual(res_b_csv.status_code, 403)
        self.assertIn("BR-O1", res_b_csv.json()["detail"])

        # 4.2: Operator A xuất danh sách khách của departure A -> 200 OK dạng text/csv
        res_a_csv = self.client.get(
            f"/api/operator/departures/{dep_id_a}/guests.csv",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_a_csv.status_code, 200)
        self.assertIn("text/csv", res_a_csv.headers.get("content-type", ""))
        self.assertIn(f'filename="guests_departure_{dep_id_a}.csv"', res_a_csv.headers.get("content-disposition", ""))

        csv_content = res_a_csv.text
        # Có BOM UTF-8
        self.assertTrue(csv_content.startswith("\ufeff"))
        # Có tiêu đề
        self.assertIn("Mã đơn,Họ tên người đặt,Số điện thoại,Email,Số khách,Tổng tiền,Trạng thái,Ngày đặt", csv_content)
        # Chứa thông tin 2 khách
        self.assertIn("Trần Thị Khách Một", csv_content)
        self.assertIn("0933333333", csv_content)
        self.assertIn("khach1@test.vn", csv_content)
        self.assertIn("Lê Văn Khách Hai", csv_content)
        self.assertIn("0944444444", csv_content)
        self.assertIn("khach2@test.vn", csv_content)

        # 4.3: Admin cũng có quyền xuất danh sách khách của departure A
        res_admin_csv = self.client.get(
            f"/api/operator/departures/{dep_id_a}/guests.csv",
            headers=self.admin_headers,
        )
        self.assertEqual(res_admin_csv.status_code, 200)
        self.assertIn("Trần Thị Khách Một", res_admin_csv.text)

        # 4.4: Lấy danh sách khách dạng JSON
        res_a_json = self.client.get(
            f"/api/operator/departures/{dep_id_a}/guests",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_a_json.status_code, 200)
        guests_json = res_a_json.json()["guests"]
        self.assertEqual(len(guests_json), 2)
        names = [g["full_name"] for g in guests_json]
        self.assertIn("Trần Thị Khách Một", names)
        self.assertIn("Lê Văn Khách Hai", names)

        # BR-O3: Danh sách khách JSON có payment_status/payment_amount, tuyệt đối không lộ txn_ref/gateway
        raw_guests_str = str(res_a_json.json())
        self.assertNotIn("txn_ref", raw_guests_str)
        self.assertNotIn("gateway", raw_guests_str)
        for g in guests_json:
            self.assertIn("payment_status", g)
            self.assertIn("payment_amount", g)
            self.assertEqual(g["payment_status"], "UNPAID")
            self.assertEqual(g["payment_amount"], 0)
            self.assertNotIn("txn_ref", g)
            self.assertNotIn("gateway", g)

        # Kiểm tra Lỗi 2: Không bị N+1 payments khi lấy danh sách khách
        from unittest.mock import patch
        with patch("app.tours.search_tours.repository.get_booking_payments", side_effect=AssertionError("Phát hiện N+1: get_booking_payments bị gọi khi lấy danh sách khách")):
            res_guests_no_n1 = self.client.get(
                f"/api/operator/departures/{dep_id_a}/guests",
                headers=self.op_a_headers,
            )
            self.assertEqual(res_guests_no_n1.status_code, 200)

        # Thử tạo 1 payment PENDING cho book1 và kiểm tra danh sách khách cập nhật đúng
        p1 = tour_service.tao_thanh_toan(
            booking_id=book1["id"],
            amount=book1["total_price"],
            actor_id=self.admin_id,
        )
        res_guests_p1 = self.client.get(
            f"/api/operator/departures/{dep_id_a}/guests",
            headers=self.op_a_headers,
        )
        self.assertEqual(res_guests_p1.status_code, 200)
        guests_p1 = res_guests_p1.json()["guests"]
        g1 = next(g for g in guests_p1 if g["id"] == book1["id"])
        self.assertEqual(g1["payment_status"], "PENDING")
        self.assertEqual(g1["payment_amount"], book1["total_price"])
        self.assertNotIn(p1["txn_ref"], str(res_guests_p1.json()))
