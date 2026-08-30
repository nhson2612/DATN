# Hệ thống website du lịch thông minh tích hợp Trí tuệ nhân tạo (AI)

Khoá luận tốt nghiệp — GVHD: Phạm Trung Dũng

Website du lịch cho phép người dùng tìm kiếm địa điểm bằng **câu hỏi tiếng Việt tự
nhiên**, xem kết quả trên bản đồ, tìm đường đi và lập lịch trình chuyến đi. Phạm vi
dữ liệu: **toàn quốc**.

---

## 1. Mục tiêu

- Nghiên cứu các công nghệ xây dựng website du lịch thông minh.
- Ứng dụng AI để gợi ý địa điểm, lập lịch trình và tư vấn người dùng.
- Xây dựng website cho phép tìm kiếm thông tin, quản lý tài khoản, lập kế hoạch
  chuyến đi và nhận đề xuất cá nhân hoá.
- Đánh giá hệ thống theo **tính chính xác**, **khả năng sử dụng** và **hiệu năng**.

---

## 2. Tính năng

### Đã có

| Nhóm | Tính năng | Endpoint |
| :--- | :--- | :--- |
| Tài khoản | Đăng ký, đăng nhập (JWT), phân quyền admin/user | `POST /api/register`, `/api/login`, `GET /api/me` |
| Trợ lý AI | Hỏi đáp tiếng Việt → tìm địa điểm → trả lời + hiện lên bản đồ | `POST /api/chat` |
| Bản đồ | Tải địa điểm theo khung nhìn (bbox + limit) | `GET /api/places` |
| Tìm đường | Đường đi ngắn nhất giữa hai điểm (pgRouting) | `POST /api/route` |
| Mạng đường | Tải mạng đường theo khung nhìn | `GET /api/roads` |
| Lịch trình | Xem, tạo, sửa, xoá lịch trình cá nhân | `GET/POST/PUT/DELETE /api/itineraries` |
| Quản trị | CRUD địa điểm và nơi lưu trú (chỉ admin) | `/api/poi`, `/api/accommodation` |

### Đang làm

| Nhóm | Tính năng | Trạng thái |
| :--- | :--- | :--- |
| Gợi ý AI | Đề xuất lịch trình theo số ngày, sở thích, ngân sách | `POST /api/itineraries/recommend` **lỗi 500** — `TypeError: Object of type Decimal is not JSON serializable` |

### Nên có — chưa làm

- **Lọc theo đánh giá / giá / hạng sao.** Các cột `rating`, `review_count`,
  `price_level`, `stars` hiện **toàn giá trị mặc định**, không phải dữ liệu thật
  (xem §4). Mọi câu hỏi dạng "khách sạn 4 sao", "quán ăn đánh giá cao" chưa trả lời
  được cho tới khi có nguồn đánh giá.
- **Cá nhân hoá theo lịch sử người dùng** — hiện `/recommend` chỉ nhận tham số của
  lần gọi, không dùng lịch sử tìm kiếm hay lịch trình đã lưu.
- **Lưu lịch sử hội thoại** để trợ lý hiểu câu hỏi nối tiếp ("còn chỗ nào khác
  không?").
- **Tìm kiếm theo món ăn / đặc sản.** Overture chỉ có loại địa điểm, không có món.
  Cần bổ sung nguồn OSM (`cuisine`) cho các thành phố lớn.
- **Ảnh địa điểm** — chưa có nguồn ảnh.
- **Đánh giá hệ thống** theo 3 tiêu chí của đề tài (chính xác / khả năng sử dụng /
  hiệu năng) — chưa có bộ câu hỏi kiểm thử và số đo.

---

## 3. Kiến trúc

```
frontend/            HTML + MapLibre GL, không dùng bundler
   │  HTTP + JSON
backend/app/
   ├── api/routes/   tầng HTTP — không chứa SQL
   ├── services/     nghiệp vụ — không biết HTTP
   ├── repositories/ chỉ SQL — không chứa nghiệp vụ
   ├── core/         cấu hình, kết nối DB, bảo mật, logging
   ├── llm/          adapter gọi LLM (Ollama cục bộ hoặc DeepSeek)
   └── services/search_service.py   tìm địa điểm từ câu hỏi tiếng Việt
   │
PostgreSQL 15 + PostGIS 3 + pgRouting
```

### Trợ lý AI hoạt động thế nào

**LLM không sinh truy vấn.** Câu hỏi được tách tại giới từ chỉ nơi chốn ("gần",
"ở", "tại", "quanh"): vế trước là thứ cần tìm, vế sau là mốc vị trí.

```
"khách sạn      gần   biển Mỹ Khê"
 └─ cần tìm ─┘        └─── mốc ───┘
```

Mốc được tra thẳng trong CSDL — nó có thể là ranh giới hành chính hoặc một địa
điểm, hệ thống không cần biết trước là loại nào; trùng tên ở nhiều tỉnh thì lấy
cái gần người dùng nhất. Sau đó tìm ứng viên bằng khớp mờ (`pg_trgm`) trên tên và
loại địa điểm, xếp hạng theo độ khớp rồi tới khoảng cách. LLM chỉ làm một việc
cuối cùng: diễn giải danh sách đã có thành câu trả lời tiếng Việt.

Cách này thay cho tầng IR trước đây (`research/ir_agent.py`), nơi LLM phải chọn
bảng, cột, giá trị và toán tử **trước khi** nhìn thấy dữ liệu — nên nó đoán, và
mọi thứ nằm ngoài danh sách viết sẵn trong prompt đều hỏng: "quán karaoke" ra 0
kết quả, "quán bún đậu" ra 20 nhà hàng bất kỳ, "khách sạn gần biển" sinh giá trị
`tourism="beach"` không hề tồn tại trong CSDL. Tầng `research/` được giữ lại để
đối chiếu, không còn phục vụ `/api/chat`.

Thời gian tìm kiếm: **190–570 ms**; phần lớn thời gian phản hồi còn lại là LLM
diễn giải kết quả.

---

## 4. Cơ sở dữ liệu

CSDL `gis_vietnam` — PostgreSQL + PostGIS + pgRouting.

| Bảng | Số dòng | Nguồn | Nội dung |
| :--- | ---: | :--- | :--- |
| `poi` | 805.729 | Overture Maps | Địa điểm: ăn uống, tham quan, vui chơi, mua sắm — 590 loại |
| `accommodation` | 52.046 | Overture Maps | Chỗ ở: hotel, resort, hostel, homestay |
| `boundaries` | 3.454 | Overture Maps | Ranh giới tỉnh/huyện/xã (`admin_level=4` là 55 tỉnh) |
| `roads` | 873.873 | OpenStreetMap | Mạng đường cho tìm đường |
| `roads_vertices_pgr` | 790.448 | pgRouting | Nút giao |
| `roads_components` | 790.762 | pgRouting | Thành phần liên thông (materialize sẵn) |
| `vn_mask` | 1 | tính từ `boundaries` | Union 55 tỉnh, dùng cắt dữ liệu ngoài biên giới |
| `users`, `itineraries` | — | ứng dụng | Tài khoản và lịch trình |

**Hai nguồn dữ liệu bổ sung nhau:**

- **Overture Maps** — phủ toàn quốc. Overpass API không kham nổi phạm vi cả nước
  (bị giới hạn truy vấn), nên địa điểm lấy từ parquet Overture trên S3 qua DuckDB.
- **OpenStreetMap** — mạng đường (`roads`) và dữ liệu chi tiết mà Overture không có
  (`cuisine` cho món ăn, `opening_hours`).

### Lưu ý về chất lượng dữ liệu

> **Các cột sau chỉ chứa giá trị mặc định, KHÔNG phải dữ liệu thật:**
> `rating` (luôn 4.0), `review_count` (luôn 10), `price_level` (luôn "Trung bình"),
> `climate_label`, `stars` (luôn 0), `address`, `price_range`, `description`.
> Overture không cung cấp các trường này. Đừng dùng chúng để đánh giá hay xếp hạng.

Dữ liệu đã được cắt theo biên giới Việt Nam bằng `vn_mask`: bbox hình chữ nhật bao
Việt Nam trùm cả Thái Lan, Lào, Campuchia nên lần import đầu lẫn 289.121 địa điểm
nước ngoài, đã loại bỏ.

---

## 5. Cài đặt

### Yêu cầu

- Docker & Docker Compose
- Python 3.13
- Ollama (nếu chạy LLM cục bộ) hoặc khoá API DeepSeek

### Các bước

```bash
# 1. Khởi động CSDL
docker compose up -d

# 2. Cấu hình
cp .env.example .env      # điền DEEPSEEK_API_KEY và JWT_SECRET

# 3. Cài thư viện
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# 4. Nạp dữ liệu du lịch toàn quốc (Overture, ~15 phút)
./venv/bin/python scripts/import_overture_vn.py

# 5. Chạy server
./venv/bin/uvicorn app.main:app --reload
```

Mở `frontend/index.html`. Lần khởi động đầu tiên hệ thống tự tạo hai tài khoản mẫu:
`admin@gmail.com` (quyền admin) và `user@gmail.com`. Đổi mật khẩu qua biến
`SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` trước khi triển khai thật.

### Cấu hình chính (`.env`)

| Biến | Ý nghĩa |
| :--- | :--- |
| `DATABASE_URL` | Đổi tên DB cuối chuỗi để chuyển giữa `gis_vietnam` (toàn quốc) và `gis_tourism` (Đà Nẵng) |
| `LLM_PROVIDER` | `ollama` (cục bộ) hoặc `deepseek` (API từ xa) |
| `LLM_TIMEOUT_SQL` | Thời gian chờ khi sinh truy vấn (mặc định 300s) |
| `LLM_TIMEOUT_EXPLAIN` | Thời gian chờ khi diễn giải kết quả (mặc định 180s) |
| `DB_SCOPE` | Phạm vi địa lý ghi trong prompt — `Việt Nam` hoặc `Đà Nẵng` |
| `JWT_SECRET` | Bắt buộc, không có mặc định. Sinh bằng `openssl rand -hex 32` |

---

## 6. Script tiện ích

| Script | Công dụng |
| :--- | :--- |
| `import_overture_vn.py` | Nạp địa điểm du lịch toàn quốc từ Overture |
| `backfill_overture_tags.py` | Bổ sung `tags` (địa chỉ, điện thoại, thương hiệu) |
| `importer.py` | Nạp dữ liệu Đà Nẵng từ OpenStreetMap qua Overpass |
| `node_and_rebuild_topology.py` | Dựng lại topology mạng đường cho pgRouting |
| `refresh_road_components.py` | Tính lại bảng thành phần liên thông |

---

## 7. Kiểm thử

```bash
cd backend && ./venv/bin/python -m unittest discover -s tests
```
