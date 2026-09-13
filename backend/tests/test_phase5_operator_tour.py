"""Kiểm thử Phase 5.1 & 5.2 — Vai trò Tour Operator & CRUD Tour của Operator.

Bao gồm:
1. Admin tạo 2 operator A và B qua POST /api/admin/operators. Kiểm tra chặn email trùng, xem danh sách.
2. Operator A tạo tour -> A thấy được; B truy cập/sửa/xoá tour của A -> 403 Forbidden (BR-O1).
3. Admin xem và sửa/xoá được tour bất kỳ.
4. Tour có booking CONFIRMED -> sửa itinerary, duration_days, cancellation_policy bị chặn 400 (BR-T3).
5. Tour đang ACTIVE -> chỉ cho đổi mô tả/ảnh/highlights/included/excluded (BR-T4).
6. Xoá tour có booking -> chuyển sang INACTIVE (xoá mềm); xoá tour chưa có booking -> xoá cứng (BR-T5).
7. Dọn dẹp dữ liệu sạch sẽ trước và sau khi test.
"""

import json
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


def _db_available():
    try:
        execute_query("SELECT 1 FROM tours LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "Cần CSDL Postgres có bảng tours và operators")


@requires_db
class TestPhase5OperatorTour(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_email = "admin_phase5@test.vn"
        cls.op_a_email = "op_a_phase5@test.vn"
        cls.op_b_email = "op_b_phase5@test.vn"

        cls._cleanup_all()

        # Tạo tài khoản admin test
        hp = hash_password("admin123")
        cls.admin_id = user_repo.create(
            email=cls.admin_email,
            hashed_password=hp,
            full_name="Admin Phase 5 Test",
            role="admin",
        )
        cls.admin_token = create_access_token({"sub": cls.admin_email})
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_all()

    @classmethod
    def _cleanup_all(cls):
        """Dọn dẹp sạch sẽ tất cả dữ liệu tạo ra trong test."""
        # 1. Xóa payments & history & bookings của các tour test
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-%' OR name LIKE '%Phase 5%'"
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

        # 2. Xóa operators và users test
        test_emails = [cls.admin_email, cls.op_a_email, cls.op_b_email]
        users = execute_query("SELECT id FROM users WHERE email = ANY(%s)", (test_emails,)) or []
        user_ids = [u["id"] for u in users]
        if user_ids:
            execute_query("DELETE FROM operators WHERE user_id = ANY(%s)", (user_ids,))
            execute_query("DELETE FROM users WHERE id = ANY(%s)", (user_ids,))

    def setUp(self):
        # Đảm bảo dọn các tour sinh ra trong từng test
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-%' OR name LIKE '%Phase 5%'"
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

    def test_01_admin_tao_operators_va_phan_quyen(self):
        """Yêu cầu 5.1: Admin tạo 2 operator A và B, kiểm tra trùng email và danh sách."""
        # 1. Admin tạo Operator A
        res_a = self.client.post(
            "/api/admin/operators",
            headers=self.admin_headers,
            json={
                "email": self.op_a_email,
                "password": "password123",
                "full_name": "Nguyễn Văn A",
                "company_name": "Công ty Du lịch Biển Xanh",
                "tax_code": "0123456789",
                "commission_rate": 0.12,
            },
        )
        self.assertEqual(res_a.status_code, 200, res_a.text)
        data_a = res_a.json()["operator"]
        self.assertEqual(data_a["email"], self.op_a_email)
        self.assertEqual(data_a["company_name"], "Công ty Du lịch Biển Xanh")
        self.assertEqual(data_a["status"], "ACTIVE")

        # 2. Tạo lại với cùng email -> Phải nhận 400
        res_dup = self.client.post(
            "/api/admin/operators",
            headers=self.admin_headers,
            json={
                "email": self.op_a_email,
                "password": "pass",
                "full_name": "Người Trùng Email",
                "company_name": "Công ty Trùng",
            },
        )
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("Email đã được sử dụng", res_dup.json()["detail"])

        # 3. Admin tạo Operator B
        res_b = self.client.post(
            "/api/admin/operators",
            headers=self.admin_headers,
            json={
                "email": self.op_b_email,
                "password": "password456",
                "full_name": "Trần Thị B",
                "company_name": "Công ty Lữ hành Núi Vàng",
                "tax_code": "0987654321",
                "commission_rate": 0.10,
            },
        )
        self.assertEqual(res_b.status_code, 200, res_b.text)
        data_b = res_b.json()["operator"]
        self.assertEqual(data_b["email"], self.op_b_email)

        # 4. Admin lấy danh sách operator
        res_list = self.client.get("/api/admin/operators", headers=self.admin_headers)
        self.assertEqual(res_list.status_code, 200)
        ops = res_list.json()["operators"]
        emails = [o["email"] for o in ops]
        self.assertIn(self.op_a_email, emails)
        self.assertIn(self.op_b_email, emails)

    def test_02_operator_crud_tour_va_chan_truy_cap_cheo_br_o1(self):
        """Yêu cầu 5.2 & BR-O1: A tạo tour, A thấy được; B truy cập/sửa/xoá tour A -> 403."""
        # Đăng nhập lấy token của A và B
        login_a = self.client.post(
            "/api/auth/login",
            json={"email": self.op_a_email, "password": "password123"},
        )
        self.assertEqual(login_a.status_code, 200)
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        login_b = self.client.post(
            "/api/auth/login",
            json={"email": self.op_b_email, "password": "password456"},
        )
        self.assertEqual(login_b.status_code, 200)
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 1. Operator A tạo tour mới
        tour_payload = {
            "slug": "tour-phase5-danang-a",
            "name": "Phase 5 Tour Đà Nẵng của A",
            "summary": "Mô tả ngắn của tour A",
            "description": "Mô tả chi tiết tour A",
            "duration_days": 3,
            "price_from": 2500000,
            "highlights": ["Bà Nà", "Cầu Rồng"],
            "itinerary": [
                {"day": 1, "title": "Đón khách sân bay"},
                {"day": 2, "title": "Bà Nà Hills"},
                {"day": 3, "title": "Bán đảo Sơn Trà"},
            ],
            "included": ["Xe đưa đón", "Bữa sáng"],
            "excluded": ["Vé cáp treo"],
            "cancellation_policy": [{"days_before": 7, "refund_percent": 100}],
            "status": "DRAFT",
        }
        res_create = self.client.post(
            "/api/operator/tours",
            headers=headers_a,
            json=tour_payload,
        )
        self.assertEqual(res_create.status_code, 200, res_create.text)
        tour_a = res_create.json()["tour"]
        tour_a_id = tour_a["id"]
        self.assertEqual(tour_a["slug"], "tour-phase5-danang-a")
        self.assertIsNotNone(tour_a["operator_id"])

        # 2. Operator A xem danh sách tour của mình -> Thấy tour_a
        res_list_a = self.client.get("/api/operator/tours", headers=headers_a)
        self.assertEqual(res_list_a.status_code, 200)
        tour_ids_a = [t["id"] for t in res_list_a.json()["tours"]]
        self.assertIn(tour_a_id, tour_ids_a)

        # 3. Operator A xem chi tiết tour của mình -> 200 OK
        res_get_a = self.client.get(f"/api/operator/tours/{tour_a_id}", headers=headers_a)
        self.assertEqual(res_get_a.status_code, 200)

        # 4. Operator B xem danh sách tour -> KHÔNG có tour của A
        res_list_b = self.client.get("/api/operator/tours", headers=headers_b)
        self.assertEqual(res_list_b.status_code, 200)
        tour_ids_b = [t["id"] for t in res_list_b.json()["tours"]]
        self.assertNotIn(tour_a_id, tour_ids_b)

        # 5. BR-O1: Operator B truy cập chi tiết tour của A -> 403 Forbidden
        res_get_b = self.client.get(f"/api/operator/tours/{tour_a_id}", headers=headers_b)
        self.assertEqual(res_get_b.status_code, 403)

        # 6. BR-O1: Operator B sửa tour của A -> 403 Forbidden
        res_put_b = self.client.put(
            f"/api/operator/tours/{tour_a_id}",
            headers=headers_b,
            json={"name": "Tên bị B sửa trộm"},
        )
        self.assertEqual(res_put_b.status_code, 403)

        # 7. BR-O1: Operator B xoá tour của A -> 403 Forbidden
        res_del_b = self.client.delete(f"/api/operator/tours/{tour_a_id}", headers=headers_b)
        self.assertEqual(res_del_b.status_code, 403)

    def test_03_admin_co_toan_quyen_tren_tour(self):
        """Admin có quyền xem, sửa, xoá bất kỳ tour nào."""
        # 1. Tạo tour cho Operator A
        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )
        tour_id = tour_repo.create_tour({
            "slug": "tour-phase5-admin-edit",
            "name": "Tour Phase 5 Cho Admin Test",
            "duration_days": 2,
            "operator_id": op_a["id"],
            "status": "DRAFT",
        })

        # 2. Admin xem chi tiết tour của Operator A -> 200 OK
        res_get = self.client.get(f"/api/operator/tours/{tour_id}", headers=self.admin_headers)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.json()["tour"]["name"], "Tour Phase 5 Cho Admin Test")

        # 3. Admin cập nhật tour của Operator A -> 200 OK
        res_put = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=self.admin_headers,
            json={
                "name": "Tour Phase 5 Đã Được Admin Cập Nhật",
                "summary": "Tóm tắt mới từ admin",
            },
        )
        self.assertEqual(res_put.status_code, 200)
        self.assertEqual(res_put.json()["tour"]["name"], "Tour Phase 5 Đã Được Admin Cập Nhật")

        # 4. Admin lọc danh sách theo operator_id
        res_list = self.client.get(
            f"/api/operator/tours?operator_id={op_a['id']}",
            headers=self.admin_headers,
        )
        self.assertEqual(res_list.status_code, 200)
        ids = [t["id"] for t in res_list.json()["tours"]]
        self.assertIn(tour_id, ids)

    def test_04_br_t3_khoa_lich_trinh_khi_co_booking_confirmed(self):
        """BR-T3: Tour có booking CONFIRMED thì chặn đổi itinerary, duration_days, cancellation_policy."""
        login_a = self.client.post(
            "/api/auth/login",
            json={"email": self.op_a_email, "password": "password123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        # 1. Tạo tour
        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )
        tour_id = tour_repo.create_tour({
            "slug": "tour-phase5-confirmed-brt3",
            "name": "Tour Phase 5 Có Booking Confirmed",
            "duration_days": 3,
            "itinerary": [
                {"day": 1, "title": "Ngày 1"},
                {"day": 2, "title": "Ngày 2"},
                {"day": 3, "title": "Ngày 3"},
            ],
            "cancellation_policy": [{"days_before": 10, "refund_percent": 100}],
            "operator_id": op_a["id"],
            "status": "DRAFT",
        })

        # 2. Tạo đợt khởi hành và một booking ở trạng thái CONFIRMED
        depart_date = date.today() + timedelta(days=20)
        tour_repo.add_departure(tour_id, depart_date, list_price=2000000, seats=10)
        deps = tour_repo.departures(tour_id)
        dep_id = deps[0]["id"]

        booking_id = tour_repo.create_booking({
            "code": "TX-PHASE5-CONFIRMED-01",
            "tour_id": tour_id,
            "departure_id": dep_id,
            "full_name": "Khách Test Confirmed",
            "phone": "0988888888",
            "guests": 2,
            "unit_list_price": 2000000,
            "total_price": 4000000,
            "status": "CONFIRMED",
        })

        # 3. Cố tình sửa duration_days -> 400 Bad Request
        res_dur = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"duration_days": 4},
        )
        self.assertEqual(res_dur.status_code, 400)
        self.assertIn("BR-T3", res_dur.json()["detail"])

        # 4. Cố tình sửa itinerary -> 400 Bad Request
        res_itin = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"itinerary": [{"day": 1, "title": "Lịch trình đã bị đổi"}]},
        )
        self.assertEqual(res_itin.status_code, 400)
        self.assertIn("BR-T3", res_itin.json()["detail"])

        # 5. Cố tình sửa cancellation_policy -> 400 Bad Request
        res_pol = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"cancellation_policy": [{"days_before": 1, "refund_percent": 0}]},
        )
        self.assertEqual(res_pol.status_code, 400)
        self.assertIn("BR-T3", res_pol.json()["detail"])

        # 6. Sửa các trường được phép (summary, description, highlights) -> 200 OK
        res_ok = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={
                "summary": "Mô tả ngắn mới cập nhật an toàn",
                "highlights": ["Điểm nhấn mới 1", "Điểm nhấn mới 2"],
            },
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.json()["tour"]["summary"], "Mô tả ngắn mới cập nhật an toàn")

    def test_05_br_t4_tour_active_han_che_sua(self):
        """BR-T4: Tour ACTIVE chỉ cho đổi mô tả/ảnh/highlights/included/excluded."""
        login_a = self.client.post(
            "/api/auth/login",
            json={"email": self.op_a_email, "password": "password123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )
        tour_id = tour_repo.create_tour({
            "slug": "tour-phase5-active-brt4",
            "name": "Tour Phase 5 Đang Active",
            "duration_days": 2,
            "operator_id": op_a["id"],
            "status": "ACTIVE",
        })

        # 1. Sửa mô tả / highlights khi đang ACTIVE -> Thành công (200 OK)
        res_ok = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={
                "summary": "Tóm tắt mới cho tour active",
                "highlights": ["Check-in Cầu Vàng", "Buffet trưa"],
                "included": ["Xe đưa đón", "Ăn trưa"],
                "excluded": ["Chi phí cá nhân"],
            },
        )
        self.assertEqual(res_ok.status_code, 200)

        # 2. Cố đổi duration_days khi đang ACTIVE -> 400 Bad Request
        res_dur = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"duration_days": 5},
        )
        self.assertEqual(res_dur.status_code, 400)
        self.assertIn("BR-T4", res_dur.json()["detail"])

        # 3. Chuyển tour về DRAFT thì sửa được tự do
        res_draft = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"status": "DRAFT"},
        )
        self.assertEqual(res_draft.status_code, 200)
        self.assertEqual(res_draft.json()["tour"]["status"], "DRAFT")

        # Bây giờ sửa duration_days thành 5 -> 200 OK
        res_dur_ok = self.client.put(
            f"/api/operator/tours/{tour_id}",
            headers=headers_a,
            json={"duration_days": 5},
        )
        self.assertEqual(res_dur_ok.status_code, 200)
        self.assertEqual(res_dur_ok.json()["tour"]["duration_days"], 5)

    def test_06_br_t5_xoa_tour_mem_khi_co_booking_xoa_cung_khi_chua_co(self):
        """BR-T5: Xoá mềm (status=INACTIVE) khi đã có booking, xoá cứng khi chưa từng có booking."""
        login_a = self.client.post(
            "/api/auth/login",
            json={"email": self.op_a_email, "password": "password123"},
        )
        headers_a = {"Authorization": f"Bearer {login_a.json()['access_token']}"}

        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )

        # Trường hợp 1: Tour CHƯA TỪNG có booking -> Xoá cứng
        tour_no_booking_id = tour_repo.create_tour({
            "slug": "tour-phase5-no-booking",
            "name": "Tour Chưa Có Booking",
            "duration_days": 1,
            "operator_id": op_a["id"],
            "status": "DRAFT",
        })
        res_del_hard = self.client.delete(
            f"/api/operator/tours/{tour_no_booking_id}",
            headers=headers_a,
        )
        self.assertEqual(res_del_hard.status_code, 200)
        self.assertFalse(res_del_hard.json()["soft_deleted"])

        # Kiểm tra tour đã biến mất khỏi CSDL
        res_check_hard = self.client.get(
            f"/api/operator/tours/{tour_no_booking_id}",
            headers=headers_a,
        )
        self.assertEqual(res_check_hard.status_code, 404)

        # Trường hợp 2: Tour ĐÃ CÓ booking -> Xoá mềm (chuyển sang INACTIVE)
        tour_with_booking_id = tour_repo.create_tour({
            "slug": "tour-phase5-with-booking",
            "name": "Tour Đã Từng Có Booking",
            "duration_days": 2,
            "operator_id": op_a["id"],
            "status": "ACTIVE",
        })
        tour_repo.create_booking({
            "code": "TX-PHASE5-BOOKING-01",
            "tour_id": tour_with_booking_id,
            "full_name": "Khách Đặt Giữ Chỗ",
            "phone": "0911223344",
            "guests": 1,
            "status": "PENDING_PAYMENT",
        })

        res_del_soft = self.client.delete(
            f"/api/operator/tours/{tour_with_booking_id}",
            headers=headers_a,
        )
        self.assertEqual(res_del_soft.status_code, 200)
        self.assertTrue(res_del_soft.json()["soft_deleted"])

        # Kiểm tra tour vẫn còn trong CSDL nhưng status = 'INACTIVE' và active = False
        res_check_soft = self.client.get(
            f"/api/operator/tours/{tour_with_booking_id}",
            headers=headers_a,
        )
        self.assertEqual(res_check_soft.status_code, 200)
        t_data = res_check_soft.json()["tour"]
        self.assertEqual(t_data["status"], "INACTIVE")
        self.assertFalse(t_data["active"])

    def _login(self, email, password):
        res = self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(res.status_code, 200, res.text)
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_07_admin_tao_tour_phai_gan_operator(self):
        """P2: Admin tạo tour qua /api/operator/tours phải có operator_id."""
        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )
        base_payload = {
            "name": "Tour Admin Tạo Cho Operator A",
            "duration_days": 2,
            "price_from": 2000000,
            "status": "DRAFT",
        }

        # Thiếu operator_id -> 400, không tạo tour mồ côi
        res_no_owner = self.client.post(
            "/api/operator/tours",
            headers=self.admin_headers,
            json=base_payload,
        )
        self.assertEqual(res_no_owner.status_code, 400, res_no_owner.text)

        # Có operator_id -> tạo thành công và tour gắn đúng chủ
        res_ok = self.client.post(
            "/api/operator/tours",
            headers=self.admin_headers,
            json={**base_payload, "operator_id": op_a["id"], "slug": "tour-phase5-admin-owner"},
        )
        self.assertEqual(res_ok.status_code, 200, res_ok.text)
        created = res_ok.json()["tour"]
        self.assertEqual(created["operator_id"], op_a["id"])

    def test_08_trung_slug_voi_draft_inactive_bi_chan(self):
        """P1: Slug trùng với tour DRAFT/INACTIVE phải bị chặn, không upsert đè."""
        headers_b = self._login(self.op_b_email, "password456")
        headers_a = self._login(self.op_a_email, "password123")

        op_a = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_a_email)["id"]
        )
        op_b = operator_repo.find_by_user_id(
            user_repo.find_by_email(self.op_b_email)["id"]
        )

        # Tour DRAFT của A dùng slug sẵn có
        tour_a = tour_repo.create_tour({
            "slug": "tour-phase5-draft-bi-chiem",
            "name": "Tour DRAFT Của A",
            "duration_days": 2,
            "operator_id": op_a["id"],
            "status": "DRAFT",
        })

        # B cố tạo cùng slug -> 400 và KHÔNG được ghi đè tour A
        res_b = self.client.post(
            "/api/operator/tours",
            headers=headers_b,
            json={
                "slug": "tour-phase5-draft-bi-chiem",
                "name": "Tour Trùng Slug Của B",
                "duration_days": 2,
                "status": "DRAFT",
            },
        )
        self.assertEqual(res_b.status_code, 400, res_b.text)
        after = tour_repo.get_tour_by_id(tour_a)
        self.assertEqual(after["operator_id"], op_a["id"])
        self.assertEqual(after["name"], "Tour DRAFT Của A")

        # A đổi slug sang slug của tour B (DRAFT) -> 400
        tour_b = tour_repo.create_tour({
            "slug": "tour-phase5-draft-cua-b",
            "name": "Tour DRAFT Của B",
            "duration_days": 2,
            "operator_id": op_b["id"],
            "status": "DRAFT",
        })
        res_put = self.client.put(
            f"/api/operator/tours/{tour_a}",
            headers=headers_a,
            json={"slug": "tour-phase5-draft-cua-b"},
        )
        self.assertEqual(res_put.status_code, 400, res_put.text)

        # Soft delete tour A -> INACTIVE, B vẫn không chiếm được slug cũ
        tour_repo.create_booking({
            "code": "TX-PHASE5-DRAFT-SLUG-01",
            "tour_id": tour_a,
            "full_name": "Khách Giữ Chỗ",
            "phone": "0900123456",
            "guests": 1,
            "status": "PENDING_PAYMENT",
        })
        self.client.delete(f"/api/operator/tours/{tour_a}", headers=headers_a)
        res_after_inactive = self.client.post(
            "/api/operator/tours",
            headers=headers_b,
            json={
                "slug": "tour-phase5-draft-bi-chiem",
                "name": "Tour Thử Lại Slug INACTIVE",
                "duration_days": 2,
                "status": "DRAFT",
            },
        )
        self.assertEqual(res_after_inactive.status_code, 400, res_after_inactive.text)
        self.assertIsNotNone(tour_repo.get_tour_by_id(tour_a))
        self.assertEqual(tour_repo.get_tour_by_id(tour_a)["status"], "INACTIVE")


if __name__ == "__main__":
    unittest.main()
