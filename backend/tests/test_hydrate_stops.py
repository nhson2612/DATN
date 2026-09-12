"""Chốt bất biến của hydrate_stops: KHÔNG BAO GIỜ bỏ mất một stop.

Bug thật đã xảy ra: `stops` trong CSDL chỉ lưu {day,type,id}, còn hydrate chỉ
dựng lại được stop khi nó còn lat/lon trong bộ nhớ hoặc type ∈ ("accommodation",).
Mở lại một chuyến đã lưu là mất gần hết địa điểm, và `/optimize` ghi đè `stops`
bằng chính kết quả hydrate nên cú bấm "Sắp tuyến tối ưu" xoá luôn chúng khỏi CSDL.

Test này khoá lại hai điều:
  1. hydrate_stops trả về ĐÚNG số stop nhận vào, cùng thứ tự.
  2. Stop tra được thì có tên + toạ độ; stop không tra được vẫn còn, kèm
     `unresolved=True` để chỗ gọi biết mà không ghi thiếu.
"""

import base64
import json
import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.core.database import execute_query                      # noqa: E402
from app.services import itinerary_service, serper_service, trackasia_service  # noqa: E402
from app.services.itinerary_service import hydrate_stops          # noqa: E402


def _ma_serper(ten="Quán bún đậu", lat=16.0614, lon=108.2272):
    """Dựng ID Serper đúng định dạng `serper_service.search_places` tạo ra."""
    identity = {"name": ten, "address": "12 Nguyễn Chí Thanh, Đà Nẵng",
                "lat": lat, "lon": lon, "cid": "123456789",
                "category": "restaurant", "rating": 4.4, "review_count": 120}
    token = base64.urlsafe_b64encode(
        json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"serper:{token}"


def _co_csdl():
    try:
        execute_query("SELECT 1")
        return True
    except Exception:
        return False


class HydrateStopsTest(unittest.TestCase):
    def setUp(self):
        itinerary_service._trackasia_cache.clear()

    def test_dung_so_luong_va_thu_tu_voi_moi_loai_stop(self):
        """Bất biến chính: N stop vào -> đúng N stop ra, giữ nguyên thứ tự."""
        stops = [
            {"day": 1, "type": "serper", "id": _ma_serper(), "section": "muon-di"},
            {"day": 1, "type": "trackasia", "id": "17:venue:khong-ton-tai",
             "section": "muon-di"},
            {"day": 1, "type": "accommodation", "id": 999999999,
             "section": None, "role": "lodging"},
            {"day": 2, "type": "poi", "id": 424242, "section": "muon-di"},
        ]
        ra = hydrate_stops(stops)

        self.assertEqual(len(ra), len(stops), "hydrate_stops đã bỏ mất stop")
        self.assertEqual([(s["type"], s["id"]) for s in ra],
                         [(s["type"], s["id"]) for s in stops])
        self.assertEqual([s["day"] for s in ra], [s["day"] for s in stops])
        self.assertEqual([s["section"] for s in ra],
                         [s["section"] for s in stops])

    def test_serper_lay_lai_duoc_ten_va_toa_do_tu_id(self):
        """ID Serper tự mang dữ liệu -> reload xong vẫn có tên và toạ độ."""
        token = _ma_serper("Chùa Linh Ứng", lat=16.1, lon=108.25)
        ra = hydrate_stops([{"day": 1, "type": "serper", "id": token,
                             "section": "muon-di", "role": "place"}])

        self.assertEqual(len(ra), 1)
        self.assertEqual(ra[0]["name"], "Chùa Linh Ứng")
        self.assertAlmostEqual(ra[0]["lat"], 16.1)
        self.assertAlmostEqual(ra[0]["lon"], 108.25)
        self.assertIsNone(ra[0].get("unresolved"))

    def test_provider_loi_thi_giu_tham_chieu_chu_khong_bo(self):
        """TrackAsia chết (thiếu key / mạng lỗi) không được làm mất stop."""
        from unittest.mock import patch

        stops = [{"day": 3, "type": "trackasia", "id": "17:venue:abc",
                  "section": "muon-di", "role": "place"}]
        with patch.object(trackasia_service, "place_detail",
                          side_effect=trackasia_service.TrackAsiaTransientError("hết quota")):
            ra = hydrate_stops(stops)

        self.assertEqual(len(ra), 1)
        self.assertEqual(ra[0]["id"], "17:venue:abc")
        self.assertTrue(ra[0]["unresolved"])
        self.assertEqual(ra[0]["day"], 3)

    def test_provider_co_du_lieu_thi_dien_toa_do(self):
        from unittest.mock import patch

        chi_tiet = {
            "place_id": "17:venue:abc",
            "name": "Bảo tàng Chăm",
            "types": ["museum"],
            "geometry": {"location": {"lat": 16.0555, "lng": 108.2233}},
            "formatted_address": "Số 2 Bạch Đằng, Hải Châu, Đà Nẵng",
        }
        with patch.object(trackasia_service, "place_detail", return_value=chi_tiet):
            ra = hydrate_stops([{"day": 2, "type": "trackasia", "id": "17:venue:abc",
                                 "section": "muon-di", "role": "place"}])

        self.assertEqual(len(ra), 1)
        self.assertEqual(ra[0]["name"], "Bảo tàng Chăm")
        self.assertAlmostEqual(ra[0]["lat"], 16.0555)
        self.assertAlmostEqual(ra[0]["lon"], 108.2233)
        self.assertEqual(ra[0]["category"], "museum")

    @unittest.skipUnless(_co_csdl(), "cần PostgreSQL")
    def test_cho_luu_tru_van_tra_duoc_tu_bang_noi_bo(self):
        rows = execute_query("SELECT id, name FROM accommodation LIMIT 1")
        if not rows:
            self.skipTest("bảng accommodation rỗng")
        acc_id, ten = rows[0]["id"], rows[0]["name"]

        ra = hydrate_stops([{"day": 1, "type": "accommodation", "id": acc_id,
                             "section": None, "role": "lodging"}])
        self.assertEqual(len(ra), 1)
        self.assertEqual(ra[0]["name"], ten)
        self.assertIsNotNone(ra[0]["lon"])
        self.assertEqual(ra[0]["role"], "lodging")

    @unittest.skipUnless(_co_csdl(), "cần PostgreSQL")
    def test_cho_luu_tru_da_bi_xoa_van_giu_tham_chieu(self):
        ra = hydrate_stops([{"day": 1, "type": "accommodation", "id": 999999999,
                             "section": None, "role": "lodging"}])
        self.assertEqual(len(ra), 1)
        self.assertTrue(ra[0]["unresolved"])

    def test_serper_id_hong_thi_giu_tham_chieu(self):
        ra = hydrate_stops([{"day": 1, "type": "serper", "id": "serper:@@@khong-phai-base64@@@",
                             "section": "muon-di", "role": "place"}])
        self.assertEqual(len(ra), 1)
        self.assertTrue(ra[0]["unresolved"])

    def test_rong_thi_rong(self):
        self.assertEqual(hydrate_stops([]), [])
        self.assertEqual(hydrate_stops(None), [])

    def test_bo_qua_phan_tu_khong_phai_dict(self):
        """Dữ liệu JSONB hỏng không được làm sập endpoint."""
        ra = hydrate_stops(["rác", 42, None,
                            {"day": 1, "type": "serper", "id": _ma_serper(
                                "Điểm thật", lat=16.0, lon=108.2), "section": "muon-di"}])
        self.assertEqual(len(ra), 1)
        self.assertEqual(ra[0]["name"], "Điểm thật")


if __name__ == "__main__":
    unittest.main()
