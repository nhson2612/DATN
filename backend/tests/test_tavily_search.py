"""Kiểm thử tích hợp Tavily Search và phân loại câu hỏi thông minh."""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from app.shared.search import tavily as tavily_service
from app.self_guided.assistant import search_service


class _MockResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload


class TestTavilySearch(unittest.TestCase):
    def test_search_tavily_success(self):
        captured = {}

        def mock_post(url, **kwargs):
            captured["url"] = url
            captured["json"] = kwargs["json"]
            return _MockResponse({
                "query": "vé vào bảo tàng dân tộc học việt nam giá bao nhiêu",
                "answer": "Giá vé là 40.000 VNĐ.",
                "results": [
                    {"title": "Bảo tàng Dân tộc học", "url": "https://example.com/museum", "content": "Chi tiết giá vé..."},
                ],
            })

        with patch.object(tavily_service.settings, "tavily_api_key", "mock-tavily-key"):
            res = tavily_service.search_tavily(
                "vé vào bảo tàng dân tộc học việt nam giá bao nhiêu",
                include_answer=True,
                post=mock_post,
            )

        self.assertEqual(captured["url"], "https://api.tavily.com/search")
        self.assertEqual(captured["json"]["api_key"], "mock-tavily-key")
        self.assertEqual(res["answer"], "Giá vé là 40.000 VNĐ.")
        self.assertEqual(len(res["results"]), 1)
        self.assertEqual(res["results"][0]["url"], "https://example.com/museum")

    def test_search_tavily_missing_key_raises_config_error(self):
        with patch.object(tavily_service.settings, "tavily_api_key", ""):
            with self.assertRaises(tavily_service.TavilyConfigurationError):
                tavily_service.search_tavily("câu hỏi bất kỳ")

    def test_assistant_qa_routes_to_tavily(self):
        mock_tavily = {
            "answer": "Vé vào cổng Bảo tàng Dân tộc học là 40.000 VNĐ.",
            "results": [{"title": "Web Bảo tàng", "url": "https://baotang.vn"}],
        }
        with patch.object(tavily_service, "search_tavily", return_value=mock_tavily), \
             patch.object(search_service.settings, "tavily_api_key", "mock-key"):
            res = search_service.search("vé vào bảo tàng dân tộc học việt nam giá bao nhiêu")

        self.assertEqual(res["che_do"], "tavily_qa")
        self.assertEqual(res["answer"], "Vé vào cổng Bảo tàng Dân tộc học là 40.000 VNĐ.")
        self.assertEqual(len(res["sources"]), 1)

    def test_assistant_poi_routes_to_serper(self):
        mock_places = [{
            "id": "serper:mock123",
            "name": "Hồ Hoàn Kiếm",
            "category": "Hồ nước",
            "lat": 21.0285,
            "lon": 105.8542,
            "met": 100,
        }]
        with patch.object(search_service.serper_service, "search_places", return_value=mock_places):
            res = search_service.search("địa điểm du lịch thú vị ở hà nội")

        self.assertEqual(res["che_do"], "serper")
        self.assertEqual(len(res["results"]), 1)
        self.assertEqual(res["results"][0]["name"], "Hồ Hoàn Kiếm")
