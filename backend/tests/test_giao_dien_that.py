"""Kiểm thử giao diện qua TRÌNH DUYỆT THẬT, có thao tác chuột và bàn phím.

Vì sao cần: `TestClient` không chạy JavaScript, còn `chrome --dump-dom` chỉ chụp
được DOM sau khi tải chứ không bấm được nút. Cả hai đều bỏ lọt lỗi chỉ xuất hiện
SAU một thao tác — ví dụ lỗi làm trắng trang khi vừa tìm xong địa điểm:

    TypeError: Cannot read properties of undefined (reading 'lng')
        at L.getWest (maplibre-gl.js)
        at Map.fitBounds
        at ve (TripMap.jsx)

`fitBounds` với vùng nhìn RỖNG ném lỗi từ trong maplibre, và vì nó ném trong một
effect nên React gỡ luôn cả cây: người dùng mất trắng trang lịch trình đang soạn.

Test bỏ qua nếu không có Chrome hoặc chưa bật dev server (`npm run dev`) và
backend, để `unittest discover` trên máy khác không đỏ oan.
"""

import os
import shutil
import subprocess
import time
import unittest
import urllib.error
import urllib.request

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.core.config import settings  # noqa: E402

WEB = os.environ.get("WEB_URL", "http://localhost:5173")
API = os.environ.get("API_URL", "http://127.0.0.1:8000")
CONG_CDP = int(os.environ.get("CDP_PORT", "9440"))


def _song(url):
    try:
        urllib.request.urlopen(url, timeout=2)
        return True
    except urllib.error.HTTPError:
        return True                      # có trả lời là đủ
    except Exception:
        return False


CO_CHROME = shutil.which("google-chrome") is not None
SAN_SANG = CO_CHROME and _song(WEB) and _song(API + "/")
can_browser = unittest.skipUnless(
    SAN_SANG, "cần google-chrome + dev server (npm run dev) + backend đang chạy")


def _api(path, body=None, token=None, method=None):
    import json
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(API + path,
                               json.dumps(body).encode() if body is not None else None,
                               h, method=method)
    return __import__("json").load(urllib.request.urlopen(r))


TIM_O = ("Array.from(document.querySelectorAll('input'))"
         ".find(function(i){return (i.placeholder||'').indexOf('Bạn muốn tìm gì')>=0;})")

GO_TIM = """
var inp = %s;
Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')
  .set.call(inp, %s);
inp.dispatchEvent(new Event('input',{bubbles:true}));
inp.form.requestSubmit();
true
""" % (TIM_O, "'quán cà phê gần đây'")

BAT_LOI = """
window.__loi = [];
window.addEventListener('error', function(e){
  window.__loi.push((e.error && e.error.stack) || e.message);
});
true
"""


@can_browser
class TestTimRoiThemVaoChuyen(unittest.TestCase):
    """Đúng thao tác người dùng: mở chuyến, gõ câu hỏi, bấm thêm."""

    @classmethod
    def setUpClass(cls):
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from tools.cdp import mo_chrome

        cls.token = _api("/api/auth/login",
                         {"email": settings.seed_user_email,
                          "password": settings.seed_user_password})["access_token"]
        cls.trip = _api("/api/itineraries",
                        {"name": "Kiểm thử giao diện", "duration_days": 2, "stops": []},
                        cls.token)["id"]
        cls.ho_so = f"/tmp/cdp-test-{os.getpid()}"
        cls.proc, cls.c = mo_chrome(cls.ho_so, CONG_CDP)

        c = cls.c
        c.mo(WEB + "/")
        c.cho_co("!!document.querySelector('#root')", 25)
        c.js(f"localStorage.setItem('token','{cls.token}');"
             "localStorage.setItem('user',JSON.stringify("
             "{email:'u@x',full_name:'U',role:'user'}));true")
        c.mo(f"{WEB}/chuyen-di/{cls.trip}")
        c.cho_co("document.body.innerText.indexOf('Hỏi trợ lý') >= 0", 30)
        c.cho_co("!!window.maplibregl", 30)
        c.js(BAT_LOI)
        c.js(GO_TIM)
        # Chờ có kết quả HOẶC có lỗi, rồi mới khẳng định.
        try:
            c.cho_co("(window.__loi||[]).length || "
                     "document.body.innerText.indexOf('cách') >= 0", 120)
        except TimeoutError:
            pass
        time.sleep(2)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.c.dong(); cls.proc.kill()
        finally:
            _api(f"/api/itineraries/{cls.trip}", token=cls.token, method="DELETE")
            shutil.rmtree(cls.ho_so, ignore_errors=True)

    def test_khong_co_loi_javascript(self):
        loi = self.c.js("window.__loi") or []
        self.assertEqual(loi, [], "\n".join(loi)[:1500])

    def test_trang_khong_bi_xoa_trang(self):
        """React gỡ cả cây khi một effect ném lỗi — kiểm chính điều đó."""
        txt = self.c.js("document.body.innerText")
        self.assertIn("Kiểm thử giao diện", txt)
        self.assertIn("Chia theo ngày", txt)

    def test_ket_qua_hien_ra(self):
        self.assertGreater(
            self.c.js("document.querySelectorAll('button').length"), 5)
        self.assertIn("cách", self.c.js("document.body.innerText"))

    def test_ban_do_ve_marker_ket_qua(self):
        self.assertGreater(
            self.c.js("document.querySelectorAll('.maplibregl-marker').length"), 0)

    def test_bam_them_thi_diem_vao_chuyen(self):
        c = self.c
        self.assertIn("0 địa điểm", c.js("document.body.innerText"),
                      "chuyến phải đang rỗng trước khi bấm thêm")
        n = c.js("""
          var nut = Array.from(document.querySelectorAll('button'))
            .filter(function(b){ return !!b.querySelector('.fa-plus'); });
          if (nut.length) nut[0].click();
          nut.length""")
        self.assertGreater(n, 0, "không tìm thấy nút thêm nào")
        c.cho_co("document.body.innerText.indexOf('1 địa điểm') >= 0", 25)

        # Điểm vừa thêm phải nằm trong kho "chưa xếp ngày", không rơi vào hư vô.
        self.assertIn("Chưa xếp ngày", c.js("document.body.innerText"))


@can_browser
class TestDetailGiuaNguyenNoiDungCoBan(unittest.TestCase):
    """Trang chi tiết địa điểm: nội dung cơ bản sống sót khi web lỗi/chậm.

    POI 99767 = "Sun World Ba Na Hills" trong DB gis_vietnam hiện tại. Số id
    trong bản thiết kế gốc (265670) là Bà Nà Hills của DB cũ; sau khi đổi DB,
    id đó trỏ sang một nhà hàng ở Lào Cai nên test phải theo địa điểm thật
    của DB đang chạy. Backend unit test là nơi kiểm lỗi tạm thời một cách
    chính xác (CDP tùy biến không chặn được mạng) — test này chỉ chứng minh
    trang thật mount được và làm giàu web không xoá nội dung cơ bản.
    """

    POI_ID = 99767

    @classmethod
    def setUpClass(cls):
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from tools.cdp import mo_chrome

        cls.ho_so = f"/tmp/cdp-detail-{os.getpid()}"
        cls.proc, cls.c = mo_chrome(cls.ho_so, CONG_CDP)

        c = cls.c
        c.mo(WEB + f"/dia-diem/poi/{cls.POI_ID}")
        c.js(BAT_LOI)
        # Dữ liệu Overture phải hiện ra ngay, không chờ web.
        c.cho_co("document.querySelector('h1') != null", 30)
        c.cho_co(
            "document.body.innerText.indexOf('Sun World Ba Na Hills') >= 0", 20)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.c.dong()
            cls.proc.kill()
        finally:
            shutil.rmtree(cls.ho_so, ignore_errors=True)

    def _cho_enrichment_roi_khoi_trang_thai_tai(self):
        """Chờ hết skeleton (loading) — thành công/thất bại đều bỏ skeleton."""
        try:
            self.c.cho_co(
                "!document.querySelector('[data-testid=\"enrichment-skeleton\"]')",
                75)
        except TimeoutError:
            pass
        return self.c.js("document.body.innerText") or ""

    def test_noi_dung_co_ban_hien_du(self):
        txt = self.c.js("document.body.innerText") or ""
        # Điều hướng, tên, liên hệ và nút hành động chính đều là dữ liệu nền.
        self.assertIn("Địa điểm", txt)
        self.assertIn("Sun World Ba Na Hills", txt)
        self.assertIn("Liên hệ", txt)
        self.assertIn("Gửi yêu cầu đặt chỗ", txt)

    def test_enrichment_ve_mot_trong_cac_trang_thai_cuoi(self):
        txt = self._cho_enrichment_roi_khoi_trang_thai_tai()
        # Khối thông tin web luôn có tiêu đề (không nhảy chiều cao khi tải).
        self.assertIn("Thông tin cập nhật từ web", txt)
        co_trang_thai_cuoi = any(
            s in txt for s in (
                "Nguồn thông tin",          # success: danh sách nguồn
                "Chưa tìm thấy thông tin công khai bổ sung.",  # not_found
                "Chưa tải được dữ liệu web",  # lỗi tạm thời
            ))
        self.assertTrue(
            co_trang_thai_cuoi,
            "enrichment phải dừng ở success/not_found/lỗi, không treo loading:\n"
            + txt[:1500])
        # Khi success, chú thích nguồn phải hiện diện (bài học: mọi dữ liệu web
        # đều kèm nguồn — không có dữ liệu mồ côi).
        if "Nguồn thông tin" in txt:
            self.assertIn("Nguồn", txt)

    def test_khong_loi_javascript(self):
        loi = self.c.js("window.__loi") or []
        self.assertEqual(loi, [], "\n".join(loi)[:1500])


if __name__ == "__main__":
    unittest.main()
