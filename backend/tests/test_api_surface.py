"""Chốt bề mặt API sau khi chẻ main.py thành các router.

Test này tồn tại vì trong lúc refactor tôi đã tưởng include_router không hoạt
động: FastAPI 0.141 bọc router thành _IncludedRouter thay vì flatten từng
APIRoute vào app.routes, nên đếm bằng isinstance(r, APIRoute) ra 1. Cách kiểm
đúng là qua /openapi.json.
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

EXPECTED_PATHS = {
    "/",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/me",
    "/api/chat",
    "/api/route",
    "/api/roads",
    "/api/places",
    "/api/poi",
    "/api/poi/{id}",
    "/api/accommodation",
    "/api/accommodation/{id}",
    "/api/itineraries",
    "/api/itineraries/{id}",
    "/api/itineraries/recommend",
}


class ApiSurfaceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_all_expected_paths_registered(self):
        paths = set(self.client.get("/openapi.json").json()["paths"])
        self.assertEqual(paths, EXPECTED_PATHS)

    def test_root_ok(self):
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_protected_routes_reject_anonymous(self):
        for method, path in (
            ("get", "/api/itineraries"),
            ("get", "/api/auth/me"),
            ("post", "/api/poi"),
        ):
            with self.subTest(path=path):
                kwargs = {"json": {}} if method == "post" else {}
                res = getattr(self.client, method)(path, **kwargs)
                self.assertIn(res.status_code, (401, 403))

    def test_route_rejects_point_far_from_network(self):
        res = self.client.post(
            "/api/route",
            json={"start_lon": 112.0, "start_lat": 16.0,
                  "end_lon": 108.247, "end_lat": 16.06},
        )
        # 400 chu khong phai 500: HTTPException khong bi except Exception nuot.
        self.assertEqual(res.status_code, 400)
        self.assertIn("quá xa", res.json()["detail"])

    def test_route_reports_oneway_flag(self):
        res = self.client.post(
            "/api/route",
            json={"start_lon": 108.2272, "start_lat": 16.0614,
                  "end_lon": 108.2470, "end_lat": 16.0600},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("may_violate_oneway", res.json())

    def test_chat_rejects_empty_question(self):
        res = self.client.post("/api/chat", json={"question": "   "})
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
