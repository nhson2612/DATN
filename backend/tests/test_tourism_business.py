"""Kiểm thử các nghiệp vụ cơ bản của website du lịch.

Phủ: trang điểm đến, danh sách + bộ lọc, chi tiết địa điểm, yêu thích, yêu cầu
đặt chỗ. Đây là những nghiệp vụ mà mọi trang du lịch đều có nhưng hệ thống này
trước đó thiếu hoàn toàn — nó chỉ trả lời được "có gì gần đây".

Test đi qua HTTP (TestClient) chứ không gọi thẳng service, để bắt được cả lỗi
đăng ký router, phân quyền và mã trạng thái.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services.destination_service import slugify  # noqa: E402


def _db_available():
    try:
        from app.core.database import execute_query
        execute_query("SELECT 1 FROM province_stats LIMIT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "cần PostGIS có province_stats")


class TestSlugify(unittest.TestCase):
    """Slug là URL của trang điểm đến nên phải bỏ được tiền tố hành chính."""

    def test_bo_tien_to_thanh_pho(self):
        self.assertEqual(slugify("Thành phố Đà Nẵng"), "da-nang")

    def test_bo_tien_to_tinh(self):
        self.assertEqual(slugify("Tỉnh Lâm Đồng"), "lam-dong")

    def test_giu_nguyen_ten_khong_tien_to(self):
        self.assertEqual(slugify("Hội An"), "hoi-an")

    def test_khong_sinh_dau_gach_thua(self):
        self.assertEqual(slugify("  Bà Rịa - Vũng Tàu  "), "ba-ria-vung-tau")


@requires_db
class TestDiemDen(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)

    def test_danh_sach_diem_den(self):
        d = self.c.get("/api/destinations?limit=5").json()
        self.assertTrue(d["destinations"])
        for x in d["destinations"]:
            self.assertGreater(x["so_dia_diem"], 0)
            self.assertTrue(x["slug"])

    def test_sap_theo_so_dia_diem_giam_dan(self):
        ds = self.c.get("/api/destinations?limit=10").json()["destinations"]
        so = [x["so_dia_diem"] for x in ds]
        self.assertEqual(so, sorted(so, reverse=True))

    def test_chi_tiet_diem_den_co_du_nhom(self):
        d = self.c.get("/api/destinations/da-nang").json()
        self.assertIn("Đà Nẵng", d["name"])
        ten_nhom = {g["ten"] for g in d["groups"]}
        # Một trang điểm đến phải trả lời được "xem gì, ăn gì, ngủ đâu".
        self.assertIn("Tham quan", ten_nhom)
        self.assertIn("Ăn uống", ten_nhom)
        self.assertIn("Nơi lưu trú", ten_nhom)

    def test_diem_den_khong_ton_tai(self):
        self.assertEqual(self.c.get("/api/destinations/khong-co-dau").status_code, 404)

    def test_nhan_ca_ten_co_dau_lan_slug(self):
        a = self.c.get("/api/destinations/da-nang").json()["name"]
        b = self.c.get("/api/destinations/Đà Nẵng").json()["name"]
        self.assertEqual(a, b)


@requires_db
class TestBoLocDiaDiem(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)

    def test_loc_theo_diem_den(self):
        d = self.c.get("/api/places/search?destination=da-nang&page_size=5").json()
        self.assertTrue(d["items"])
        self.assertGreater(d["total"], 0)

    def test_loc_theo_nhom(self):
        d = self.c.get("/api/places/search?destination=da-nang&nhom=tham_quan&page_size=5").json()
        self.assertTrue(d["items"])

    def test_loc_theo_category_cu_the(self):
        d = self.c.get("/api/places/search?destination=da-nang&category=beach&page_size=5").json()
        for x in d["items"]:
            self.assertEqual(x["category"], "beach")

    def test_loc_theo_tu_khoa(self):
        d = self.c.get("/api/places/search?destination=da-nang&q=chùa&page_size=5").json()
        self.assertTrue(d["items"])

    def test_phan_trang_khong_lap_ket_qua(self):
        p1 = self.c.get("/api/places/search?destination=da-nang&page=1&page_size=5").json()["items"]
        p2 = self.c.get("/api/places/search?destination=da-nang&page=2&page_size=5").json()["items"]
        self.assertFalse({x["id"] for x in p1} & {x["id"] for x in p2})

    def test_diem_den_sai_tra_loi_ro_rang(self):
        d = self.c.get("/api/places/search?destination=khong-ton-tai").json()
        self.assertEqual(d["items"], [])
        self.assertIn("error", d)

    def test_khong_lot_ten_placeholder(self):
        # importer sinh "POI 12345" khi OSM thiếu tên — không được hiện cho khách.
        d = self.c.get("/api/places/search?destination=da-nang&page_size=50").json()
        for x in d["items"]:
            self.assertNotRegex(x["name"], r"^(POI|Accommodation|Road) \d+$")


@requires_db
class TestChiTietDiaDiem(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)
        self.pid = self.c.get(
            "/api/places/search?destination=da-nang&category=beach&page_size=1"
        ).json()["items"][0]["id"]

    def test_tra_du_truong_cho_trang_chi_tiet(self):
        p = self.c.get(f"/api/places/poi/{self.pid}").json()["place"]
        for truong in ("name", "category", "lon", "lat", "nearby"):
            self.assertIn(truong, p)

    def test_co_dia_diem_lan_can(self):
        p = self.c.get(f"/api/places/poi/{self.pid}").json()["place"]
        self.assertTrue(p["nearby"])
        # Lân cận phải sắp theo khoảng cách tăng dần.
        met = [n["met"] for n in p["nearby"]]
        self.assertEqual(met, sorted(met))

    def test_khong_tu_liet_ke_chinh_no_trong_lan_can(self):
        p = self.c.get(f"/api/places/poi/{self.pid}").json()["place"]
        self.assertNotIn(self.pid, [n["id"] for n in p["nearby"]])

    def test_id_khong_ton_tai(self):
        self.assertEqual(self.c.get("/api/places/poi/999999999").status_code, 404)

    def test_place_type_khong_hop_le(self):
        self.assertEqual(self.c.get("/api/places/xxx/1").status_code, 400)


@requires_db
class TestYeuThichVaDatCho(unittest.TestCase):
    """Hai nghiệp vụ giữ chân người dùng. Kiểm cả phân quyền."""

    def setUp(self):
        self.c = TestClient(app)
        self.H = self._token(settings.seed_user_email, settings.seed_user_password)
        self.AH = self._token(settings.seed_admin_email, settings.seed_admin_password)
        self.pid = self.c.get(
            "/api/places/search?destination=da-nang&page_size=1"
        ).json()["items"][0]["id"]

    def _token(self, email, password):
        tok = self.c.post("/api/auth/login",
                          json={"email": email, "password": password}).json()["access_token"]
        return {"Authorization": f"Bearer {tok}"}

    def tearDown(self):
        self.c.delete(f"/api/favorites/poi/{self.pid}", headers=self.H)

    # ── Yêu thích ──
    def test_them_va_liet_ke(self):
        self.c.post("/api/favorites", json={"place_type": "poi", "place_id": self.pid},
                    headers=self.H)
        ds = self.c.get("/api/favorites", headers=self.H).json()["favorites"]
        self.assertIn(self.pid, [f["place_id"] for f in ds])

    def test_them_hai_lan_khong_loi(self):
        body = {"place_type": "poi", "place_id": self.pid}
        self.c.post("/api/favorites", json=body, headers=self.H)
        r = self.c.post("/api/favorites", json=body, headers=self.H)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["da_co"])

    def test_xoa_cai_khong_co_tra_404(self):
        self.assertEqual(
            self.c.delete("/api/favorites/poi/999999999", headers=self.H).status_code, 404)

    def test_place_type_sai(self):
        r = self.c.post("/api/favorites", json={"place_type": "xxx", "place_id": 1},
                        headers=self.H)
        self.assertEqual(r.status_code, 400)

    def test_phai_dang_nhap(self):
        # 401 khi thiếu hẳn token, 403 khi có token nhưng sai vai trò
        # (xem test_chi_admin_xem_duoc_danh_sach).
        self.assertEqual(self.c.get("/api/favorites").status_code, 401)

    # ── Đặt chỗ ──
    def _booking(self, **kw):
        body = {"place_type": "poi", "place_id": self.pid,
                "full_name": "Nguyễn Văn A", "phone": "0901234567"}
        body.update(kw)
        return self.c.post("/api/booking-requests", json=body, headers=self.H)

    def test_gui_yeu_cau_dat_cho(self):
        r = self._booking(check_in="2026-09-10", check_out="2026-09-12", guests=2)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["id"])

    def test_ngay_tra_truoc_ngay_nhan_bi_tu_choi(self):
        r = self._booking(check_in="2026-09-12", check_out="2026-09-10")
        self.assertEqual(r.status_code, 400)

    def test_thieu_dien_thoai_bi_tu_choi(self):
        r = self.c.post("/api/booking-requests",
                        json={"place_type": "poi", "place_id": self.pid,
                              "full_name": "A"}, headers=self.H)
        self.assertEqual(r.status_code, 422)

    def test_chi_admin_xem_duoc_danh_sach(self):
        self.assertEqual(self.c.get("/api/booking-requests", headers=self.H).status_code, 403)
        self.assertEqual(self.c.get("/api/booking-requests", headers=self.AH).status_code, 200)

    def test_admin_doi_trang_thai(self):
        bid = self._booking().json()["id"]
        r = self.c.put(f"/api/booking-requests/{bid}?status=da_lien_he", headers=self.AH)
        self.assertEqual(r.json()["status"], "da_lien_he")

    def test_trang_thai_khong_hop_le(self):
        bid = self._booking().json()["id"]
        self.assertEqual(
            self.c.put(f"/api/booking-requests/{bid}?status=bay_bong", headers=self.AH).status_code,
            400)


if __name__ == "__main__":
    unittest.main()
