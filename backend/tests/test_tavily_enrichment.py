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


if __name__ == "__main__":
    unittest.main()
