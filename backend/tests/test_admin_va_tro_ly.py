"""Kiểm thử hai trang vừa chuyển từ vanilla JS sang React: trợ lý bản đồ và
trang quản trị.

Chuyển giao diện thì bản thân React không có gì để test tự động ở đây, nhưng nó
kéo theo ba thay đổi backend mà trang mới phụ thuộc — nếu chúng hỏng thì giao
diện im lặng hiển thị sai chứ không báo lỗi:

  1. /api/chat trả thêm `id`/`type` cho mỗi kết quả (để bấm vào mở được trang
     chi tiết) và toạ độ của mốc (để chấm mốc lên bản đồ).
  2. /api/places/search nhận `place_type` (trang quản trị phải sửa được cả cơ sở
     lưu trú, không chỉ POI).
  3. /api/admin/stats — số liệu thật thay cho panel "nhật ký hoạt động" ghi sẵn
     hai dòng bịa trong admin.html cũ.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402


def _db_available():
    try:
        from app.core.database import execute_query
        execute_query("SELECT 1 FROM poi LIMIT 1")
        return True
    except Exception:
        return False


requires_db = unittest.skipUnless(_db_available(), "cần PostGIS có dữ liệu")


def _token(c, email, password):
    tok = c.post("/api/auth/login",
                 json={"email": email, "password": password}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@requires_db
class TestTroLyTraDuThongTinChoBanDo(unittest.TestCase):
    """Trang trợ lý vẽ marker và link chi tiết từ chính response này."""

    def setUp(self):
        self.c = TestClient(app)

    def _hoi(self, q, lon=108.244, lat=16.06):
        return self.c.post("/api/chat",
                           json={"question": q, "user_lon": lon, "user_lat": lat}).json()

    def test_moi_ket_qua_co_id_va_type_de_mo_trang_chi_tiet(self):
        d = self._hoi("khách sạn gần biển Mỹ Khê")
        self.assertTrue(d["results"], "không có kết quả thì không kiểm được")
        for r in d["results"]:
            self.assertIn(r["type"], ("poi", "accommodation"))
            self.assertIsInstance(r["id"], int)

    def test_id_va_type_mo_duoc_trang_chi_tiet_that(self):
        r = self._hoi("khách sạn gần biển Mỹ Khê")["results"][0]
        ct = self.c.get(f"/api/places/{r['type']}/{r['id']}")
        self.assertEqual(ct.status_code, 200)
        self.assertEqual(ct.json()["place"]["name"], r["name"])

    def test_moc_co_toa_do(self):
        # Người dùng phải NHÌN THẤY hệ thống hiểu "gần Mỹ Khê" là gần chỗ nào.
        a = self._hoi("khách sạn gần biển Mỹ Khê")["anchor"]
        self.assertIsNotNone(a)
        self.assertAlmostEqual(a["lon"], 108.25, delta=0.1)
        self.assertAlmostEqual(a["lat"], 16.07, delta=0.1)

    def test_khong_co_moc_thi_anchor_la_none(self):
        self.assertIsNone(self._hoi("quán cà phê gần đây")["anchor"])

    def test_ket_qua_xep_theo_khoang_cach_tang_dan(self):
        met = [r["met"] for r in self._hoi("khách sạn gần biển Mỹ Khê")["results"]]
        self.assertEqual(met, sorted(met))


@requires_db
class TestTimKiemTheoBang(unittest.TestCase):
    """Trang quản trị phải liệt kê và sửa được CẢ cơ sở lưu trú."""

    def setUp(self):
        self.c = TestClient(app)

    def test_mac_dinh_la_poi(self):
        items = self.c.get("/api/places/search?q=chua&page_size=5").json()["items"]
        self.assertTrue(items)
        self.assertTrue(all(i["type"] == "poi" for i in items))

    def test_loc_duoc_co_so_luu_tru(self):
        d = self.c.get("/api/places/search?place_type=accommodation&q=khach&page_size=5").json()
        self.assertTrue(d["items"])
        self.assertTrue(all(i["type"] == "accommodation" for i in d["items"]))

    def test_hai_bang_cho_ket_qua_khac_nhau(self):
        # Cùng từ khoá mà ra y hệt nghĩa là tham số place_type bị bỏ qua.
        a = self.c.get("/api/places/search?q=khach&page_size=5").json()["total"]
        b = self.c.get("/api/places/search?place_type=accommodation&q=khach&page_size=5").json()["total"]
        self.assertNotEqual(a, b)

    def test_bang_khong_hop_le_bi_tu_choi(self):
        r = self.c.get("/api/places/search?place_type=roads")
        self.assertEqual(r.status_code, 400)


@requires_db
class TestQuanTri(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)
        self.AH = _token(self.c, settings.seed_admin_email, settings.seed_admin_password)
        self.H = _token(self.c, settings.seed_user_email, settings.seed_user_password)

    def test_thong_ke_du_khoa_va_deu_la_so(self):
        tk = self.c.get("/api/admin/stats", headers=self.AH).json()["stats"]
        for k in ("poi", "luu_tru", "nguoi_dung", "lich_trinh", "tour",
                  "dat_cho_moi", "dat_tour", "anh"):
            self.assertIsInstance(tk[k], int, f"khoá {k}")
            self.assertGreaterEqual(tk[k], 0, f"khoá {k}")

    def test_so_dia_diem_khong_bang_khong(self):
        # reltuples bằng 0 nghĩa là bảng chưa ANALYZE — con số hiển thị sẽ sai
        # hoàn toàn chứ không chỉ lệch vài phần nghìn.
        tk = self.c.get("/api/admin/stats", headers=self.AH).json()["stats"]
        self.assertGreater(tk["poi"], 0)

    def test_nguoi_dung_thuong_khong_xem_duoc(self):
        self.assertEqual(self.c.get("/api/admin/stats", headers=self.H).status_code, 403)

    def test_khach_khong_xem_duoc(self):
        self.assertEqual(self.c.get("/api/admin/stats").status_code, 401)

    def test_vong_doi_crud_co_so_luu_tru(self):
        """Đúng luồng trang quản trị: thêm -> sửa -> đọc lại -> xoá.

        Kiểm cả `price_range`: hai hàm create/update từng bỏ qua cột này, admin
        nhập xong là mất trắng mà không có lỗi nào.
        """
        moi = self.c.post("/api/accommodation", headers=self.AH, json={
            "name": "Kiểm thử Homestay", "tourism": "guest_house",
            "price_range": "Trung bình", "stars": 3, "address": "12 Lê Lợi",
            "lon": 108.22, "lat": 16.07,
        })
        self.assertEqual(moi.status_code, 200)
        aid = moi.json()["id"]
        try:
            r = self.c.put(f"/api/accommodation/{aid}", headers=self.AH, json={
                "name": "Kiểm thử Homestay (đã sửa)", "tourism": "hostel",
                "price_range": "Rẻ", "stars": 2, "address": "99 Trần Phú",
                "lon": 108.23, "lat": 16.08,
            })
            self.assertEqual(r.status_code, 200)

            p = self.c.get(f"/api/places/accommodation/{aid}").json()["place"]
            self.assertEqual(p["name"], "Kiểm thử Homestay (đã sửa)")
            self.assertEqual(p["category"], "hostel")
            self.assertEqual(p["price_range"], "Rẻ")
            self.assertEqual(p["stars"], 2)
        finally:
            self.assertEqual(
                self.c.delete(f"/api/accommodation/{aid}", headers=self.AH).status_code, 200)
        self.assertEqual(self.c.get(f"/api/places/accommodation/{aid}").status_code, 404)

    def test_xoa_dia_diem_khong_ton_tai_tra_404(self):
        self.assertEqual(
            self.c.delete("/api/poi/999999999", headers=self.AH).status_code, 404)

    def test_danh_sach_dat_tour_du_ten_tour(self):
        ds = self.c.get("/api/tours/admin/bookings", headers=self.AH).json()["bookings"]
        for b in ds:
            # Bảng trong trang quản trị hiện tên tour, không hiện id.
            self.assertTrue(b["tour_name"])


if __name__ == "__main__":
    unittest.main()
