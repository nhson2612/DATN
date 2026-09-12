"""TrackAsia adapter tests. Không gọi API thật hay cần PostGIS."""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

PLACE = {"name": "Saigon Waterbus", "lat": 10.7757799, "lon": 106.70677,
         "thanh_pho": "Thành phố Hồ Chí Minh"}


class _Response:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class TrackAsiaServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.services import trackasia_service
        cls.service = trackasia_service

    def test_fetch_requires_exact_name_and_nearby_coordinate(self):
        calls = []

        def get(url, **_kwargs):
            calls.append(url)
            if "textsearch" in url:
                return _Response({"status": "OK", "results": [{
                    "name": "Saigon Waterbus", "place_id": "17:venue:waterbus",
                    "geometry": {"location": {"lat": 10.77578, "lng": 106.70677}},
                }]})
            return _Response({"status": "OK", "result": {"name": "Saigon Waterbus"}})

        with patch.object(self.service.settings, "trackasia_api_key", "test-key"):
            detail, raw = self.service.fetch(PLACE, get=get)

        self.assertEqual(detail["name"], "Saigon Waterbus")
        self.assertIn("searches", raw)
        self.assertEqual(len(calls), 2)

    def test_fetch_rejects_same_name_that_is_far_away(self):
        def get(url, **_kwargs):
            return _Response({"status": "OK", "results": [{
                "name": "Saigon Waterbus", "place_id": "wrong",
                "geometry": {"location": {"lat": 10.815, "lng": 106.676}},
            }]})

        with patch.object(self.service.settings, "trackasia_api_key", "test-key"):
            detail, raw = self.service.fetch(PLACE, get=get)

        self.assertIsNone(detail)
        self.assertIsNone(raw["detail"])

    def test_match_accepts_large_feature_when_locality_agrees(self):
        place = {"name": "Hồ Tây", "lat": 21.0663195, "lon": 105.8339416,
                 "dia_chi": "Hồ Tây", "thanh_pho": "Quận Tây Hồ", "category": "lake"}
        candidate = {"name": "Hồ Tây", "place_id": "lake-west", "types": ["lake"],
                     "formatted_address": "Phường Tây Hồ, Thành phố Hà Nội",
                     "geometry": {"location": {"lat": 21.075, "lng": 105.833}}}
        with patch.object(self.service.settings, "trackasia_match_distance_m", 750), \
             patch.object(self.service.settings, "trackasia_extended_match_distance_m", 5000):
            self.assertEqual(self.service._match(place, [candidate])["place_id"], "lake-west")

    def test_normalize_maps_structured_fields(self):
        data = self.service.normalize({
            "description": "Bến tàu trên sông Sài Gòn.",
            "rating": 4.6,
            "user_ratings_total": 120,
            "url": "https://maps.track-asia.com/place/example",
            "photos": [{"url": "https://images.example/waterbus.jpg"}],
            "opening_hours": {"open_now": True, "weekday_text": ["Thứ Hai: 06:00–22:00"]},
        })
        self.assertEqual(data["summary"], "Bến tàu trên sông Sài Gòn.")
        self.assertEqual(data["rating"]["review_count"], 120)
        self.assertEqual(data["opening_hours"]["display"], "Đang mở cửa")
        self.assertEqual(data["images"][0]["url"], "https://images.example/waterbus.jpg")


class TrackAsiaEnrichmentFlowTests(unittest.TestCase):
    def test_enrichment_combines_trackasia_and_serper(self):
        from app.services import enrichment_service

        trackasia_normalized = {
            "summary": None, "opening_hours": {"display": "Đang mở cửa"},
            "rating": None, "review_highlights": [], "images": [], "sources": [],
        }
        serper_normalized = {
            "summary": "Bến tàu trên sông Sài Gòn.", "opening_hours": None,
            "rating": None, "review_highlights": [], "images": [{"url": "https://image.example/a.jpg"}], "sources": [],
        }
        cached_row = {
            "status": "success", "provider": "trackasia+serper_v1", "summary": serper_normalized["summary"],
            "opening_hours": trackasia_normalized["opening_hours"], "rating": None, "review_highlights": [], "images": serper_normalized["images"],
            "sources": [], "fetched_at": None,
        }
        with patch("app.services.enrichment_service.destination_repo.get_place_detail", return_value=PLACE), \
             patch("app.services.enrichment_service.enrichment_repo.get", side_effect=[None, cached_row]), \
             patch("app.services.enrichment_service.enrichment_repo.claim", return_value=True), \
             patch("app.services.enrichment_service.trackasia_service.fetch", return_value=({"name": "Saigon Waterbus"}, {"detail": {}})), \
             patch("app.services.enrichment_service.trackasia_service.normalize", return_value=trackasia_normalized), \
             patch("app.services.enrichment_service.enrichment_repo.save_success") as save, \
             patch("app.services.enrichment_service.serper_service.search", return_value={"organic": [], "images": []}) as serper, \
             patch("app.services.enrichment_service.serper_service.normalize", return_value=serper_normalized):
            status, body = enrichment_service.enrich("poi", 593998)

        self.assertEqual(status, 200)
        self.assertEqual(body["enrichment"]["summary"], serper_normalized["summary"])
        self.assertEqual(save.call_args.args[-1], "trackasia+serper_v1")
        serper.assert_called_once()
