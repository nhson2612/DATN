"""Kiểm thử tìm kiếm địa điểm từ câu hỏi tiếng Việt.

Bộ câu hỏi ở đây cố tình KHÔNG chỉ xoay quanh vài ca đã biết là hỏng. Nó phủ:

  - cả 7 nhóm du lịch, loại địa điểm lấy từ chính CSDL (`tags->>'category_root'`)
    chứ không phải tự nghĩ ra;
  - nhiều cách diễn đạt: có/không giới từ, không dấu, viết hoa, câu dài lê thê;
  - ca biên: câu rỗng, câu chỉ có hư từ, câu hỏi vào cột không có dữ liệu.

Lý do: bộ benchmark cũ (`app/benchmark_gsqa_auto.json`) sinh từ 8 template cố
định nên câu nào cũng đã chuẩn hoá sẵn — địa danh luôn có tiền tố "Phường",
khoảng cách luôn kèm số mét, loại địa điểm luôn dùng đúng từ trong bảng mapping.
Không câu nào giống câu người dùng thật gõ, nên nó không phát hiện được lỗi nào.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.services.search_service import (  # noqa: E402
    _ngrams,
    _norm,
    split_question,
)


def _db_available():
    try:
        from app.core.database import execute_query
        execute_query("SELECT 1")
        return True
    except Exception:
        return False


HAS_DB = _db_available()
requires_db = unittest.skipUnless(HAS_DB, "cần PostGIS đang chạy")


class TestNormalise(unittest.TestCase):
    """Chuẩn hoá chuỗi: người dùng gõ không dấu, viết hoa, thừa khoảng trắng."""

    def test_bo_dau_va_ha_chu_thuong(self):
        self.assertEqual(_norm("Khách Sạn"), "khach san")
        self.assertEqual(_norm("BÃI BIỂN Mỹ Khê"), "bai bien my khe")

    def test_chu_d_gach_ngang(self):
        # "đ" không phải dấu thanh nên unicodedata không tách được, phải thay tay.
        self.assertEqual(_norm("Đà Nẵng"), "da nang")
        self.assertEqual(_norm("bún đậu"), "bun dau")

    def test_gop_khoang_trang_thua(self):
        self.assertEqual(_norm("quán   cà  phê "), "quan ca phe")

    def test_go_khong_dau_van_ra_ket_qua_giong_go_co_dau(self):
        self.assertEqual(_norm("quan ca phe"), _norm("quán cà phê"))


class TestSplitQuestion(unittest.TestCase):
    """Tách 'cần tìm gì' khỏi 'ở đâu' — chỗ quyết định toàn bộ kết quả.

    Không tách đúng thì thứ cần tìm bị nhận nhầm thành mốc vị trí: CSDL có POI
    tên đúng bằng "Quán Bún Đậu" và "Karaoke", nên dò mốc trên cả câu sẽ nuốt
    mất từ khoá và trả về địa điểm hoàn toàn không liên quan.
    """

    def test_gioi_tu_gan(self):
        self.assertEqual(split_question("khách sạn gần biển Mỹ Khê"),
                         ("khach san", "bien my khe"))

    def test_gioi_tu_o(self):
        self.assertEqual(split_question("chùa ở Đà Nẵng"), ("chua", "da nang"))

    def test_gioi_tu_tai(self):
        self.assertEqual(split_question("nhà hàng tại Nha Trang"),
                         ("nha hang", "nha trang"))

    def test_gioi_tu_quanh(self):
        what, where = split_question("quán cà phê quanh Hồ Gươm")
        self.assertEqual(what, "quan ca phe")
        self.assertEqual(where, "ho guom")

    def test_khong_co_gioi_tu_thi_khong_co_moc(self):
        self.assertEqual(split_question("quán karaoke"), ("quan karaoke", ""))

    def test_gan_day_khong_phai_dia_danh(self):
        # "đây" sẽ không khớp tên nào trong CSDL nên search rơi về vị trí người dùng.
        what, where = split_question("quán karaoke gần đây")
        self.assertEqual(what, "quan karaoke")

    def test_cum_dai_nhat_duoc_uu_tien(self):
        # "gần nhất" phải thắng "gần", nếu không vế mốc thành "nhất".
        what, _ = split_question("cây xăng gần nhất")
        self.assertEqual(what, "cay xang")

    def test_van_tach_duoc_khi_go_khong_dau(self):
        self.assertEqual(split_question("khach san gan bien My Khe"),
                         ("khach san", "bien my khe"))


class TestNgrams(unittest.TestCase):
    def test_cum_dai_dung_truoc(self):
        grams = _ngrams("bien my khe")
        self.assertEqual(grams[0], "bien my khe")
        self.assertIn("my khe", grams)

    def test_bo_cum_qua_ngan(self):
        # Tên 1-2 ký tự khớp bừa vào hàng nghìn địa điểm.
        self.assertNotIn("my", _ngrams("my khe"))


@requires_db
class TestSearchTheoNhomDuLich(unittest.TestCase):
    """Mỗi nhóm trong 7 nhóm nhu cầu du lịch phải trả được kết quả.

    Loại địa điểm lấy từ chính CSDL, không tự nghĩ. Vị trí test đặt ở trung tâm
    Hà Nội và Đà Nẵng — nơi dữ liệu dày, nên rỗng là dấu hiệu hỏng thật chứ
    không phải thiếu dữ liệu.
    """

    HN = (105.8461, 21.0184)
    DN = (108.2200, 16.0600)

    def _search(self, q, pos=None):
        from app.services.search_service import search
        lon, lat = pos or self.HN
        return search(q, lon, lat, limit=10)

    def _assert_co_ket_qua(self, q, pos=None):
        r = self._search(q, pos)
        self.assertTrue(
            r["results"],
            f"{q!r} không ra kết quả nào (từ khoá={r.get('keywords')!r}, "
            f"mốc={r.get('anchor')})",
        )
        return r

    # --- 1. Ăn uống ---
    def test_quan_ca_phe(self):
        self._assert_co_ket_qua("quán cà phê gần đây")

    def test_nha_hang(self):
        self._assert_co_ket_qua("nhà hàng gần đây")

    def test_tiem_banh(self):
        self._assert_co_ket_qua("tiệm bánh gần đây")

    # --- 2. Chỗ ở ---
    def test_khach_san(self):
        self._assert_co_ket_qua("khách sạn gần đây")

    def test_homestay(self):
        self._assert_co_ket_qua("homestay ở Đà Nẵng", self.DN)

    # --- 3. Tham quan ---
    def test_chua(self):
        self._assert_co_ket_qua("chùa ở Đà Nẵng", self.DN)

    def test_nha_tho(self):
        self._assert_co_ket_qua("nhà thờ gần đây")

    def test_bao_tang(self):
        self._assert_co_ket_qua("bảo tàng gần đây")

    # --- 4. Vui chơi ---
    def test_karaoke(self):
        self._assert_co_ket_qua("quán karaoke gần đây")

    def test_rap_phim(self):
        self._assert_co_ket_qua("rạp phim gần đây")

    # --- 5. Địa lý tự nhiên ---
    def test_bai_bien(self):
        self._assert_co_ket_qua("bãi biển ở Đà Nẵng", self.DN)

    def test_cong_vien(self):
        self._assert_co_ket_qua("công viên gần đây")

    # --- 6. Mua sắm ---
    def test_sieu_thi(self):
        self._assert_co_ket_qua("siêu thị gần đây")

    def test_cho(self):
        self._assert_co_ket_qua("chợ gần đây")

    # --- 7. Đi lại ---
    def test_cay_xang(self):
        self._assert_co_ket_qua("cây xăng gần nhất")


@requires_db
class TestSearchCachDienDat(unittest.TestCase):
    """Cùng một ý định, nhiều cách gõ khác nhau — phải ra kết quả như nhau."""

    HN = (105.8461, 21.0184)

    def _search(self, q):
        from app.services.search_service import search
        return search(q, *self.HN, limit=10)

    def test_go_khong_dau(self):
        self.assertTrue(self._search("quan ca phe gan day")["results"])

    def test_viet_hoa_toan_bo(self):
        self.assertTrue(self._search("QUÁN CÀ PHÊ GẦN ĐÂY")["results"])

    def test_khong_co_gioi_tu(self):
        self.assertTrue(self._search("quán cà phê")["results"])

    def test_cau_dai_nhieu_tu_thua(self):
        r = self._search("cho tôi hỏi có quán cà phê nào gần đây không")
        self.assertTrue(r["results"], f"từ khoá còn lại: {r.get('keywords')!r}")

    def test_co_dau_va_khong_dau_ra_cung_so_luong(self):
        a = self._search("quán cà phê gần đây")["results"]
        b = self._search("quan ca phe gan day")["results"]
        self.assertEqual(len(a), len(b))


@requires_db
class TestSearchMocViTri(unittest.TestCase):
    """Mốc vị trí: tra thẳng CSDL, không bắt LLM đoán trước là vùng hay điểm."""

    HN = (105.8461, 21.0184)
    DN = (108.2200, 16.0600)

    def _search(self, q, pos=None):
        from app.services.search_service import search
        lon, lat = pos or self.HN
        return search(q, lon, lat, limit=10)

    def test_moc_la_dia_diem(self):
        r = self._search("khách sạn gần biển Mỹ Khê", self.DN)
        self.assertIsNotNone(r["anchor"], "không tìm được mốc 'biển Mỹ Khê'")
        self.assertIn("mỹ khê", r["anchor"]["name"].lower())

    def test_moc_la_ranh_gioi_hanh_chinh(self):
        r = self._search("quán cà phê ở Hải Châu", self.DN)
        self.assertIsNotNone(r["anchor"])

    def test_khong_co_moc_thi_dung_vi_tri_nguoi_dung(self):
        r = self._search("quán cà phê gần đây")
        self.assertIsNone(r["anchor"])
        self.assertTrue(r["results"])

    def test_ket_qua_sap_theo_khoang_cach_tang_dan(self):
        rows = self._search("quán cà phê gần đây")["results"]
        khoang_cach = [r["met"] for r in rows]
        self.assertEqual(khoang_cach, sorted(khoang_cach),
                         "kết quả không sắp theo khoảng cách tăng dần")

    def test_ket_qua_nam_trong_ban_kinh(self):
        from app.services.search_service import DEFAULT_RADIUS_M
        for r in self._search("quán cà phê gần đây")["results"]:
            self.assertLessEqual(r["met"], DEFAULT_RADIUS_M)


@requires_db
class TestSearchCaBien(unittest.TestCase):
    """Câu không hợp lệ phải trả rỗng có kiểm soát, không được ném lỗi."""

    HN = (105.8461, 21.0184)

    def _search(self, q):
        from app.services.search_service import search
        return search(q, *self.HN, limit=10)

    def test_cau_rong(self):
        self.assertEqual(self._search("")["results"], [])

    def test_chi_co_hu_tu(self):
        self.assertEqual(self._search("tôi muốn hỏi")["results"], [])

    def test_cho_toi_hoi_van_ra_cho(self):
        """Đánh đổi đã biết: "cho tôi hỏi" trả về chợ.

        Bỏ dấu thì "chợ" thành "cho", trùng hư từ "cho". Phải chọn một: lọc
        "cho" đi thì "chợ gần đây" trả rỗng — mất hẳn một loại địa điểm du lịch;
        giữ lại thì câu mở đầu bằng "cho tôi hỏi..." bị lẫn thêm chợ vào kết
        quả. Chọn cách sau vì nhiễu nhẹ hơn là mất hẳn.
        """
        self.assertTrue(self._search("cho tôi hỏi")["results"])

    def test_tu_khoa_vo_nghia(self):
        self.assertEqual(self._search("xyzzy qwerty")["results"], [])

    def test_ky_tu_dac_biet_khong_lam_vo_sql(self):
        # Dấu nháy đơn và % là ký tự có nghĩa trong SQL/LIKE.
        for q in ("quán 100% cà phê", "quán O'Brien", "quán _test_"):
            with self.subTest(q=q):
                self._search(q)     # không được ném exception


@requires_db
class TestKhongCoDuLieuDanhGia(unittest.TestCase):
    """Các cột rating/stars/price_level chỉ chứa giá trị mặc định (xem README §4).

    Test này chốt lại sự thật đó để không ai lỡ xây tính năng lọc theo đánh giá
    trên dữ liệu không tồn tại — đúng thứ prompt của tầng IR đang dạy LLM làm.
    """

    def test_rating_toan_gia_tri_mac_dinh(self):
        from app.core.database import execute_query
        rows = execute_query(
            "SELECT count(*) AS n FROM poi WHERE rating IS DISTINCT FROM 4.0")
        self.assertEqual(rows[0]["n"], 0,
                         "rating đã có dữ liệu thật — cập nhật lại README §4")

    def test_stars_toan_gia_tri_mac_dinh(self):
        from app.core.database import execute_query
        rows = execute_query(
            "SELECT count(*) AS n FROM accommodation WHERE stars > 0")
        self.assertEqual(rows[0]["n"], 0,
                         "stars đã có dữ liệu thật — cập nhật lại README §4")


if __name__ == "__main__":
    unittest.main()
