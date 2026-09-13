"""Kiểm thử Phase 5.3 — Tour Operator quản lý ĐỢT KHỞI HÀNH (tour_departures).

Bao gồm:
1. BR-O1: A tạo tour; B thao tác đợt của A -> 403 Forbidden; Admin thao tác được -> 200 OK.
2. BR-D1 & BR-D2: Tạo đợt hợp lệ -> 200; Trùng ngày -> 400; Ngày < hôm nay + 2 ngày -> 400.
3. BR-D4 & E6: Cập nhật seats_total giảm dưới số chỗ đã bán -> 400; giảm nhưng >= đã bán -> OK; seats_left tính chuẩn.
4. Xoá đợt: Đợt chưa có booking -> xoá cứng OK; Đợt có booking -> 400.
5. BR-D5: Đổi list_price không làm thay đổi snapshot đơn cũ (unit_list_price, total_price giữ nguyên).
6. Danh sách & chi tiết đợt khởi hành: phân trang, lọc status, thông tin sold_seats.
7. Dọn dẹp dữ liệu test sạch sẽ trước và sau kiểm thử.
"""

import os
import unittest
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient

from app.core.database import execute_query
from app.core.security import create_access_token, hash_password
from app.main import app
from app.shared.accounts import repository as user_repo
from app.tours.operator import repository as operator_repo
from app.tours.search_tours import repository as tour_repo
from app.tours.search_tours import service as tour_service

TZ_VN = ZoneInfo("Asia/Ho_Chi_Minh")


def _db_available():
    try:
        execute_query("SELECT 1 FROM tour_departures LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "Cần CSDL Postgres có bảng tour_departures")


@requires_db
class TestPhase53Departure(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_email = "admin_phase5_3@test.vn"
        cls.op_a_email = "op_a_phase5_3@test.vn"
        cls.op_b_email = "op_b_phase5_3@test.vn"

        cls._cleanup_all()

        hp = hash_password("password123")

        # 1. Admin
        cls.admin_id = user_repo.create(
            email=cls.admin_email,
            hashed_password=hp,
            full_name="Admin Phase 5.3 Test",
            role="admin",
        )
        cls.admin_token = create_access_token({"sub": cls.admin_email})
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 2. Operator A
        cls.user_a_id = user_repo.create(
            email=cls.op_a_email,
            hashed_password=hp,
            full_name="Operator A Test",
            role="operator",
        )
        cls.op_a_id = operator_repo.create_operator(
            user_id=cls.user_a_id,
            company_name="Công ty Du lịch A (Phase 5.3)",
            tax_code="TAX-A-53",
            status="ACTIVE",
        )
        cls.token_a = create_access_token({"sub": cls.op_a_email})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}

        # 3. Operator B
        cls.user_b_id = user_repo.create(
            email=cls.op_b_email,
            hashed_password=hp,
            full_name="Operator B Test",
            role="operator",
        )
        cls.op_b_id = operator_repo.create_operator(
            user_id=cls.user_b_id,
            company_name="Công ty Du lịch B (Phase 5.3)",
            tax_code="TAX-B-53",
            status="ACTIVE",
        )
        cls.token_b = create_access_token({"sub": cls.op_b_email})
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_all()

    @classmethod
    def _cleanup_all(cls):
        """Dọn dẹp sạch sẽ toàn bộ tour, đợt và người dùng test."""
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-3-%' OR name LIKE '%Phase 5.3%'"
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
        """Dọn tour và đợt test giữa các test case."""
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-3-%' OR name LIKE '%Phase 5.3%'"
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

    def _tao_tour_cho_operator(self, op_id: int, slug_suffix: str = "default") -> int:
        """Helper tạo tour test cho operator."""
        return tour_repo.create_tour({
            "slug": f"tour-phase5-3-{slug_suffix}",
            "name": f"Tour Phase 5.3 Test {slug_suffix}",
            "duration_days": 2,
            "operator_id": op_id,
            "status": "ACTIVE",
        })

    def test_01_br_o1_phan_quyen_operator_va_admin(self):
        """Quy tắc 1 (BR-O1): A tạo tour; B thao tác đợt của A -> 403; Admin thao tác được -> 200."""
        tour_a_id = self._tao_tour_cho_operator(self.op_a_id, "op-a")

        today_vn = datetime.now(TZ_VN).date()
        valid_date = (today_vn + timedelta(days=10)).isoformat()

        # 1. B cố tạo đợt khởi hành cho Tour của A -> 403
        res_b_create = self.client.post(
            f"/api/operator/tours/{tour_a_id}/departures",
            headers=self.headers_b,
            json={
                "depart_date": valid_date,
                "list_price": 2500000,
                "seats_total": 20,
            },
        )
        self.assertEqual(res_b_create.status_code, 403)
        self.assertIn("BR-O1", res_b_create.json()["detail"])

        # 2. A tạo đợt khởi hành thành công -> 200
        res_a_create = self.client.post(
            f"/api/operator/tours/{tour_a_id}/departures",
            headers=self.headers_a,
            json={
                "depart_date": valid_date,
                "list_price": 2500000,
                "seats_total": 20,
                "min_pax": 2,
            },
        )
        self.assertEqual(res_a_create.status_code, 200, res_a_create.text)
        dep_id = res_a_create.json()["departure"]["id"]

        # 3. B cố xem danh sách đợt của Tour A -> 403
        res_b_list = self.client.get(
            f"/api/operator/tours/{tour_a_id}/departures",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_list.status_code, 403)

        # 4. B cố xem chi tiết đợt của Tour A (cả 2 đường dẫn) -> 403
        res_b_get_nested = self.client.get(
            f"/api/operator/tours/{tour_a_id}/departures/{dep_id}",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_get_nested.status_code, 403)

        res_b_get_flat = self.client.get(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_get_flat.status_code, 403)

        # 5. B cố cập nhật đợt của A -> 403
        res_b_put = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_b,
            json={"list_price": 3000000},
        )
        self.assertEqual(res_b_put.status_code, 403)

        # 6. B cố xoá đợt của A -> 403
        res_b_del = self.client.delete(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_del.status_code, 403)

        # 7. Admin xem, sửa được đợt của A -> 200
        res_admin_get = self.client.get(
            f"/api/operator/departures/{dep_id}",
            headers=self.admin_headers,
        )
        self.assertEqual(res_admin_get.status_code, 200)

        res_admin_put = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.admin_headers,
            json={"list_price": 2800000},
        )
        self.assertEqual(res_admin_put.status_code, 200)
        self.assertEqual(res_admin_put.json()["departure"]["list_price"], 2800000)

    def test_02_br_d1_va_br_d2_ngay_khoi_hanh_va_trung_ngay(self):
        """Quy tắc 2 (BR-D2) và Quy tắc 3 (BR-D1):
        - depart_date >= hôm nay + 2 ngày (Asia/Ho_Chi_Minh). Quá khứ / cận ngày -> 400.
        - (tour_id, depart_date) duy nhất, trùng ngày -> 400.
        """
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "lead-days")

        today_vn = datetime.now(TZ_VN).date()

        # 1. Ngày hôm qua -> 400
        past_date = (today_vn - timedelta(days=1)).isoformat()
        res_past = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": past_date, "list_price": 2000000, "seats_total": 20},
        )
        self.assertEqual(res_past.status_code, 400)
        self.assertIn("BR-D1", res_past.json()["detail"])

        # 2. Ngày hôm nay -> 400
        today_str = today_vn.isoformat()
        res_today = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": today_str, "list_price": 2000000, "seats_total": 20},
        )
        self.assertEqual(res_today.status_code, 400)
        self.assertIn("BR-D1", res_today.json()["detail"])

        # 3. Ngày mai (hôm nay + 1 ngày) -> 400 (vì yêu cầu tối thiểu hôm nay + 2 ngày)
        tomorrow_str = (today_vn + timedelta(days=1)).isoformat()
        res_tomorrow = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": tomorrow_str, "list_price": 2000000, "seats_total": 20},
        )
        self.assertEqual(res_tomorrow.status_code, 400)
        self.assertIn("BR-D1", res_tomorrow.json()["detail"])

        # 4. Ngày mốt (hôm nay + 2 ngày) -> 200 OK (biên hợp lệ nhỏ nhất)
        day_after_tomorrow = (today_vn + timedelta(days=2)).isoformat()
        res_valid = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": day_after_tomorrow, "list_price": 2000000, "seats_total": 20},
        )
        self.assertEqual(res_valid.status_code, 200, res_valid.text)
        self.assertEqual(res_valid.json()["departure"]["depart_date"], day_after_tomorrow)

        # 5. BR-D2: Tạo lại đợt khởi hành trùng ngày đã tạo cho cùng tour -> 400
        res_dup = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": day_after_tomorrow, "list_price": 2200000, "seats_total": 25},
        )
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("BR-D2", res_dup.json()["detail"])

        # 6. Tạo đợt thứ 2 ngày khác -> 200 OK
        date_2 = (today_vn + timedelta(days=5)).isoformat()
        res_d2 = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": date_2, "list_price": 2100000, "seats_total": 20},
        )
        self.assertEqual(res_d2.status_code, 200)
        dep2_id = res_d2.json()["departure"]["id"]

        # 7. Sửa ngày của đợt 2 trùng với đợt 1 -> 400 (BR-D2)
        res_dup_put = self.client.put(
            f"/api/operator/departures/{dep2_id}",
            headers=self.headers_a,
            json={"depart_date": day_after_tomorrow},
        )
        self.assertEqual(res_dup_put.status_code, 400)
        self.assertIn("BR-D2", dup_msg := res_dup_put.json()["detail"])

    def test_03_br_d4_va_e6_cap_nhat_seats_total(self):
        """Quy tắc 4 (BR-D3) & Quy tắc 5 (BR-D4/E6):
        - seats_total không được giảm xuống dưới số chỗ đã bán.
        - Giảm nhưng >= đã bán -> OK, seats_left cập nhật tương ứng.
        - Đảm bảo 0 <= seats_left <= seats_total.
        """
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "seats-rule")

        today_vn = datetime.now(TZ_VN).date()
        dep_date = (today_vn + timedelta(days=15)).isoformat()

        # 1. Tạo đợt 20 chỗ, còn trống 20
        res_dep = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": dep_date, "list_price": 3000000, "seats_total": 20},
        )
        self.assertEqual(res_dep.status_code, 200)
        dep = res_dep.json()["departure"]
        dep_id = dep["id"]
        self.assertEqual(dep["seats_total"], 20)
        self.assertEqual(dep["seats_left"], 20)

        # 2. Khách đặt tour giữ 5 chỗ
        booking = tour_service.book({
            "tour_id": tour_id,
            "departure_id": dep_id,
            "full_name": "Khách Test Seats",
            "phone": "0911223344",
            "guests": 5,
        })
        self.assertIsNotNone(booking)

        # Kiểm tra đợt lúc này: seats_left còn 15, số đã bán = 5
        dep_after_book = self.client.get(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
        ).json()["departure"]
        self.assertEqual(dep_after_book["seats_left"], 15)
        self.assertEqual(dep_after_book["sold_seats"], 5)

        # 3. Cố tình giảm seats_total xuống 4 (< 5 đã bán) -> 400 (E6 / BR-D4)
        res_bad_reduce = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_total": 4},
        )
        self.assertEqual(res_bad_reduce.status_code, 400)
        self.assertIn("BR-D4/E6", res_bad_reduce.json()["detail"])

        # 4. Giảm seats_total xuống 12 (>= 5 đã bán) -> 200 OK
        res_ok_reduce = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_total": 12},
        )
        self.assertEqual(res_ok_reduce.status_code, 200, res_ok_reduce.text)
        dep_12 = res_ok_reduce.json()["departure"]
        self.assertEqual(dep_12["seats_total"], 12)
        # seats_left mới = 12 - 5 = 7
        self.assertEqual(dep_12["seats_left"], 7)
        self.assertEqual(dep_12["sold_seats"], 5)

        # 5. Giảm seats_total xuống đúng bằng 5 (số đã bán) -> 200 OK, seats_left = 0
        res_exact = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_total": 5},
        )
        self.assertEqual(res_exact.status_code, 200)
        dep_5 = res_exact.json()["departure"]
        self.assertEqual(dep_5["seats_total"], 5)
        self.assertEqual(dep_5["seats_left"], 0)

        # 6. Tăng lại seats_total lên 25 -> seats_left = 25 - 5 = 20
        res_up = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_total": 25},
        )
        self.assertEqual(res_up.status_code, 200)
        dep_25 = res_up.json()["departure"]
        self.assertEqual(dep_25["seats_total"], 25)
        self.assertEqual(dep_25["seats_left"], 20)

    def test_04_xoa_dot_khoi_hanh_chua_co_va_da_co_booking(self):
        """Quy tắc 7:
        - Đợt chưa có booking -> xoá cứng được.
        - Đợt đã có booking -> từ chối (400) vì hủy đợt thuộc Phase 6.
        """
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "delete-rule")

        today_vn = datetime.now(TZ_VN).date()
        date_empty = (today_vn + timedelta(days=20)).isoformat()
        date_booked = (today_vn + timedelta(days=25)).isoformat()

        # 1. Đợt chưa có booking
        res_e = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": date_empty, "list_price": 2000000, "seats_total": 10},
        )
        dep_e_id = res_e.json()["departure"]["id"]

        # Xoá cứng đợt chưa có booking -> 200 OK
        res_del_e = self.client.delete(
            f"/api/operator/departures/{dep_e_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_del_e.status_code, 200)
        self.assertTrue(res_del_e.json()["success"])

        # Kiểm tra lại: đợt không còn tồn tại -> 404
        res_check_e = self.client.get(
            f"/api/operator/departures/{dep_e_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_check_e.status_code, 404)

        # 2. Đợt đã có booking
        res_b = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": date_booked, "list_price": 2000000, "seats_total": 10},
        )
        dep_b_id = res_b.json()["departure"]["id"]

        # Khách đặt 1 chỗ
        tour_service.book({
            "tour_id": tour_id,
            "departure_id": dep_b_id,
            "full_name": "Khách Test Delete",
            "phone": "0933445566",
            "guests": 1,
        })

        # Cố xoá đợt đã có booking -> 400 Bad Request
        res_del_b = self.client.delete(
            f"/api/operator/departures/{dep_b_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_del_b.status_code, 400)
        self.assertIn("Phase 6", res_del_b.json()["detail"])

        # Kiểm tra lại: đợt vẫn còn tồn tại
        res_check_b = self.client.get(
            f"/api/operator/departures/{dep_b_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_check_b.status_code, 200)

    def test_05_br_d5_doi_list_price_khong_anh_huong_booking_cu(self):
        """Quy tắc 6 (BR-D5): Đổi giá list_price không ảnh hưởng booking cũ đã tạo (snapshot giữ nguyên)."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "snapshot-rule")

        today_vn = datetime.now(TZ_VN).date()
        dep_date = (today_vn + timedelta(days=30)).isoformat()

        # 1. Tạo đợt giá gốc 2.000.000
        res_dep = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": dep_date, "list_price": 2000000, "seats_total": 10},
        )
        dep_id = res_dep.json()["departure"]["id"]

        # 2. Khách đặt 2 chỗ với giá 2.000.000 -> snapshot total_price = 4.000.000
        booking = tour_service.book({
            "tour_id": tour_id,
            "departure_id": dep_id,
            "full_name": "Khách Snapshot Price",
            "phone": "0988776655",
            "guests": 2,
        })
        b_id = booking["id"]

        saved_booking = tour_repo.get_booking(b_id)
        self.assertEqual(saved_booking["unit_list_price"], 2000000)
        self.assertEqual(saved_booking["total_price"], 4000000)

        # 3. Operator cập nhật giá gốc của đợt thành 1.500.000 (giảm list_price hợp lệ theo BR-SL5)
        res_update_price = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"list_price": 1500000},
        )
        self.assertEqual(res_update_price.status_code, 200)
        self.assertEqual(res_update_price.json()["departure"]["list_price"], 1500000)

        # 4. Kiểm tra booking cũ: đơn giá và tổng tiền snapshot hoàn toàn không đổi
        after_booking = tour_repo.get_booking(b_id)
        self.assertEqual(after_booking["unit_list_price"], 2000000)
        self.assertEqual(after_booking["total_price"], 4000000)

        # 5. Tour price_from được cập nhật phản ánh giá mới
        tour_after = tour_repo.get_tour_by_id(tour_id)
        self.assertEqual(tour_after["price_from"], 1500000)


    def test_06_danh_sach_va_chi_tiet_departure(self):
        """Xem danh sách đợt (lọc status, phân trang) và xem chi tiết đợt khởi hành."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "listing-deps")

        today_vn = datetime.now(TZ_VN).date()

        # Tạo 3 đợt: 2 đợt OPEN, 1 đợt CLOSED
        d1 = (today_vn + timedelta(days=10)).isoformat()
        d2 = (today_vn + timedelta(days=15)).isoformat()
        d3 = (today_vn + timedelta(days=20)).isoformat()

        self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": d1, "list_price": 2000000, "seats_total": 10, "status": "OPEN"},
        )
        self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": d2, "list_price": 2500000, "seats_total": 15, "status": "OPEN"},
        )
        res_d3 = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={"depart_date": d3, "list_price": 3000000, "seats_total": 20, "status": "CLOSED"},
        )
        dep3_id = res_d3.json()["departure"]["id"]

        # 1. Danh sách toàn bộ
        res_all = self.client.get(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
        )
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()
        self.assertEqual(data_all["total"], 3)
        self.assertEqual(len(data_all["departures"]), 3)

        # 2. Lọc theo status = OPEN
        res_open = self.client.get(
            f"/api/operator/tours/{tour_id}/departures?status=OPEN",
            headers=self.headers_a,
        )
        self.assertEqual(res_open.status_code, 200)
        data_open = res_open.json()
        self.assertEqual(data_open["total"], 2)
        for dep in data_open["departures"]:
            self.assertEqual(dep["status"], "OPEN")

        # 3. Phân trang: page=1, page_size=2
        res_page = self.client.get(
            f"/api/operator/tours/{tour_id}/departures?page=1&page_size=2",
            headers=self.headers_a,
        )
        self.assertEqual(res_page.status_code, 200)
        data_page = res_page.json()
        self.assertEqual(data_page["total"], 3)
        self.assertEqual(len(data_page["departures"]), 2)

        # 4. Xem chi tiết theo nested route và flat route
        res_det_nested = self.client.get(
            f"/api/operator/tours/{tour_id}/departures/{dep3_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_det_nested.status_code, 200)
        self.assertEqual(res_det_nested.json()["departure"]["id"], dep3_id)

        res_det_flat = self.client.get(
            f"/api/operator/departures/{dep3_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_det_flat.status_code, 200)
        self.assertEqual(res_det_flat.json()["departure"]["status"], "CLOSED")

    def test_07_sale_price_phai_nho_hon_list_price(self):
        """P2: sale_price >= list_price phải bị chặn ở service (400), không để DB văng 500."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "sale-validate")
        ngay_ok = (date.today() + timedelta(days=10)).isoformat()

        payload = {
            "depart_date": ngay_ok,
            "list_price": 2000000,
            "sale_price": 2000000,
            "seats_total": 10,
        }
        res_bad = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json=payload,
        )
        self.assertEqual(res_bad.status_code, 400, res_bad.text)

        payload["sale_price"] = 1500000
        res_ok = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json=payload,
        )
        self.assertEqual(res_ok.status_code, 200, res_ok.text)
        dep_id = res_ok.json()["departure"]["id"]

        # Hạ list_price xuống dưới sale_price đang lưu -> 400
        res_lower = self.client.put(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}",
            headers=self.headers_a,
            json={"list_price": 1000000},
        )
        self.assertEqual(res_lower.status_code, 400, res_lower.text)

    def test_08_chi_tiet_seats_left_khong_duoc_oversell(self):
        """P2: seats_left truyền tường minh không được vượt chỗ thật còn trống (sau khi trừ sold)."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "seats-left-oversell")
        ngay_ok = (date.today() + timedelta(days=12)).isoformat()

        res_dep = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={
                "depart_date": ngay_ok,
                "list_price": 1000000,
                "seats_total": 20,
            },
        )
        self.assertEqual(res_dep.status_code, 200, res_dep.text)
        dep = res_dep.json()["departure"]
        dep_id = dep["id"]

        # Giữ 5 chỗ bằng booking
        tour_repo.create_booking({
            "code": "TX-PHASE53-OVERS-01",
            "tour_id": tour_id,
            "departure_id": dep_id,
            "full_name": "Khách Giữ 5 Chỗ",
            "phone": "0911223344",
            "guests": 5,
            "status": "PENDING_PAYMENT",
        })
        sold = tour_repo.get_departure_sold_seats(dep_id)
        self.assertEqual(sold, 5)

        # seats_left = 20 (lớn hơn 20-5=15) -> 400
        res_bad = self.client.put(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_left": 20},
        )
        self.assertEqual(res_bad.status_code, 400, res_bad.text)

        # seats_left = 15 -> hợp lệ
        res_ok = self.client.put(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}",
            headers=self.headers_a,
            json={"seats_left": 15},
        )
        self.assertEqual(res_ok.status_code, 200, res_ok.text)
