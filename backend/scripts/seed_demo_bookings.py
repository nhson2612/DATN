"""Seed demo bookings, payments and status history for testing and showcase."""

import random
import sys
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import execute_query

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def seed():
    # 1. Get user id for user@gmail.com and admin id
    u = execute_query("SELECT id FROM users WHERE email = 'user@gmail.com'")
    user_id = u[0]["id"] if u else None
    
    admin = execute_query("SELECT id FROM users WHERE email = 'admin@gmail.com'")
    admin_id = admin[0]["id"] if admin else None

    # 2. Get departures
    departures = execute_query("""
        SELECT d.id AS departure_id, d.tour_id, d.depart_date, 
               COALESCE(d.sale_price, d.list_price) AS unit_price,
               t.name AS tour_name, t.operator_id
        FROM tour_departures d
        JOIN tours t ON t.id = d.tour_id
        WHERE d.status = 'OPEN'
        ORDER BY d.id
        LIMIT 6
    """)

    if not departures:
        print("Không tìm thấy đợt khởi hành nào.")
        return

    sample_customers = [
        {"name": "Trần Thị Mai", "phone": "0912345678", "email": "mai.tran@example.com", "pax": 2},
        {"name": "Lê Hoàng Long", "phone": "0987654321", "email": "long.le@example.com", "pax": 3},
        {"name": "Phạm Quốc Tuấn", "phone": "0905123456", "email": "tuan.pham@example.com", "pax": 1},
        {"name": "Nguyễn Văn Du Khách", "phone": "0934567890", "email": "user@gmail.com", "pax": 2},
        {"name": "Đặng Thuỳ Trang", "phone": "0978901234", "email": "trang.dang@example.com", "pax": 4},
    ]

    now = datetime.now(VN_TZ)

    for i, (dep, cust) in enumerate(zip(departures, sample_customers)):
        pax = cust["pax"]
        unit_price = dep["unit_price"] or 3500000
        total_price = unit_price * pax
        code = f"BK-202611-{1000 + i}"

        # Insert booking
        booking_rows = execute_query("""
            INSERT INTO tour_bookings (
                code, tour_id, departure_id, user_id, full_name, phone, email,
                guests, unit_list_price, unit_sale_price, total_price, status, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'CONFIRMED', %s)
            ON CONFLICT (code) DO NOTHING
            RETURNING id
        """, (
            code, dep["tour_id"], dep["departure_id"], user_id if cust["email"] == "user@gmail.com" else None,
            cust["name"], cust["phone"], cust["email"], pax, unit_price, unit_price, total_price,
            now - timedelta(days=random.randint(1, 10))
        ))

        if not booking_rows:
            continue
        booking_id = booking_rows[0]["id"]

        # Insert passengers
        for p_idx in range(1, pax + 1):
            p_name = cust["name"] if p_idx == 1 else f"{cust['name']} (Khách {p_idx})"
            execute_query("""
                INSERT INTO booking_passengers (booking_id, sequence_no, full_name, phone, email)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (booking_id, sequence_no) DO NOTHING
            """, (booking_id, p_idx, p_name, cust["phone"], cust["email"]))

        # Insert successful payment
        txn_ref = f"PAY-{code}-{p_idx}"
        execute_query("""
            INSERT INTO payments (
                booking_id, method, amount, status, txn_ref, note, confirmed_by, confirmed_at, created_at, provider
            )
            VALUES (%s, 'payos', %s, 'SUCCESS', %s, 'Thanh toán PayOS thành công', %s, %s, %s, 'payos')
            ON CONFLICT (txn_ref) DO NOTHING
        """, (
            booking_id, total_price, txn_ref, admin_id, now - timedelta(hours=2), now - timedelta(hours=3)
        ))

        # Insert history
        execute_query("""
            INSERT INTO booking_status_history (booking_id, from_status, to_status, reason, created_at)
            VALUES (%s, 'PENDING_PAYMENT', 'CONFIRMED', 'Xác nhận thanh toán tự động qua PayOS', %s)
        """, (booking_id, now - timedelta(hours=2)))

    print("Đã seed xong demo bookings & payments!")

if __name__ == "__main__":
    seed()
