"""Đặt mật khẩu tài khoản admin về giá trị trong SEED_ADMIN_PASSWORD (mặc định mới).

Chạy: PYTHONPATH=. ./venv/bin/python scripts/dat_mat_khau_admin.py [mật_khẩu]
Chỉ UPDATE đúng một dòng users của tài khoản admin. Không in hash, không in mật khẩu.
"""
import sys

from app.core.config import settings
from app.core.database import execute_query as q
from app.core.security import hash_password, verify_password

mat_khau = sys.argv[1] if len(sys.argv) > 1 else settings.seed_admin_password
email = settings.seed_admin_email

rows = q("select id, role, hashed_password from users where email = %s", (email,))
if not rows:
    print(f"KHÔNG có tài khoản {email} trong DB — không làm gì.")
    sys.exit(1)

if verify_password(mat_khau, rows[0]["hashed_password"]):
    print(f"{email}: mật khẩu đã đúng sẵn, không cần đổi.")
    sys.exit(0)

q("update users set hashed_password = %s where email = %s",
  (hash_password(mat_khau), email))

sau = q("select role, hashed_password from users where email = %s", (email,))[0]
print(f"{email} (role={sau['role']}): đã đổi. Kiểm tra lại:",
      verify_password(mat_khau, sau["hashed_password"]))
