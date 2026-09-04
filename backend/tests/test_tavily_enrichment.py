"""Kiểm thử làm giàu địa điểm bằng Tavily — không gọi provider thật.

Có ba nhóm:
  - EnrichmentRepositoryTests: repo thuần SQL, patch execute_query.
  - TavilyServiceTests: dựng query, client HTTP giới hạn, chuẩn hoá có bằng chứng.
  - EnrichmentServiceTests: điều phối cache-first, patch repo và provider.

Không test nào tiêu Tavily credit hay cần DB đang chạy.
"""

import os
import unittest
from unittest.mock import DEFAULT, patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

PLACE = {
    "id": 265670,
    "name": "Sun World Bà Nà Hills",
    "dia_chi": "Hòa Vang",
    "thanh_pho": "Đà Nẵng",
    "dien_thoai": "+842363749888",
    "website": "https://sunworld.vn/en/banahills",
    "social": "https://facebook.com/SunWorldBaNaHills",
}


class EnrichmentRepositoryTests(unittest.TestCase):
    def test_claim_returns_true_only_when_insert_or_stale_takeover_returns_row(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query",
                   return_value=[{"id": 1}]):
            self.assertTrue(enrichment_repo.claim("poi", 265670))
        with patch("app.repositories.enrichment_repo.execute_query",
                   return_value=[]):
            self.assertFalse(enrichment_repo.claim("poi", 265670))

    def test_claim_upsert_chi_cho_phep_chiem_job_fetching_cu(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query") as q:
            q.return_value = []
            enrichment_repo.claim("accommodation", 7)
        sql, params = q.call_args.args
        self.assertIn("INSERT INTO place_enrichments", sql)
        self.assertIn("ON CONFLICT (place_type, place_id) DO UPDATE", sql)
        # Chỉ chiếm lại khi trạng thái vẫn fetching và đã cũ quá stale_seconds.
        self.assertIn("status = 'fetching'", sql)
        self.assertIn("INTERVAL '1 second'", sql)
        self.assertEqual(params, ("accommodation", 7, 90))

    def test_release_only_deletes_fetching_row(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query") as query:
            enrichment_repo.release_transient("poi", 265670)
        sql, params = query.call_args.args
        self.assertIn("DELETE FROM place_enrichments", sql)
        self.assertIn("status = 'fetching'", sql)
        self.assertEqual(params, ("poi", 265670))

    def test_get_doc_moi_cot_public_va_raw_response(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query",
                   return_value=[{"id": 1}]) as q:
            enrichment_repo.get("poi", 265670)
        sql, params = q.call_args.args
        for cot in ("summary", "opening_hours", "rating", "review_highlights",
                    "images", "sources", "raw_response", "fetched_at"):
            self.assertIn(cot, sql)
        self.assertEqual(params, ("poi", 265670))

    def test_save_success_ghi_moi_field_chuan_hoa_va_raw_response(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query") as q:
            enrichment_repo.save_success("poi", 265670, {
                "summary": "Khu du lịch trên núi.",
                "opening_hours": {"display": "08:00–22:00 hằng ngày",
                                  "weekly": None,
                                  "source_url": "https://a.example/",
                                  "evidence": "Opening Hours: 8:00 AM – 10:00 PM"},
                "rating": {"value": 4.7, "review_count": 7813},
                "review_highlights": [{"text": "Đẹp", "sentiment": "positive"}],
                "images": [{"url": "https://img.example/1.jpg", "host": "img.example"}],
                "sources": [{"title": "A", "url": "https://a.example/", "content": "x"}],
            }, {"answer": "x", "results": [], "images": []})
        sql, params = q.call_args.args
        self.assertIn("status = 'success'", sql)
        # JSON phải được nối chuỗi — và giữ nguyên ký tự tiếng Việt, không \uXXXX.
        self.assertIn("Đẹp", params[3])
        self.assertIn("Khu du lịch trên núi.", params[0])

    def test_save_not_found_xoa_field_nhung_giu_raw_response(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query") as q:
            enrichment_repo.save_not_found("poi", 265670,
                                           {"answer": "", "results": []})
        sql, params = q.call_args.args
        self.assertIn("status = 'not_found'", sql)
        self.assertIn("'[]'::jsonb", sql)
        self.assertIn("raw_response = %s::jsonb", sql)
        self.assertEqual(params[0], '{"answer": "", "results": []}')

    def test_ensure_schema_tao_bang_idempotent_du_cac_rang_buoc(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query") as q:
            enrichment_repo.ensure_schema()
        sql = q.call_args.args[0]
        for doan in (
            "CREATE TABLE IF NOT EXISTS place_enrichments",
            "UNIQUE (place_type, place_id)",
            "CHECK (place_type IN ('poi', 'accommodation'))",
            "CHECK (status IN ('fetching', 'success', 'not_found'))",
            "raw_response JSONB",
        ):
            self.assertIn(doan, sql)

    def test_loai_place_type_khong_hop_le(self):
        from app.repositories import enrichment_repo

        with patch("app.repositories.enrichment_repo.execute_query"):
            with self.assertRaises(ValueError):
                enrichment_repo.get("hotel", 1)
            with self.assertRaises(ValueError):
                enrichment_repo.claim("hotel", 1)
            with self.assertRaises(ValueError):
                enrichment_repo.release_transient("hotel", 1)


class TavilyServiceTests(unittest.TestCase):
    """Parser/client test với payload giả — không tiêu Tavily credit."""

    @classmethod
    def setUpClass(cls):
        from app.services import tavily_service
        cls.tv = tavily_service

    def test_build_query_includes_identity_signals(self):
        q = self.tv.build_query(PLACE)
        for value in ("Sun World", "Hòa Vang", "Đà Nẵng",
                      "+842363749888", "sunworld.vn"):
            self.assertIn(value, q)

    def test_rating_and_count_come_from_same_result(self):
        data = self.tv.normalize(PLACE, {
            "answer": "It has 4.7 from 7,813 reviews.",
            "results": [
                {"title": "Ba Na Hills", "url": "https://a.example/place",
                 "content": "4.7 (7,813 reviews) Ba Na, Da Nang", "score": .8},
                {"title": "Wrong branch", "url": "https://b.example/place",
                 "content": "4.9 (66K reviews) Hanoi", "score": .9},
            ], "images": []})
        self.assertEqual(data["rating"]["value"], 4.7)
        self.assertEqual(data["rating"]["review_count"], 7813)
        self.assertEqual(data["rating"]["source_url"], "https://a.example/place")

    def test_close_only_does_not_invent_opening_time(self):
        import json
        data = self.tv.normalize(PLACE, {
            "answer": "Open now.",
            "results": [{"title": "Official", "url": PLACE["website"],
                         "content": "Open. Closes at 22:00", "score": .9}],
            "images": []})
        self.assertEqual(data["opening_hours"]["display"], "Đóng cửa lúc 22:00")
        self.assertNotIn("08:00", json.dumps(data, ensure_ascii=False))

    def test_full_range_gets_display_and_evidence(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [{"title": "Official", "url": PLACE["website"],
                         "content": "Opening Hours: 8:00 AM – 10:00 PM daily",
                         "score": .9}],
            "images": []})
        self.assertEqual(data["opening_hours"]["display"], "08:00–22:00 hằng ngày")
        self.assertEqual(data["opening_hours"]["source_url"], PLACE["website"])
        self.assertIn("Opening Hours: 8:00 AM", data["opening_hours"]["evidence"])

    def test_sai_locality_bi_loai_khoi_moi_field(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [{"title": "Ba Na Hills", "url": "https://c.example/x",
                         "content": ("Sun World Ba Na Hills Saigon branch "
                                     "4.8 (200 reviews) Ho Chi Minh"),
                         "score": .9}],
            "images": []})
        self.assertIsNone(data["rating"])
        self.assertEqual(data["sources"], [])

    def test_javascript_url_bi_loai(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [{"title": "Ba Na Hills", "url": "javascript:alert(1)",
                         "content": "Ba Na Hills, Da Nang. Open 08:00-22:00",
                         "score": .9}],
            "images": [{"url": "javascript:alert(1)", "title": "Ba Na",
                        "description": "Ba Na Hills Da Nang"}]})
        self.assertEqual(data["sources"], [])
        self.assertEqual(data["images"], [])

    def test_image_title_identity_matching(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [],
            "images": [
                {"url": "https://img.example/banahills.jpg",
                 "title": "Sun World Ba Na Hills cable car",
                 "description": "Golden Bridge Bà Nà Hills Đà Nẵng"},
                {"url": "https://img.example/hanoi.jpg",
                 "title": "Hanoi street food tour",
                 "description": "Pho in Hanoi old quarter"},
            ]})
        urls = [i["url"] for i in data["images"]]
        self.assertIn("https://img.example/banahills.jpg", urls)
        self.assertNotIn("https://img.example/hanoi.jpg", urls)
        self.assertTrue(all(i["host"] for i in data["images"]))

    def test_parse_review_count_k_va_k_plus(self):
        from app.services import tavily_service
        self.assertEqual(tavily_service._parse_review_count("66K reviews"), 66000)
        self.assertEqual(tavily_service._parse_review_count("66K+"), 66000)
        self.assertEqual(tavily_service._parse_review_count("7,813"), 7813)
        self.assertEqual(tavily_service._parse_review_count("1.2k"), 1200)
        self.assertIsNone(tavily_service._parse_review_count("abc"))

    def test_khong_suy_dien_phan_phoi_diem_sao(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [{"title": "Ba Na", "url": "https://a.example/x",
                         "content": ("4.7 (7,813 reviews) Ba Na, Da Nang "
                                     "40% five stars"), "score": .8}],
            "images": []})
        self.assertEqual(data["rating"]["value"], 4.7)
        self.assertNotIn("distribution", data["rating"])
        self.assertNotIn("40%", data["rating"].get("evidence", ""))

    def test_khong_trich_review_tu_noi_dung_quang_cao(self):
        data = self.tv.normalize(PLACE, {
            "answer": "",
            "results": [{"title": "Ba Na", "url": "https://a.example/x",
                         "content": ("Book now for Golden Bridge day tour from "
                                     "$45. The views are amazing, staff friendly. "
                                     "Ba Na, Da Nang"), "score": .8}],
            "images": []})
        texts = [h["text"] for h in data["review_highlights"]]
        self.assertFalse(any("Book now" in t or "$45" in t for t in texts))
        self.assertTrue(any("amazing" in t for t in texts))

    def test_summary_loai_cau_rating_khong_bang_chung(self):
        data = self.tv.normalize(PLACE, {
            "answer": ("Ba Na Hills is a hill station near Da Nang. "
                       "It has 4.7 stars from 7,813 reviews. "
                       "Visitors enjoy the mountain air."),
            "results": [{"title": "Ba Na", "url": "https://a.example/x",
                         "content": "Ba Na Hills Da Nang cable car", "score": .8}],
            "images": []})
        self.assertIn("hill station", data["summary"])
        self.assertNotIn("4.7", data["summary"])
        self.assertNotIn("7,813", data["summary"])

    def test_summary_khong_qua_600_ky_tu(self):
        from app.services import tavily_service
        dai = ("Câu mô tả rất dài. " * 100).strip()
        self.assertLessEqual(len(tavily_service._safe_summary(
            PLACE, {"answer": dai, "results": [], "images": []}, [])), 600)

    def test_response_tren_1_mib_bi_tu_choi(self):
        class Du:
            status_code = 200
            content = b"x" * (1_048_576 + 1)

            def raise_for_status(self):
                pass

            def json(self):
                return {"results": [], "images": []}

        with patch.object(self.tv.settings, "tavily_api_key", "tvly-test"):
            with self.assertRaises(self.tv.TavilyTransientError):
                self.tv.search(PLACE, post=lambda *a, **k: Du())

    def test_429_va_5xx_la_loi_tam_thoi(self):
        class Du:
            def __init__(self, code):
                self.status_code = code
                self.content = b"{}"

            def raise_for_status(self):
                pass

            def json(self):
                return {"results": [], "images": []}

        for code in (429, 500, 502, 503):
            with self.subTest(code=code):
                with patch.object(self.tv.settings, "tavily_api_key", "tvly-test"):
                    with self.assertRaises(self.tv.TavilyTransientError):
                        self.tv.search(PLACE, post=lambda *a, **k: Du(code))

    def test_http_4xx_khac_khong_phai_loi_tam_thoi(self):
        import requests

        class Du:
            status_code = 400
            content = b"{}"

            def raise_for_status(self):
                raise requests.HTTPError("400 Client Error")

            def json(self):
                return {"results": [], "images": []}

        with patch.object(self.tv.settings, "tavily_api_key", "tvly-test"):
            with self.assertRaises(requests.HTTPError):
                self.tv.search(PLACE, post=lambda *a, **k: Du())

    def test_timeout_la_loi_tam_thoi(self):
        import requests

        def treo(*a, **k):
            raise requests.exceptions.Timeout("timeout")

        with patch.object(self.tv.settings, "tavily_api_key", "tvly-test"):
            with self.assertRaises(self.tv.TavilyTransientError):
                self.tv.search(PLACE, post=treo)

    def test_thieu_api_key_la_loi_cau_hinh(self):
        def khong_goi(*a, **k):
            self.fail("không được gọi HTTP khi thiếu key")

        with patch.object(self.tv.settings, "tavily_api_key", None):
            with self.assertRaises(self.tv.TavilyConfigurationError):
                self.tv.search(PLACE, post=khong_goi)

    def test_settings_doc_ten_key_cu_viet_sai(self):
        from app.core.config import Settings

        class Du:
            def __init__(self, **kw):
                self.__dict__.update(kw)

        with patch.dict(os.environ, {"TAVILI_API_KEY": "tvly-legacy"},
                        clear=False):
            s = Settings()
        self.assertEqual(s.tavily_api_key, "tvly-legacy")

    def test_settings_uu_tien_ten_chuan(self):
        from app.core.config import Settings

        with patch.dict(os.environ,
                        {"TAVILY_API_KEY": "tvly-chuan",
                         "TAVILI_API_KEY": "tvly-sai"},
                        clear=False):
            s = Settings()
        self.assertEqual(s.tavily_api_key, "tvly-chuan")


class TavilySettingsModelTests(unittest.TestCase):
    """Settings đọc từ env — không đụng settings toàn cục đã nạp."""

    def test_thieu_ca_hai_ten_thi_khong_co_key(self):
        from app.core.config import Settings
        for ten in ("TAVILY_API_KEY", "TAVILI_API_KEY"):
            os.environ.pop(ten, None)
        self.assertIsNone(Settings().tavily_api_key)


if __name__ == "__main__":
    unittest.main()
