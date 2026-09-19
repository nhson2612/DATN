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
    "/api/accommodation",
    "/api/accommodation/{id}",
    "/api/admin/operators",
    "/api/admin/stats",
    "/api/admin/tours/pending",
    "/api/admin/tours/{tour_id}/approve",
    "/api/admin/tours/{tour_id}/reject",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/register",
    "/api/chat",
    "/api/destinations",
    "/api/destinations/{slug}",
    "/api/favorites",
    "/api/favorites/{place_type}/{place_id}",
    "/api/itineraries",
    "/api/itineraries/recommend",
    "/api/itineraries/{id}",
    "/api/itineraries/{id}/optimize",
    "/api/operator/bookings",
    "/api/operator/bookings/{booking_id}",
    "/api/operator/bookings/{booking_id}/confirm",
    "/api/operator/bookings/{booking_id}/operational-status",
    "/api/operator/departures/revenue/summary",
    "/api/operator/departures/{departure_id}/cancel",
    "/api/operator/departures/{departure_id}/guests",
    "/api/operator/departures/{departure_id}/guests.csv",
    "/api/operator/departures/{id}",
    "/api/operator/departures/{id}/sale",
    "/api/operator/tours",
    "/api/operator/tours/media",
    "/api/operator/tours/{id}",
    "/api/operator/tours/{tour_id}/departures",
    "/api/operator/tours/{tour_id}/departures/{departure_id}",
    "/api/operator/tours/{tour_id}/departures/{departure_id}/sale",
    "/api/operator/tours/{tour_id}/submit",
    "/api/places",
    "/api/places/cache-details",
    "/api/places/nearby",
    "/api/places/search",
    "/api/places/{place_type}/{place_id}",
    "/api/places/{place_type}/{place_id}/enrichment",
    "/api/roads",
    "/api/route",
    "/api/support/conversations",
    "/api/support/conversations/me",
    "/api/support/conversations/{conversation_id}",
    "/api/support/conversations/{conversation_id}/take-over",
    "/api/support/conversations/{conversation_id}/ai-draft",
    "/api/support/conversations/{conversation_id}/messages",
    "/api/support/inbox",
    "/api/tours",
    "/api/tours/admin/bookings",
    "/api/tours/admin/cleanup-expired",
    "/api/tours/admin/payments",
    "/api/tours/admin/payments/{payment_id}/confirm",
    "/api/tours/book",
    "/api/tours/bookings/me",
    "/api/tours/bookings/{booking_id}/checkout",
    "/api/tours/bookings/{booking_id}/cancel",
    "/api/tours/bookings/{booking_id}/pay",
    "/api/tours/bookings/{booking_id}/status",
    "/api/tours/provinces",
    "/api/tours/stripe/webhook",
    "/api/tours/{slug}",
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
            ("post", "/api/operator/tours"),
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

    def test_login_token_works_on_protected_routes(self):
        """Token tu /login phai dung duoc ngay — chan regression sub=id vs email.

        get_current_user tra user theo email, nen `sub` phai la email. Lan
        refactor dau tien dat sub=str(id): login tra 200 nhung moi endpoint can
        dang nhap tra 401.
        """
        login = self.client.post(
            "/api/auth/login",
            json={"email": "admin@gmail.com", "password": "admin"},
        )
        if login.status_code != 200:
            self.skipTest("khong co tai khoan admin mac dinh trong DB")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(me.status_code, 200, me.text)
        self.assertEqual(me.json()["user"]["role"], "admin")

        self.assertEqual(
            self.client.get("/api/itineraries", headers=headers).status_code, 200
        )

    def test_chat_rejects_empty_question(self):
        res = self.client.post("/api/chat", json={"question": "   "})
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
