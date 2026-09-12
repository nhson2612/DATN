"""Nghiệm thu end-to-end qua HTTP: bug "mở lại chuyến đi là mất địa điểm".

Kịch bản đúng như thật:
  1. Tạo user tạm, đăng nhập.
  2. Tạo chuyến đi với stops ĐÚNG định dạng frontend ghi xuống DB
     ({day,type,id,section,role} — không có tên, không có toạ độ).
  3. GET /api/itineraries  = hành vi "mở lại trang": stops_details phải đủ,
     và điểm Serper phải có lại tên + toạ độ.
  4. POST /api/itineraries/{id}/optimize  = "Sắp tuyến tối ưu": không được mất
     điểm nào (trước đây ghi đè `stops` bằng danh sách đã bị lọc).
  5. Dọn sạch dữ liệu tạo ra.

Chạy: cd backend && PYTHONPATH=. ./venv/bin/python tests/tools/acceptance_planner.py
"""
import base64
import json
import os
import sys

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")

from fastapi.testclient import TestClient            # noqa: E402

from app.core.database import execute_query          # noqa: E402
from app.main import app                             # noqa: E402

LOI = []


def kiem(dieu_kien, mo_ta):
    print(f"  [{'ĐẠT' if dieu_kien else 'HỎNG'}] {mo_ta}")
    if not dieu_kien:
        LOI.append(mo_ta)


def ma_serper(ten, lat, lon):
    identity = {"name": ten, "address": "12 Nguyễn Chí Thanh, Đà Nẵng", "lat": lat,
                "lon": lon, "cid": "123456", "category": "restaurant",
                "rating": 4.4, "review_count": 120}
    token = base64.urlsafe_b64encode(
        json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    return f"serper:{token}"


def main():
    client = TestClient(app)
    email, mat_khau = "nghiemthu.planner@example.com", "NghiemThu123!"

    client.post("/api/auth/register", json={"email": email, "password": mat_khau,
                                            "full_name": "Nghiệm thu planner"})
    dang_nhap = client.post("/api/auth/login", json={"email": email, "password": mat_khau})
    if dang_nhap.status_code != 200:
        print("Không đăng nhập được:", dang_nhap.status_code, dang_nhap.text)
        return 1
    H = {"Authorization": f"Bearer {dang_nhap.json()['access_token']}"}
    print("Đăng nhập OK")

    accs = execute_query("SELECT id, name FROM accommodation LIMIT 1") or []
    if not accs:
        print("Bảng accommodation rỗng — không chạy được nghiệm thu")
        return 1
    acc_id, acc_ten = accs[0]["id"], accs[0]["name"]

    TEN_SERPER = "Quán bún đậu nghiệm thu"
    stops = [
        {"day": 1, "type": "serper", "id": ma_serper(TEN_SERPER, 16.0614, 108.2272),
         "section": "muon-di", "role": "place"},
        {"day": 1, "type": "trackasia", "id": "17:venue:nghiem-thu-khong-co-that",
         "section": "muon-di", "role": "place"},
        {"day": 1, "type": "accommodation", "id": acc_id,
         "section": None, "role": "lodging"},
    ]

    tao = client.post("/api/itineraries", headers=H, json={
        "name": "Chuyến nghiệm thu planner", "description": "",
        "destination": "Đà Nẵng", "start_date": None, "duration_days": 1,
        "sections": [{"key": "muon-di", "name": "Địa điểm muốn đi"}],
        "stops": stops,
    })
    kiem(tao.status_code == 200, f"tạo chuyến đi (HTTP {tao.status_code})")
    itinerary_id = tao.json().get("id")
    if not itinerary_id:
        print("Không tạo được chuyến đi:", tao.text)
        return 1

    try:
        print("\n1) Mở lại chuyến đi — GET /api/itineraries")
        ds = client.get("/api/itineraries", headers=H).json()["itineraries"]
        chuyen = next(x for x in ds if x["id"] == itinerary_id)
        chi_tiet = chuyen.get("stops_details") or []
        kiem(len(chi_tiet) == len(stops),
             f"đủ {len(stops)} điểm sau khi tải lại (nhận {len(chi_tiet)})")
        kiem(len(chuyen.get("stops") or []) == len(stops),
             "stops trong DB vẫn đủ (không bị ghi đè khi đọc)")

        serper = next((s for s in chi_tiet if s["type"] == "serper"), None)
        kiem(serper is not None, "điểm Serper còn sống sau khi tải lại")
        if serper:
            kiem(serper.get("name") == TEN_SERPER,
                 f"lấy lại được tên ({serper.get('name')!r})")
            kiem(serper.get("lon") is not None and serper.get("lat") is not None,
                 f"lấy lại được toạ độ ({serper.get('lat')}, {serper.get('lon')})")

        acc = next((s for s in chi_tiet if s["type"] == "accommodation"), None)
        kiem(acc is not None and acc.get("name") == acc_ten,
             f"chỗ lưu trú hiện đúng tên ({acc.get('name') if acc else None!r})")
        kiem(acc is not None and acc.get("role") == "lodging",
             "role='lodging' được giữ nguyên")

        track = next((s for s in chi_tiet if s["type"] == "trackasia"), None)
        kiem(track is not None, "điểm TrackAsia không tra được vẫn KHÔNG bị bỏ")
        kiem(bool(track and track.get("unresolved")),
             "điểm không tra được có cờ unresolved=True")

        print("\n2) Bấm 'Sắp tuyến tối ưu' — POST /api/itineraries/{id}/optimize")
        opt = client.post(f"/api/itineraries/{itinerary_id}/optimize", headers=H)
        kiem(opt.status_code == 200, f"tối ưu trả 200 (nhận {opt.status_code})")
        if opt.status_code == 200:
            kiem(len(opt.json().get("stops_details") or []) == len(stops),
                 "kết quả tối ưu trả đủ số điểm")

        sau = client.get("/api/itineraries", headers=H).json()["itineraries"]
        chuyen_sau = next(x for x in sau if x["id"] == itinerary_id)
        luu_sau = chuyen_sau.get("stops") or []
        kiem(len(luu_sau) == len(stops),
             f"DB sau tối ưu vẫn đủ {len(stops)} điểm (nhận {len(luu_sau)})")
        loai = sorted((s["type"], str(s["id"])[:20]) for s in luu_sau)
        kiem([s["type"] for s in luu_sau].count("serper") == 1,
             "điểm Serper vẫn nằm trong DB sau khi tối ưu")
        kiem(any(s.get("role") == "lodging" for s in luu_sau),
             "chỗ lưu trú vẫn giữ role='lodging'")
        kiem(any(s.get("section") == "muon-di" for s in luu_sau),
             "section của điểm vẫn được giữ")
        print(f"     (DB sau tối ưu: {loai})")
    finally:
        client.delete(f"/api/itineraries/{itinerary_id}", headers=H)
        print("\nĐã dọn chuyến đi nghiệm thu")

    print()
    if LOI:
        print(f"KẾT QUẢ: HỎNG {len(LOI)} mục")
        for m in LOI:
            print("   -", m)
        return 1
    print("KẾT QUẢ: ĐẠT toàn bộ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
