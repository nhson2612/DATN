"""Kiểm thử adapter Serper bằng payload giả, không tiêu credit API."""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")


class _Response:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class SerperServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.shared.places import serper_service
        cls.service = serper_service

    def test_search_places_maps_real_serper_fields(self):
        captured = {}

        def post(url, **kwargs):
            captured["url"] = url
            captured["json"] = kwargs["json"]
            return _Response({"places": [{
                "title": "Hồ Tây", "address": "Tây Hồ, Hà Nội",
                "latitude": 21.0663, "longitude": 105.8339,
                "cid": "123", "category": "Hồ", "rating": 4.5,
                "ratingCount": 120,
            }]})

        with patch.object(self.service.settings, "serper_api_key", "test-key"), \
             patch.object(self.service.settings, "serper_places_url", "https://places.test"):
            rows = self.service.search_places("Hồ Tây", 21.03, 105.84, post=post)

        self.assertEqual(captured["url"], "https://places.test")
        self.assertEqual(captured["json"]["q"], "Hồ Tây")
        self.assertEqual(rows[0]["type"], "serper")
        self.assertEqual(rows[0]["provider_place_id"], "123")
        self.assertEqual(rows[0]["rating"], 4.5)

    def test_detail_id_round_trips_without_database(self):
        def post(*_args, **_kwargs):
            return _Response({"places": [{
                "title": "Hồ Tây", "address": "Tây Hồ, Hà Nội",
                "latitude": 21.0663, "longitude": 105.8339,
                "cid": "123", "category": "Hồ", "rating": 4.5,
                "ratingCount": 120,
            }]})

        with patch.object(self.service.settings, "serper_api_key", "test-key"):
            row = self.service.search_places("Hồ Tây", post=post)[0]
        detail = self.service.place_detail(row["id"])
        self.assertEqual(detail["name"], "Hồ Tây")
        self.assertEqual(detail["provider_place_id"], "123")
        self.assertEqual(detail["lat"], 21.0663)

    def test_normalize_uses_matching_web_result_and_images(self):
        place = {"name": "Hồ Tây", "dia_chi": "Tây Hồ, Hà Nội"}
        data = self.service.normalize(place, {
            "organic": [{
                "title": "Hồ Tây — điểm tham quan Hà Nội",
                "link": "https://example.test/ho-tay",
                "snippet": "Hồ Tây là hồ nước nổi tiếng ở Hà Nội.",
            }],
            "images": [{
                "title": "Hồ Tây Hà Nội", "imageUrl": "https://img.test/ho-tay.jpg",
                "source": "https://example.test",
            }],
        })
        self.assertIn("Hồ Tây", data["summary"])
        self.assertEqual(data["images"][0]["url"], "https://img.test/ho-tay.jpg")
        self.assertEqual(data["sources"][0]["url"], "https://example.test/ho-tay")


if __name__ == "__main__":
    unittest.main()
