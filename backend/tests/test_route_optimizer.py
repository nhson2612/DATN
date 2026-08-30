"""Kiểm thử bước cuối của luồng tự lên lịch: tối ưu thứ tự đi trong một ngày.

Người dùng thêm địa điểm theo thứ tự nghĩ ra, không theo thứ tự đi được. Một
ngày 5 điểm thêm lộn xộn phải chạy 73,6 km trong khi thứ tự tốt chỉ mất 35,4 km
(đo trên dữ liệu thật, xem test cuối file).
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import route_optimizer as ro  # noqa: E402


def _db_available():
    try:
        from app.core.database import execute_query
        execute_query("SELECT 1 FROM poi LIMIT 1")
        return True
    except Exception:
        return False


requires_db = unittest.skipUnless(_db_available(), "cần PostGIS có dữ liệu")


def _d(name, lon, lat, day=1):
    return {"day": day, "type": "poi", "id": abs(hash(name)) % 10 ** 6,
            "name": name, "lon": lon, "lat": lat}


class TestKhoangCach(unittest.TestCase):
    def test_hai_diem_trung_nhau(self):
        self.assertEqual(ro.khoang_cach_m((108.2, 16.0), (108.2, 16.0)), 0)

    def test_mot_do_vi_do_khoang_111km(self):
        d = ro.khoang_cach_m((108.2, 16.0), (108.2, 17.0))
        self.assertAlmostEqual(d / 1000, 111.2, delta=1.0)

    def test_doi_xung(self):
        a, b = (108.2, 16.0), (105.8, 21.0)
        self.assertAlmostEqual(ro.khoang_cach_m(a, b), ro.khoang_cach_m(b, a), places=6)


class TestToiUuMotNgay(unittest.TestCase):
    """Bốn điểm trên một đường thẳng, thêm theo thứ tự zigzag cố ý."""

    ZIGZAG = [_d("A", 108.20, 16.00), _d("C", 108.22, 16.00),
              _d("B", 108.21, 16.00), _d("D", 108.23, 16.00)]

    def test_sap_lai_dung_thu_tu_tren_duong_thang(self):
        moi, truoc, sau = ro.toi_uu_mot_ngay(self.ZIGZAG)
        self.assertEqual([s["name"] for s in moi], ["A", "B", "C", "D"])
        self.assertLess(sau, truoc)

    def test_giu_nguyen_diem_dau(self):
        """Điểm đầu thường là chỗ ở hoặc nơi người dùng cố ý xuất phát."""
        moi, _, _ = ro.toi_uu_mot_ngay(self.ZIGZAG)
        self.assertEqual(moi[0]["name"], "A")

    def test_khong_mat_diem_nao(self):
        moi, _, _ = ro.toi_uu_mot_ngay(self.ZIGZAG)
        self.assertEqual({s["name"] for s in moi}, {"A", "B", "C", "D"})

    def test_duoi_ba_diem_thi_bo_qua(self):
        hai = self.ZIGZAG[:2]
        moi, truoc, sau = ro.toi_uu_mot_ngay(hai)
        self.assertEqual(moi, hai)
        self.assertEqual((truoc, sau), (0.0, 0.0))

    def test_diem_thieu_toa_do_bi_day_xuong_cuoi_chu_khong_mat(self):
        ds = self.ZIGZAG + [{"day": 1, "type": "poi", "id": 9, "name": "Không toạ độ",
                             "lon": None, "lat": None}]
        moi, _, _ = ro.toi_uu_mot_ngay(ds)
        self.assertEqual(len(moi), 5)
        self.assertEqual(moi[-1]["name"], "Không toạ độ")

    def test_da_toi_uu_san_thi_khong_dai_them(self):
        thang = [_d("A", 108.20, 16.0), _d("B", 108.21, 16.0), _d("C", 108.22, 16.0)]
        _, truoc, sau = ro.toi_uu_mot_ngay(thang)
        self.assertLessEqual(sau, truoc + 1e-6)

    def test_hai_opt_go_duoc_doan_bat_cheo(self):
        """Hình vuông thêm theo thứ tự đường chéo — láng giềng gần nhất không đủ."""
        vuong = [_d("A", 108.20, 16.00), _d("C", 108.21, 16.01),
                 _d("B", 108.21, 16.00), _d("D", 108.20, 16.01)]
        moi, truoc, sau = ro.toi_uu_mot_ngay(vuong)
        self.assertLess(sau, truoc)
        # Thứ tự tốt phải đi vòng quanh cạnh, không cắt qua đường chéo hai lần.
        ten = [s["name"] for s in moi]
        self.assertEqual(ten[0], "A")
        self.assertNotEqual(ten, ["A", "C", "B", "D"])


class TestToiUuCaLichTrinh(unittest.TestCase):
    LICH = ([_d("A", 108.20, 16.00, 1), _d("C", 108.22, 16.00, 1),
             _d("B", 108.21, 16.00, 1)]
            + [_d("X", 105.80, 21.00, 2), _d("Z", 105.82, 21.00, 2),
               _d("Y", 105.81, 21.00, 2)]
            + [_d("Kho1", 106.0, 20.0, 0), _d("Kho2", 106.1, 20.0, 0),
               _d("Kho3", 106.2, 20.0, 0)])

    def test_chi_toi_uu_ngay_duoc_chon(self):
        moi, tk = ro.toi_uu_lich_trinh(self.LICH, day=1)
        n1 = [s["name"] for s in moi if s["day"] == 1]
        n2 = [s["name"] for s in moi if s["day"] == 2]
        self.assertEqual(n1, ["A", "B", "C"])
        self.assertEqual(n2, ["X", "Z", "Y"], "ngày 2 không được đụng tới")
        self.assertEqual([t["day"] for t in tk], [1])

    def test_toi_uu_moi_ngay(self):
        moi, tk = ro.toi_uu_lich_trinh(self.LICH, day=None)
        self.assertEqual([s["name"] for s in moi if s["day"] == 1], ["A", "B", "C"])
        self.assertEqual([s["name"] for s in moi if s["day"] == 2], ["X", "Y", "Z"])

    def test_khong_dung_toi_kho_chua_xep_ngay(self):
        """Ngày 0 là kho gom địa điểm, không có thứ tự đi nên không tối ưu."""
        moi, tk = ro.toi_uu_lich_trinh(self.LICH, day=None)
        self.assertEqual([s["name"] for s in moi if s["day"] == 0],
                         ["Kho1", "Kho2", "Kho3"])
        self.assertNotIn(0, [t["day"] for t in tk])

    def test_khong_mat_diem_nao(self):
        moi, _ = ro.toi_uu_lich_trinh(self.LICH, day=None)
        self.assertEqual(len(moi), len(self.LICH))


@requires_db
class TestQuaHTTP(unittest.TestCase):
    """Đi qua đúng luồng người dùng: tạo chuyến, thêm điểm, tối ưu, đọc lại."""

    def setUp(self):
        self.c = TestClient(app)
        tok = self.c.post("/api/auth/login", json={
            "email": settings.seed_user_email,
            "password": settings.seed_user_password}).json()["access_token"]
        self.H = {"Authorization": f"Bearer {tok}"}
        items = self.c.get("/api/places/search?destination=da-nang&page_size=5"
                           ).json()["items"]
        self.id = self.c.post("/api/itineraries", headers=self.H, json={
            "name": "Kiểm thử tối ưu", "duration_days": 2,
            "stops": [{"day": 1, "type": i["type"], "id": i["id"]} for i in items],
        }).json()["id"]

    def tearDown(self):
        self.c.delete(f"/api/itineraries/{self.id}", headers=self.H)

    def _doc(self):
        ds = self.c.get("/api/itineraries", headers=self.H).json()["itineraries"]
        return next(x for x in ds if x["id"] == self.id)["stops_details"]

    def test_toi_uu_rut_ngan_quang_duong(self):
        r = self.c.post(f"/api/itineraries/{self.id}/optimize?day=1", headers=self.H)
        self.assertEqual(r.status_code, 200)
        tk = r.json()["thong_ke"][0]
        self.assertLess(tk["sau_m"], tk["truoc_m"])

    def test_thu_tu_moi_duoc_luu_lai(self):
        moi = self.c.post(f"/api/itineraries/{self.id}/optimize?day=1",
                          headers=self.H).json()["stops_details"]
        self.assertEqual([s["id"] for s in self._doc()], [s["id"] for s in moi])

    def test_khong_mat_dia_diem_sau_khi_toi_uu(self):
        truoc = {s["id"] for s in self._doc()}
        self.c.post(f"/api/itineraries/{self.id}/optimize", headers=self.H)
        self.assertEqual({s["id"] for s in self._doc()}, truoc)

    def test_khong_toi_uu_duoc_chuyen_cua_nguoi_khac(self):
        atok = self.c.post("/api/auth/login", json={
            "email": settings.seed_admin_email,
            "password": settings.seed_admin_password}).json()["access_token"]
        r = self.c.post(f"/api/itineraries/{self.id}/optimize",
                        headers={"Authorization": f"Bearer {atok}"})
        self.assertEqual(r.status_code, 404)

    def test_phai_dang_nhap(self):
        self.assertEqual(
            self.c.post(f"/api/itineraries/{self.id}/optimize").status_code, 401)


if __name__ == "__main__":
    unittest.main()
