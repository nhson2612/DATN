"""Kiểm thử agent tìm kiếm nhiều bước và phạm vi tìm theo hình dạng mốc.

Trọng tâm là lỗi làm "quán cà phê ở tỉnh Hà Tĩnh" trả rỗng: mọi câu hỏi đều bị
ép về "bán kính 3000m quanh TÂM mốc", trong khi tỉnh Hà Tĩnh có cạnh 77km và tâm
rơi vào vùng núi. Đây không phải lỗi riêng Hà Tĩnh — mọi mốc là tỉnh hay huyện
đều dính, chỉ là ít ai gõ đủ chữ "tỉnh" nên nó bị che.

Các bước cần gọi LLM được kiểm riêng bằng stub, để bộ test không phụ thuộc mạng.
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.services import search_agent as ag  # noqa: E402
from app.services import search_service as ts  # noqa: E402


def _db_available():
    try:
        from app.core.database import execute_query
        execute_query("SELECT 1 FROM boundaries LIMIT 1")
        return True
    except Exception:
        return False


requires_db = unittest.skipUnless(_db_available(), "cần PostGIS có dữ liệu")


@requires_db
class TestPhamViTheoHinhDangMoc(unittest.TestCase):
    """Mốc là VÙNG thì tìm trong ranh giới, không phải quanh tâm nó."""

    def setUp(self):
        self.tinh = self._moc("Tỉnh Hà Tĩnh")

    @staticmethod
    def _moc(ten):
        ds = ts.anchor_candidates(ten, 105.9, 18.3)
        khop = [c for c in ds if c["name"] == ten]
        return khop[0] if khop else None

    def test_tinh_duoc_nhan_la_vung(self):
        self.assertIsNotNone(self.tinh, "CSDL không có ranh giới 'Tỉnh Hà Tĩnh'")
        self.assertTrue(self.tinh["la_vung"])
        self.assertEqual(self.tinh["kind"], "boundary")

    def test_tim_trong_tinh_ra_ket_qua(self):
        rows = ts.tim_theo_pham_vi("quan ca phe", self.tinh, 105.9, 18.3, 20,
                                   trong_vung=True, ban_kinh=None)
        self.assertGreater(len(rows), 0)

    def test_ban_kinh_3km_quanh_TAM_tinh_ra_rong(self):
        """Chứng minh nguyên nhân gốc: cùng dữ liệu, chỉ đổi phạm vi là mất sạch.

        Bản cũ thu đa giác về `ST_Centroid` rồi lấy bán kính 3km QUANH ĐIỂM ĐÓ.
        Tâm tỉnh Hà Tĩnh rơi vào vùng núi nên trong 3km không có gì.

        Lưu ý phân biệt với `trong_vung=False` của mã hiện tại: chỗ đó đo tới MÉP
        đa giác chứ không tới tâm, nên vẫn phủ gần hết tỉnh — muốn tái hiện lỗi
        cũ phải đo từ chính cái tâm.
        """
        from app.core.database import execute_query
        quanh_tam = execute_query(
            """SELECT count(*) AS n FROM poi p
               WHERE norm_txt(p.name) %% norm_txt('quan ca phe')
                 AND ST_DWithin(p.geom::geography,
                       ST_Centroid((SELECT geom FROM boundaries WHERE id = %s))::geography,
                       3000)""",
            (self.tinh["id"],),
        )[0]["n"]
        trong_tinh = execute_query(
            """SELECT count(*) AS n FROM poi p, boundaries b
               WHERE b.id = %s AND ST_Intersects(p.geom, b.geom)
                 AND norm_txt(p.name) %% norm_txt('quan ca phe')""",
            (self.tinh["id"],),
        )[0]["n"]
        self.assertEqual(quanh_tam, 0, "tâm tỉnh không còn rỗng, test mất ý nghĩa")
        self.assertGreater(trong_tinh, 50)

    def test_ban_kinh_suy_tu_co_moc_khong_phai_hang_so(self):
        """"Gần một tỉnh" phải rộng hơn "gần một điểm" rất nhiều."""
        r_tinh = ts.ban_kinh_quanh_diem(self.tinh)
        r_diem = ts.ban_kinh_quanh_diem(None)
        self.assertGreater(r_tinh, r_diem * 5)

    def test_moc_la_diem_van_dung_ban_kinh(self):
        diem = self._moc("Biển Mỹ Khê") or ts.anchor_candidates("Biển Mỹ Khê", 108.24, 16.06)[0]
        self.assertFalse(diem["la_vung"])
        self.assertEqual(ts.ban_kinh_quanh_diem(diem), ts.RADIUS_QUANH_TOI_M)


@requires_db
class TestUngVienMoc(unittest.TestCase):
    """LLM chỉ được chọn trong địa danh CÓ THẬT — đây là chỗ chặn nó bịa."""

    def test_tra_nhieu_ung_vien_cho_ten_nhap_nhang(self):
        ds = ts.anchor_candidates("Hà Đông", 108.24, 16.06)
        self.assertGreater(len(ds), 1)
        self.assertTrue(all({"kind", "id", "name", "la_vung"} <= set(c) for c in ds))

    def test_ten_khong_co_that_tra_rong(self):
        self.assertEqual(ts.anchor_candidates("Quận Xyzzy Không Có", 108.24, 16.06), [])


class TestB3PhamVi(unittest.TestCase):
    """Bước 3 không gọi LLM: phạm vi suy thẳng từ mốc."""

    VUNG = {"kind": "boundary", "id": 1, "name": "Tỉnh X", "la_vung": True}
    DIEM = {"kind": "poi", "id": 1, "name": "Bãi Y", "la_vung": False}

    def test_trong_mot_vung(self):
        trong, r = ag.b3_pham_vi(self.VUNG, "trong")
        self.assertTrue(trong)
        self.assertIsNone(r)

    def test_gan_mot_diem(self):
        with mock.patch.object(ts, "ban_kinh_quanh_diem", return_value=3000):
            trong, r = ag.b3_pham_vi(self.DIEM, "gan")
        self.assertFalse(trong)
        self.assertEqual(r, 3000)

    def test_khong_co_moc(self):
        with mock.patch.object(ts, "ban_kinh_quanh_diem", return_value=3000):
            trong, r = ag.b3_pham_vi(None, "gan")
        self.assertFalse(trong)
        self.assertEqual(r, 3000)

    def test_ban_kinh_bi_chan_tren(self):
        with mock.patch.object(ts, "ban_kinh_quanh_diem", return_value=10 ** 9):
            _, r = ag.b3_pham_vi(self.VUNG, "gan")
        self.assertEqual(r, ag.BAN_KINH_TOI_DA)


class TestVongSuyLuan(unittest.TestCase):
    """Vòng B4-B5 với LLM giả — kiểm phần điều phối, không kiểm chất lượng LLM."""

    MOC = None

    def _chay(self, quyet_dinh, ket_qua):
        """quyet_dinh: các JSON B5 lần lượt. ket_qua: số dòng mỗi vòng."""
        lan = {"n": 0}

        def gia_tim(kw, moc, lon, lat, limit, **kw2):
            i = min(lan["n"], len(ket_qua) - 1)
            lan["n"] += 1
            return [{"name": f"{kw} {j}"} for j in range(ket_qua[i])]

        def gia_llm(system, prompt, buoc):
            if buoc == 1:
                return {"tim": "quán bún đậu mắm tôm", "dia_danh": "", "pham_vi": "gan"}
            return quyet_dinh.pop(0) if quyet_dinh else {"hanh_dong": "xong"}

        with mock.patch.object(ts, "tim_theo_pham_vi", gia_tim), \
             mock.patch.object(ts, "ban_kinh_quanh_diem", return_value=3000), \
             mock.patch.object(ag, "_hoi_llm", gia_llm):
            return ag.search("quán bún đậu mắm tôm ngon", 108.2, 16.0, limit=20)

    def test_noi_tu_khoa_khi_rong(self):
        kq = self._chay(
            [{"hanh_dong": "noi_tu_khoa", "tim": "bún đậu", "ly_do": "quá hẹp"}],
            [0, 7],
        )
        self.assertEqual(kq["keywords"], "bún đậu")
        self.assertEqual(len(kq["results"]), 7)
        self.assertEqual([b["so_dong"] for b in kq["cac_buoc"]], [0, 7])

    def test_dung_ngay_khi_llm_bao_xong(self):
        kq = self._chay([{"hanh_dong": "xong"}], [6])
        self.assertEqual(len(kq["cac_buoc"]), 1)

    def test_khong_hoi_llm_khi_da_day_gioi_han(self):
        # Đầy `limit` dòng là chính CSDL nói không thiếu — khỏi tốn một lượt LLM.
        kq = self._chay([], [20])
        self.assertEqual(kq["cac_buoc"][0]["quyet"], "xong")
        self.assertIn("giới hạn", kq["cac_buoc"][0]["ly_do"])

    def test_khong_lap_qua_max_vong(self):
        kq = self._chay(
            [{"hanh_dong": "noi_tu_khoa", "tim": "a"}] * 10,
            [0, 0, 0, 0],
        )
        self.assertLessEqual(len(kq["cac_buoc"]), ag.MAX_VONG)

    def test_llm_hong_giua_vong_van_giu_ket_qua_dang_co(self):
        """Không vứt kết quả để chạy lại từ đầu — lần chạy lại tốn thêm 25s timeout."""
        lan = {"n": 0}

        def gia_llm(system, prompt, buoc):
            if buoc == 1:
                return {"tim": "bún đậu", "dia_danh": "", "pham_vi": "gan"}
            raise ag.LLMKhongDung("timeout")

        with mock.patch.object(ts, "tim_theo_pham_vi",
                               lambda *a, **k: [{"name": "x"}, {"name": "y"}]), \
             mock.patch.object(ts, "ban_kinh_quanh_diem", return_value=3000), \
             mock.patch.object(ag, "_hoi_llm", gia_llm):
            kq = ag.search("bún đậu gần đây", 108.2, 16.0, limit=20)
        self.assertEqual(kq["che_do"], "nhieu_buoc")
        self.assertEqual(len(kq["results"]), 2)
        self.assertEqual(kq["cac_buoc"][-1]["quyet"], "dung_vi_llm_hong")


@requires_db
class TestRoiVeDuongTatDinh(unittest.TestCase):
    """LLM chết ngay bước 1 thì câu hỏi vẫn phải được trả lời."""

    def test_b1_hong_thi_dung_duong_tat_dinh(self):
        with mock.patch.object(ag, "_hoi_llm", side_effect=ag.LLMKhongDung("x")):
            kq = ag.search("khách sạn gần biển Mỹ Khê", 108.244, 16.06)
        self.assertEqual(kq["che_do"], "tat_dinh")
        self.assertTrue(kq["results"])

    def test_loi_bat_ngo_cung_roi_ve_tat_dinh(self):
        with mock.patch.object(ag, "_hoi_llm", side_effect=RuntimeError("mạng chết")):
            kq = ag.search("khách sạn gần biển Mỹ Khê", 108.244, 16.06)
        self.assertEqual(kq["che_do"], "tat_dinh")
        self.assertTrue(kq["results"])


@requires_db
class TestKhongHoiLaiKhiNguoiDungDaChon(unittest.TestCase):
    def test_resolved_admin_chon_dung_ung_vien(self):
        """Hỏi "Hà Tĩnh (điểm) hay Tỉnh Hà Tĩnh (vùng)?" rồi người dùng chọn tỉnh
        mà vẫn tìm quanh cái điểm thì lượt hỏi lại thành vô nghĩa."""
        moc, hoi, _ = ag.b2_phan_giai_moc("Hà Tĩnh", 105.9, 18.3,
                                          tu_dong=True, chinh_xac="Tỉnh Hà Tĩnh")
        self.assertIsNone(hoi)
        self.assertEqual(moc["name"], "Tỉnh Hà Tĩnh")
        self.assertTrue(moc["la_vung"])


@requires_db
class TestYDinhRangBuocMoc(unittest.TestCase):
    """"Ở TRONG X" chỉ có nghĩa khi X là vùng — không ai ở bên trong một cái chấm."""

    def test_y_dinh_trong_loai_ung_vien_la_diem(self):
        # CSDL có cả POI tên "Hà Tĩnh" lẫn ranh giới "Tỉnh Hà Tĩnh". LLM từng
        # chọn cái POI cho "bãi biển ở Hà Tĩnh" rồi trả về hai quán ăn cách 2km.
        moc, hoi, _ = ag.b2_phan_giai_moc("Hà Tĩnh", 108.244, 16.06,
                                          tu_dong=False, y_dinh="trong")
        self.assertIsNone(hoi, "chỉ còn một ứng viên là vùng thì không được hỏi lại")
        self.assertTrue(moc["la_vung"])

    def test_y_dinh_gan_van_giu_ca_diem(self):
        ds = ts.anchor_candidates("Hà Tĩnh", 108.244, 16.06)
        self.assertTrue(any(not c["la_vung"] for c in ds),
                        "cần có ít nhất một ứng viên là điểm để test có nghĩa")


if __name__ == "__main__":
    unittest.main()
