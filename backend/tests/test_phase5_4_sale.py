"""Kiểm thử Phase 5.4 — Operator đặt/gỡ giá SALE cho đợt khởi hành (UC-T03, BR-SL1..SL9, E13).

Bao gồm:
1. Set sale hợp lệ (cả nested và flat route) → GET trả sale + effective price.
2. Sale >= list_price → 400; sale âm/0 → 400; cửa sổ ends < starts → 400.
3. Gỡ sale (DELETE) → sale_price NULL, effective = list_price, discount_pct = 0.
4. Đợt có booking: tăng list_price → 400 (E13/BR-SL5); đặt sale → OK; booking cũ không đổi snapshot.
5. Khi sale hết hạn (giả lập thời điểm), giá hiệu lực quay về list_price.
6. BR-O1: Operator B cố đặt/gỡ sale của Operator A → 403 Forbidden; Admin thao tác được → 200 OK.
7. Đồng bộ price_from của tour theo giá bán hiệu lực thấp nhất khi đặt/gỡ sale.
8. Dọn dẹp dữ liệu test sạch sẽ trước và sau kiểm thử.
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
class TestPhase54Sale(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_email = "admin_phase5_4@test.vn"
        cls.op_a_email = "op_a_phase5_4@test.vn"
        cls.op_b_email = "op_b_phase5_4@test.vn"

        cls._cleanup_all()

        hp = hash_password("password123")

        # 1. Admin
        cls.admin_id = user_repo.create(
            email=cls.admin_email,
            hashed_password=hp,
            full_name="Admin Phase 5.4 Test",
            role="admin",
        )
        cls.admin_token = create_access_token({"sub": cls.admin_email})
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 2. Operator A
        cls.user_a_id = user_repo.create(
            email=cls.op_a_email,
            hashed_password=hp,
            full_name="Operator A Test (Phase 5.4)",
            role="operator",
        )
        cls.op_a_id = operator_repo.create_operator(
            user_id=cls.user_a_id,
            company_name="Công ty Du lịch A (Phase 5.4)",
            tax_code="TAX-A-54",
            status="ACTIVE",
        )
        cls.token_a = create_access_token({"sub": cls.op_a_email})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}

        # 3. Operator B
        cls.user_b_id = user_repo.create(
            email=cls.op_b_email,
            hashed_password=hp,
            full_name="Operator B Test (Phase 5.4)",
            role="operator",
        )
        cls.op_b_id = operator_repo.create_operator(
            user_id=cls.user_b_id,
            company_name="Công ty Du lịch B (Phase 5.4)",
            tax_code="TAX-B-54",
            status="ACTIVE",
        )
        cls.token_b = create_access_token({"sub": cls.op_b_email})
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_all()

    @classmethod
    def _cleanup_all(cls):
        """Dọn dẹp sạch sẽ toàn bộ tour, đợt và người dùng test Phase 5.4."""
        tours = execute_query(
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-4-%' OR name LIKE '%Phase 5.4%'"
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
            "SELECT id FROM tours WHERE slug LIKE 'tour-phase5-4-%' OR name LIKE '%Phase 5.4%'"
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
            "slug": f"tour-phase5-4-{slug_suffix}",
            "name": f"Tour Phase 5.4 Test {slug_suffix}",
            "duration_days": 2,
            "operator_id": op_id,
            "status": "ACTIVE",
        })

    def _tao_departure(self, tour_id: int, days_ahead: int = 10, list_price: int = 2000000) -> int:
        """Helper tạo departure hợp lệ."""
        today_vn = datetime.now(TZ_VN).date()
        dep_date = (today_vn + timedelta(days=days_ahead)).isoformat()
        res = self.client.post(
            f"/api/operator/tours/{tour_id}/departures",
            headers=self.headers_a,
            json={
                "depart_date": dep_date,
                "list_price": list_price,
                "seats_total": 20,
            },
        )
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["departure"]["id"]

    def test_01_set_sale_hop_le_va_get_tra_effective_price(self):
        """Yêu cầu 1: Set sale hợp lệ → GET trả sale + effective price + discount_pct."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "valid-sale")
        dep_id = self._tao_departure(tour_id, days_ahead=10, list_price=2000000)

        # 1. Đặt sale qua flat route PUT /api/operator/departures/{id}/sale: giá 1.500.000 (giảm 25%)
        res_put = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 1500000},
        )
        self.assertEqual(res_put.status_code, 200, res_put.text)
        data_put = res_put.json()
        self.assertTrue(data_put["success"])
        dep_put = data_put["departure"]
        self.assertEqual(dep_put["sale_price"], 1500000)
        self.assertEqual(dep_put["effective_price"], 1500000)
        self.assertEqual(dep_put["list_price"], 2000000)
        self.assertTrue(dep_put["is_sale"])
        self.assertEqual(dep_put["discount_pct"], 25)

        # 2. GET chi tiết qua flat route
        res_get = self.client.get(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_get.status_code, 200)
        dep_get = res_get.json()["departure"]
        self.assertEqual(dep_get["sale_price"], 1500000)
        self.assertEqual(dep_get["effective_price"], 1500000)
        self.assertEqual(dep_get["list_price"], 2000000)
        self.assertTrue(dep_get["is_sale"])
        self.assertEqual(dep_get["discount_pct"], 25)

        # 3. GET chi tiết qua nested route
        res_get_nested = self.client.get(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_get_nested.status_code, 200)
        self.assertEqual(res_get_nested.json()["departure"]["effective_price"], 1500000)

        # 4. Kiểm tra price_from của tour được đồng bộ theo giá bán hiệu lực
        tour = tour_repo.get_tour_by_id(tour_id)
        self.assertEqual(tour["price_from"], 1500000)

        # 5. Cập nhật sale qua nested route kèm cửa sổ thời gian hợp lệ (starts <= ends)
        now_vn = datetime.now(TZ_VN)
        starts = (now_vn - timedelta(hours=1)).isoformat()
        ends = (now_vn + timedelta(days=5)).isoformat()

        res_nested_put = self.client.put(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={
                "sale_price": 1200000,
                "sale_starts_at": starts,
                "sale_ends_at": ends,
            },
        )
        self.assertEqual(res_nested_put.status_code, 200, res_nested_put.text)
        dep_nested = res_nested_put.json()["departure"]
        self.assertEqual(dep_nested["sale_price"], 1200000)
        self.assertEqual(dep_nested["effective_price"], 1200000)
        self.assertEqual(dep_nested["discount_pct"], 40)

        tour = tour_repo.get_tour_by_id(tour_id)
        self.assertEqual(tour["price_from"], 1200000)

    def test_02_validation_sale_price_va_cua_so_thoi_gian(self):
        """Yêu cầu 2:
        - Sale >= list_price → 400
        - Sale <= 0 / âm → 400
        - Cửa sổ ends < starts → 400
        """
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "sale-validation")
        dep_id = self._tao_departure(tour_id, days_ahead=12, list_price=2000000)

        # 1. Sale = list_price (2.000.000) → 400
        res_equal = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 2000000},
        )
        self.assertEqual(res_equal.status_code, 400)
        self.assertIn("nhỏ hơn giá gốc", res_equal.json()["detail"])

        # 2. Sale > list_price (2.500.000) → 400
        res_greater = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 2500000},
        )
        self.assertEqual(res_greater.status_code, 400)
        self.assertIn("nhỏ hơn giá gốc", res_greater.json()["detail"])

        # 3. Sale = 0 → 400
        res_zero = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 0},
        )
        self.assertEqual(res_zero.status_code, 400)
        self.assertIn("lớn hơn 0", res_zero.json()["detail"])

        # 4. Sale âm (-500.000) → 400
        res_neg = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": -500000},
        )
        self.assertEqual(res_neg.status_code, 400)
        self.assertIn("lớn hơn 0", res_neg.json()["detail"])

        # 5. Cửa sổ ends < starts → 400 (Rule 2)
        now_vn = datetime.now(TZ_VN)
        starts = (now_vn + timedelta(days=5)).isoformat()
        ends = (now_vn + timedelta(days=2)).isoformat()  # ends < starts

        res_bad_window = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={
                "sale_price": 1600000,
                "sale_starts_at": starts,
                "sale_ends_at": ends,
            },
        )
        self.assertEqual(res_bad_window.status_code, 400)
        self.assertIn("lớn hơn hoặc bằng", res_bad_window.json()["detail"])

    def test_03_go_sale_tra_ve_list_price(self):
        """Yêu cầu 3: Gỡ sale → sale_price NULL, effective = list_price, discount_pct = 0."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "remove-sale")
        dep_id = self._tao_departure(tour_id, days_ahead=15, list_price=3000000)

        # Đặt sale 2.100.000 (giảm 30%) kèm cửa sổ
        now_vn = datetime.now(TZ_VN)
        self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={
                "sale_price": 2100000,
                "sale_starts_at": now_vn.isoformat(),
                "sale_ends_at": (now_vn + timedelta(days=3)).isoformat(),
            },
        )

        tour_mid = tour_repo.get_tour_by_id(tour_id)
        self.assertEqual(tour_mid["price_from"], 2100000)

        # Gỡ sale qua DELETE /api/operator/departures/{id}/sale
        res_del = self.client.delete(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
        )
        self.assertEqual(res_del.status_code, 200, res_del.text)
        del_data = res_del.json()
        self.assertTrue(del_data["success"])
        dep_after = del_data["departure"]
        self.assertIsNone(dep_after["sale_price"])
        self.assertIsNone(dep_after["sale_starts_at"])
        self.assertIsNone(dep_after["sale_ends_at"])
        self.assertEqual(dep_after["effective_price"], 3000000)
        self.assertEqual(dep_after["list_price"], 3000000)
        self.assertFalse(dep_after["is_sale"])
        self.assertEqual(dep_after["discount_pct"], 0)

        # GET lại xác nhận sạch trong CSDL
        res_get = self.client.get(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
        )
        self.assertEqual(res_get.status_code, 200)
        dep_get = res_get.json()["departure"]
        self.assertIsNone(dep_get["sale_price"])
        self.assertEqual(dep_get["effective_price"], 3000000)

        # price_from của tour được đồng bộ lại về list_price (3.000.000)
        tour_after = tour_repo.get_tour_by_id(tour_id)
        self.assertEqual(tour_after["price_from"], 3000000)

        # Thử lại gỡ sale qua nested route DELETE /api/operator/tours/{tour_id}/departures/{id}/sale
        # 1. Đặt lại sale
        self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 2500000},
        )
        # 2. Xoá qua nested route
        res_del_nested = self.client.delete(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}/sale",
            headers=self.headers_a,
        )
        self.assertEqual(res_del_nested.status_code, 200)
        self.assertIsNone(res_del_nested.json()["departure"]["sale_price"])

    def test_04_e13_br_sl5_chan_tang_list_price_khi_co_booking(self):
        """Yêu cầu 4 (E13 / BR-SL5):
        - Đợt đã có booking (đang giữ/đã bán): operator tăng list_price → 400.
        - Giảm list_price hoặc đặt sale → OK.
        - Đổi sale không làm thay đổi snapshot booking cũ (unit_list_price, unit_sale_price, total_price).
        """
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "e13-rule")
        dep_id = self._tao_departure(tour_id, days_ahead=20, list_price=2000000)

        # 1. Khách đặt 2 chỗ khi giá là 2.000.000
        booking = tour_service.book({
            "tour_id": tour_id,
            "departure_id": dep_id,
            "full_name": "Khách Booking Test E13",
            "phone": "0912345678",
            "guests": 2,
        })
        b_id = booking["id"]
        saved_b = tour_repo.get_booking(b_id)
        self.assertEqual(saved_b["unit_list_price"], 2000000)
        self.assertEqual(saved_b["total_price"], 4000000)

        # 2. Operator cố tình tăng list_price lên 3.000.000 → 400 (E13/BR-SL5)
        res_up_flat = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"list_price": 3000000},
        )
        self.assertEqual(res_up_flat.status_code, 400)
        self.assertIn("BR-SL5/E13", res_up_flat.json()["detail"])

        res_up_nested = self.client.put(
            f"/api/operator/tours/{tour_id}/departures/{dep_id}",
            headers=self.headers_a,
            json={"list_price": 2500000},
        )
        self.assertEqual(res_up_nested.status_code, 400)
        self.assertIn("BR-SL5/E13", res_up_nested.json()["detail"])

        # 3. Operator giảm list_price xuống 1.800.000 → OK (200)
        res_reduce = self.client.put(
            f"/api/operator/departures/{dep_id}",
            headers=self.headers_a,
            json={"list_price": 1800000},
        )
        self.assertEqual(res_reduce.status_code, 200, res_reduce.text)
        self.assertEqual(res_reduce.json()["departure"]["list_price"], 1800000)

        # 4. Operator đặt sale 1.400.000 → OK (200)
        res_sale = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={"sale_price": 1400000},
        )
        self.assertEqual(res_sale.status_code, 200, res_sale.text)
        self.assertEqual(res_sale.json()["departure"]["sale_price"], 1400000)
        self.assertEqual(res_sale.json()["departure"]["effective_price"], 1400000)

        # 5. Kiểm tra booking cũ: snapshot hoàn toàn KHÔNG đổi
        b_after = tour_repo.get_booking(b_id)
        self.assertEqual(b_after["unit_list_price"], 2000000)
        self.assertIsNone(b_after["unit_sale_price"])
        self.assertEqual(b_after["total_price"], 4000000)

    def test_05_khi_sale_het_han_gia_hieu_luc_quay_ve_list_price(self):
        """Yêu cầu 5: Khi sale hết hạn (cửa sổ thời gian đã qua), giá hiệu lực tự động quay về list_price."""
        tour_id = self._tao_tour_cho_operator(self.op_a_id, "expired-sale")
        dep_id = self._tao_departure(tour_id, days_ahead=25, list_price=2400000)

        now_vn = datetime.now(TZ_VN)
        # Giả lập thời điểm kết thúc sale trong quá khứ
        past_start = (now_vn - timedelta(days=5)).isoformat()
        past_end = (now_vn - timedelta(days=1)).isoformat()

        # Đặt sale với cửa sổ đã kết thúc
        res_put = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_a,
            json={
                "sale_price": 1800000,
                "sale_starts_at": past_start,
                "sale_ends_at": past_end,
            },
        )
        self.assertEqual(res_put.status_code, 200)
        dep_data = res_put.json()["departure"]
        # sale_price vẫn lưu vết nhưng effective_price quay về list_price vì sale_ends_at < now
        self.assertEqual(dep_data["sale_price"], 1800000)
        self.assertEqual(dep_data["effective_price"], 2400000)
        self.assertFalse(dep_data["is_sale"])
        self.assertEqual(dep_data["discount_pct"], 0)

        # Kiểm tra hàm dùng chung gia_ban_hieu_luc với thời điểm giả lập
        future_dt = now_vn + timedelta(days=10)
        raw_dep = tour_repo.get_departure_by_id(dep_id)
        self.assertEqual(tour_service.gia_ban_hieu_luc(raw_dep, thoi_diem=future_dt), 2400000)

        # Khi giả lập thời điểm nằm trong cửa sổ quá khứ -> trả đúng sale_price
        in_window_dt = now_vn - timedelta(days=3)
        self.assertEqual(tour_service.gia_ban_hieu_luc(raw_dep, thoi_diem=in_window_dt), 1800000)

    def test_06_br_o1_phan_quyen_operator_va_admin(self):
        """Kiểm tra bảo mật BR-O1:
        - Operator B không được đặt hoặc gỡ sale trên đợt của Operator A (403).
        - Admin có toàn quyền thao tác trên đợt của bất kỳ operator nào (200).
        """
        tour_a_id = self._tao_tour_cho_operator(self.op_a_id, "op-a-sec")
        dep_id = self._tao_departure(tour_a_id, days_ahead=15, list_price=2000000)

        # 1. Operator B cố đặt sale trên đợt của A (cả flat và nested) → 403
        res_b_flat = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_b,
            json={"sale_price": 1500000},
        )
        self.assertEqual(res_b_flat.status_code, 403)
        self.assertIn("BR-O1", res_b_flat.json()["detail"])

        res_b_nested = self.client.put(
            f"/api/operator/tours/{tour_a_id}/departures/{dep_id}/sale",
            headers=self.headers_b,
            json={"sale_price": 1500000},
        )
        self.assertEqual(res_b_nested.status_code, 403)

        # 2. Operator B cố gỡ sale trên đợt của A → 403
        res_b_del_flat = self.client.delete(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_del_flat.status_code, 403)

        res_b_del_nested = self.client.delete(
            f"/api/operator/tours/{tour_a_id}/departures/{dep_id}/sale",
            headers=self.headers_b,
        )
        self.assertEqual(res_b_del_nested.status_code, 403)

        # 3. Admin đặt sale thành công → 200
        res_admin_put = self.client.put(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.admin_headers,
            json={"sale_price": 1600000},
        )
        self.assertEqual(res_admin_put.status_code, 200)
        self.assertEqual(res_admin_put.json()["departure"]["sale_price"], 1600000)

        # 4. Admin gỡ sale thành công → 200
        res_admin_del = self.client.delete(
            f"/api/operator/departures/{dep_id}/sale",
            headers=self.admin_headers,
        )
        self.assertEqual(res_admin_del.status_code, 200)
        self.assertIsNone(res_admin_del.json()["departure"]["sale_price"])
