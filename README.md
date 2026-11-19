# Aura Voyage — Hệ thống Website Du lịch Thông minh Tích hợp GIS & Trí tuệ Nhân tạo (AI)

> **Đồ án / Khóa luận Tốt nghiệp** — Hệ thống hoạch định lịch trình du lịch tự túc trên bản đồ số GIS kết hợp nền tảng đặt Tour trọn gói, điều hành Tour và Trợ lý AI ngữ cảnh theo thời gian thực.  
> **Phạm vi dữ liệu không gian**: Toàn lãnh thổ Việt Nam (`gis_vietnam`).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Các phân hệ chức năng chính](#2-các-phân-hệ-chức-năng-chính)
3. [Kiến trúc hệ thống & Cấu trúc thư mục](#3-kiến-trúc-hệ-thống--cấu-trúc-thư-mục)
4. [Thuật toán Không gian (GIS), Định tuyến & Trí tuệ Nhân tạo](#4-thuật-toán-không-gian-gis-định-tuyến--trí-tuệ-nhân-tạo)
5. [Thiết kế Cơ sở dữ liệu (`PostgreSQL + PostGIS + pgRouting`)](#5-thiết-kế-cơ-sở-dữ-liệu-postgresql--postgis--pgrouting)
6. [Danh mục API Endpoints chính](#6-danh-mục-api-endpoints-chính)
7. [Hướng dẫn Cài đặt & Khởi chạy](#7-hướng-dẫn-cài-đặt--khởi-chạy)
8. [Cấu hình Biến môi trường (`.env`)](#8-cấu-hình-biến-môi-trường-env)
9. [Kiểm thử & Đảm bảo chất lượng](#9-kiểm-thử--đảm-bảo-chất-lượng)

---

## 1. Tổng quan hệ thống

**Aura Voyage** giải quyết đồng thời hai nhu cầu cốt lõi của du khách hiện đại trên cùng một nền tảng thống nhất:

1. **Du lịch tự túc thông minh (`Self-Guided Trip Planner`)**:
   - Lập kế hoạch chuyến đi nhiều ngày trực quan theo phong cách Wanderlog kết hợp bản đồ tương tác **MapLibre GL**.
   - **Trợ lý Lập lịch trình AI (`DeepSeek` + `Serper Places` + `Tavily` + `PostGIS`)**: Nắm bắt toàn bộ ngữ cảnh chuyến đi theo thời gian thực (điểm đến, số ngày, ngân sách, các điểm đã xếp theo từng ngày, chỗ nghỉ, ngày trống) và cung cấp **7 công cụ thao tác trực tiếp** vào lịch trình.
   - **Tối ưu lộ trình di chuyển 2 tầng**: Sắp xếp thứ tự địa điểm trong ngày bằng thuật toán **TSP (`Nearest Neighbor` + `2-Opt`)** kết hợp tìm đường bộ thực tế bằng **`pgRouting Dijkstra`** có xét chiều lưu thông (đường 1 chiều / 2 chiều).

2. **Đặt Tour trọn gói & Điều hành Tour (`Package Tours & Operator ERP`)**:
   - Tìm kiếm, lọc tour theo tỉnh/thành, mức giá, thời lượng; xem lịch khởi hành, bảng giá vé người lớn/trẻ em/em bé và chương trình ưu đãi.
   - Giữ chỗ tự động có thời hạn (15 phút) và thanh toán trực tuyến tức thì qua **VietQR payOS** (quét mã QR ngân hàng, tự động đối soát Webhook + kiểm tra chủ động) hoặc **Thẻ quốc tế Stripe Checkout**.
   - **Cổng Nhà điều hành (`Operator Portal`)**: Quản lý tour, lịch khởi hành, duyệt đơn đặt, xuất danh sách đoàn khách (`.csv`), quản lý hồ sơ khách hàng (CRM) và báo cáo thống kê doanh thu đa chiều (theo Tháng, theo Tour, theo Khách hàng, theo Kênh thanh toán).
   - **Trợ lý CSKH `Aura AI` (SSE Streaming)**: Tư vấn tour từ danh mục thực tế trong CSDL, so sánh giá tour chính xác, tra cứu đơn đặt của khách và hỗ trợ chuyển tiếp nhân viên tư vấn (`Human Handover`).

---

## 2. Các phân hệ chức năng chính

### 2.1. Phân hệ Khách du lịch (`Customer Portal`)
| Nhóm chức năng | Đường dẫn Frontend | Mô tả chi tiết |
| :--- | :--- | :--- |
| **Trang chủ & Khám phá** | `/`, `/destinations/:slug`, `/places/:type/:id` | Tìm kiếm điểm đến toàn quốc, khám phá điểm tham quan/ẩm thực/lưu trú kèm ảnh, đánh giá, bản đồ và địa điểm lân cận. |
| **Quản lý Chuyến đi tự túc** | `/trips` | Tạo chuyến đi mới, dùng AI tự động khởi tạo lịch trình theo sở thích & ngân sách, quản lý danh sách chuyến đi cá nhân. |
| **Màn hình Tự lên lịch (Trip Planner)** | `/trips/:id` | Bố cục 3 cột (Thanh điều hướng `PlannerRail` · Dải nội dung `PlannerContentFeed` · Bản đồ `TripMap`). Quản lý điểm dừng theo từng ngày, đặt chỗ nghỉ qua đêm, ghi chú, checklist, quản lý vé/đặt chỗ (`Reservations`) và theo dõi ngân sách (`Budget`). |
| **Trợ lý AI Lập lịch trình** | Tích hợp tại `/trips/:id` | Khung chat AI đọc trực tiếp ngữ cảnh chuyến đi `#id`, gợi ý lịch trình từng ngày, thêm điểm `+Ngày 1..N`, gán chỗ nghỉ, tối ưu đường đi, phân bổ điểm chờ xếp, tạo checklist & đặt ngân sách chỉ với 1 chạm. |
| **Tour trọn gói & Thanh toán** | `/tours`, `/tours/:slug` | Tìm kiếm/lọc tour, chọn đợt khởi hành, khai báo danh sách hành khách, thanh toán qua **VietQR payOS** hoặc **Stripe**. |
| **Tài khoản & Đơn đặt của tôi** | `/account`, `/favorites` | Theo dõi trạng thái đơn đặt tour, đồng bộ trạng thái thanh toán thời gian thực, hủy đơn, quản lý danh sách địa điểm yêu thích. |
| **Trợ lý trực tuyến Aura AI** | Widget toàn trang | Streaming câu trả lời theo thời gian thực (SSE), hiển thị thời gian suy nghĩ (`Working...` $\rightarrow$ `Worked for Xs`), dữ liệu truy xuất 100% từ PostgreSQL. |

### 2.2. Phân hệ Nhà điều hành Tour (`Operator Portal` — `/operator`)
- **Tổng quan điều hành (`Dashboard`)**: Theo dõi nhanh số tour đang mở, các đợt khởi hành sắp tới, tỷ lệ lấp đầy chỗ và doanh thu.
- **Quản lý Tour & Đợt khởi hành (`Tours & Departures`)**: Soạn thảo thông tin tour, lịch trình chi tiết từng ngày, tải ảnh media, gửi duyệt tour, mở đợt khởi hành, cài đặt giảm giá (`Sale`) và xuất file CSV danh sách hành khách theo đợt.
- **Quản lý Đơn đặt (`Bookings`)**: Xác nhận đơn, cập nhật trạng thái vận hành (`Chờ khởi hành`, `Đang diễn ra`, `Hoàn thành`), xử lý hủy đơn.
- **Quản lý Khách hàng (`Customers CRM`)**: Thống kê danh sách khách hàng của đơn vị, phân nhóm (`Đã thanh toán`, `Khách quen`, `Chưa hoàn tất`), tìm kiếm theo tên/SĐT/email/mã đơn và mở xem trực tiếp lịch sử các tour & từng đơn đặt của khách ngay trên bảng.
- **Báo cáo & Thống kê Doanh thu (`Revenue Analytics`)**: Phân tích doanh thu thực thu, giá trị trung bình mỗi đơn (`AOV`), doanh thu chờ thanh toán, tỷ trọng cổng thanh toán (`VietQR payOS` vs `Stripe`), kèm 4 bảng báo cáo chi tiết (**Theo Tháng**, **Theo Tour**, **Theo Khách hàng**, **Nhật ký giao dịch**) và xuất báo cáo `.csv`.

### 2.3. Phân hệ Quản trị hệ thống (`Admin Portal` — `/admin`)
- **Thống kê toàn sàn**: Giám sát tổng quan số lượng người dùng, nhà điều hành, địa điểm GIS, đơn đặt tour và dòng tiền thanh toán.
- **Kiểm duyệt Tour & Nhà điều hành**: Phê duyệt hoặc từ chối các tour do nhà điều hành gửi lên; tạo và phân quyền tài khoản Nhà điều hành (`operator`).
- **Đối soát Thanh toán & Dữ liệu Bản đồ**: Quản lý giao dịch thanh toán toàn hệ thống và CRUD dữ liệu địa điểm (`POI`, `Accommodation`).

---

## 3. Kiến trúc hệ thống & Cấu trúc thư mục

Hệ thống được thiết kế theo kiến trúc phân tầng rõ ràng (**Routes $\rightarrow$ Services $\rightarrow$ Repositories**), tách biệt hoàn toàn giao thức HTTP, nghiệp vụ logic và truy vấn SQL/PostGIS:

```text
datn/
├── backend/                        # FastAPI Backend (Python 3.13)
│   ├── app/
│   │   ├── core/                   # Cấu hình (.env), Connection Pool (psycopg_pool), JWT Auth, Logging
│   │   │   └── llm/                # LLM Adapter (DeepSeek API / Ollama, hỗ trợ JSON mode & SSE Stream)
│   │   ├── self_guided/            # Phân hệ Du lịch tự túc & GIS
│   │   │   ├── assistant/          # Trợ lý AI Lập lịch trình (Planner AI) & Tìm kiếm thông minh (Serper + Tavily)
│   │   │   ├── itinerary/          # Quản lý chuyến đi, Hydrate Stops, Gợi ý lịch trình AI & Thuật toán 2-Opt TSP
│   │   │   └── routing/            # Định tuyến đường bộ PostGIS KNN Snap + pgRouting pgr_dijkstra
│   │   ├── tours/                  # Phân hệ Tour trọn gói & Thương mại điện tử
│   │   │   ├── search_tours/       # Tìm kiếm tour, Đặt chỗ, Thanh toán Stripe & VietQR payOS, Báo cáo doanh thu
│   │   │   ├── operator/           # API dành riêng cho Nhà điều hành (Tours, Departures, Bookings, Customers, Revenue)
│   │   │   └── admin/              # API kiểm duyệt tour & quản lý nhà điều hành cho Admin
│   │   ├── support/                # Phân hệ CSKH Aura AI (SSE Streaming, tra cứu Tour/Booking thật, Human Handover)
│   │   ├── shared/                 # Tài nguyên dùng chung (Auth, Places, Destinations, Favorites, Photos, Schemas)
│   │   └── main.py                 # Điểm khởi chạy FastAPI, Middleware & Background Scheduler giải phóng giữ chỗ
│   ├── scripts/                    # Scripts nạp dữ liệu Overture Maps, OSM Roads, xây dựng Topology pgRouting
│   └── tests/                      # Bộ kiểm thử đơn vị & tích hợp (unittest)
├── web/                            # React 19 + Vite 8 + Tailwind CSS + MapLibre GL
│   └── src/
│       ├── customer/               # Giao diện Khách du lịch
│       │   ├── trips/              # Trang chủ, Điểm đến, Chi tiết địa điểm, Danh sách chuyến đi
│       │   │   ├── planner/        # Màn hình Tự lên lịch (TripPlanner, PlannerRail, PlannerContentFeed, Budget...)
│       │   │   └── assistant/      # Trợ lý Lập lịch trình AI (PlannerAssistant)
│       │   ├── tours/              # Danh sách Tour, Chi tiết Tour & Luồng đặt vé/thanh toán
│       │   └── account/            # Quản lý tài khoản & Lịch sử đơn đặt tour
│       ├── operator/               # Giao diện Nhà điều hành (Overview, Tours, Departures, Bookings, Customers, Revenue)
│       ├── admin/                  # Giao diện Quản trị viên (AdminPage)
│       └── shared/                 # API Client (api.js), Bản đồ (TripMap, MiniMap), Aura AI Widget (SupportWidget)
├── db/                             # Khởi tạo schema PostGIS/pgRouting (init.sql) & các bản миграции SQL
├── docker-compose.yml              # Container PostgreSQL + PostGIS + pgRouting (cổng 5433)
└── Makefile                        # Tập lệnh tự động hóa khởi chạy, kiểm thử và sao lưu/khôi phục CSDL
```

---

## 4. Thuật toán Không gian (GIS), Định tuyến & Trí tuệ Nhân tạo

### 4.1. Thuật toán Tối ưu Lộ trình 2 Tầng (`Haversine + Nearest Neighbor + 2-Opt` $\rightarrow$ `pgRouting Dijkstra`)

Khi người dùng thêm $N$ địa điểm vào một ngày theo thứ tự ngẫu nhiên, hệ thống giải bài toán tối ưu qua 2 tầng để đạt tốc độ phản hồi tức thì mà vẫn vẽ đúng tuyến đường giao thông thực tế:

1. **Tầng 1 — Sắp xếp thứ tự địa điểm tối ưu (`backend/app/self_guided/itinerary/optimizer.py`)**:
   - **Mô hình hóa bài toán TSP**:
     - Nếu ngày đó **đã chọn Chỗ nghỉ (`role = "lodging"`)**: Giải bài toán **TSP chu trình khép kín** ($\text{Chỗ nghỉ} \rightarrow \text{Điểm}_1 \rightarrow \dots \rightarrow \text{Điểm}_N \rightarrow \text{Chỗ nghỉ}$).
     - Nếu ngày đó **chưa chọn Chỗ nghỉ**: Giải bài toán **TSP đường đi mở** (giữ cố định điểm đầu tiên làm mốc xuất phát).
   - **Bước 1 (`Nearest Neighbor`)**: Dùng khoảng cách mặt cầu **Haversine** để dựng chu trình tham lam ban đầu bằng cách luôn nối tới địa điểm chưa thăm gần nhất.
   - **Bước 2 (`2-Opt Local Search`)**: Duyệt qua các cặp cạnh $(i, j)$ và đảo ngược đoạn con `thu_tu[i+1 : j+1]` (tối đa 50 vòng lặp) cho tới khi tháo gỡ hoàn toàn các đoạn đường cắt chéo nhau (hình chữ X). Thời gian thực thi ở Tầng 1 chỉ **$< 1\text{ ms}$**.

2. **Tầng 2 — Tìm đường bộ thực tế trên đồ thị (`backend/app/self_guided/routing/`)**:
   - **Bắt điểm vào mạng đường chính (`KNN Spatial Snap`)**: Sử dụng toán tử `<->` trên chỉ mục `GiST` của bảng `roads_vertices_pgr` kết hợp bảng thành phần liên thông `roads_components` (`comp_size > 100`) để bắt tọa độ địa điểm vào nút giao thông gần nhất mà không rơi vào đoạn đường cụt bị cô lập.
   - **Tìm đường ngắn nhất có hướng (`pgr_dijkstra` với `directed := true`)**:
     - Dữ liệu đường bộ từ OpenStreetMap được chuẩn hóa trọng số:
       ```sql
       cost         = CASE WHEN oneway = '-1' THEN -1 ELSE length END,
       reverse_cost = CASE WHEN oneway IN ('yes', '1', 'true') THEN -1 ELSE length END
       ```
     - Khi chạy `pgr_dijkstra(..., directed := true)`, mọi chiều có trọng số `-1` bị cấm đi qua, đảm bảo lộ trình tuân thủ đúng đường 1 chiều. Chỉ khi dữ liệu bản đồ tại khu vực đó bị đứt kết nối có hướng, hệ thống mới fallback sang `directed := false` và bật cờ cảnh báo `may_violate_oneway = True`.

### 4.2. Các Toán tử Không gian PostGIS Cốt lõi
| Toán tử / Hàm | Ứng dụng trong hệ thống |
| :--- | :--- |
| **`geom <-> point`** | Tìm kiếm $K$ đỉnh giao thông hoặc địa điểm gần nhất (KNN) sử dụng trực tiếp chỉ mục cây R-Tree (`GiST`). |
| **`ST_DWithin(geog1, geog2, R)`** | Khoanh vùng các địa điểm và khách sạn trong bán kính $R$ mét quanh tâm điểm đến (sử dụng functional index `USING GIST ((geom::geography))`). |
| **`ST_Distance(geog1, geog2)`** | Tính khoảng cách thực tế bằng **mét** trên bề mặt cong WGS84 của Trái Đất. |
| **`geom && ST_MakeEnvelope(...)`** | Lọc nhanh các đoạn đường nằm trong khung nhìn bản đồ (`Bounding Box`). |
| **`ST_AsGeoJSON(geom)`** | Xuất hình học đoạn đường `LineString` thành chuẩn GeoJSON để vẽ trực tiếp lên MapLibre GL. |

### 4.3. Kiến trúc AI Không Bịa Đặt Dữ Liệu (`Grounded AI Architecture`)
- **Trợ lý Lập lịch trình (`Planner AI` tại `/trips/:id`)**:
  - Nhận toàn bộ `trip_context` (các ngày đang trống, các điểm đã xếp, chỗ nghỉ, ngân sách) cùng danh sách ứng viên thực tế từ `serper_places_store`, `accommodation` và `Serper Places`.
  - Mô hình **DeepSeek (`deepseek-v4-flash`)** chỉ được chọn địa điểm thông qua chỉ số nguyên `idx` từ tập ứng viên có thật trong CSDL, sau đó backend ánh xạ ngược sang tọa độ `(lon, lat)` và ID chuẩn — loại bỏ 100% hiện tượng AI bịa địa điểm hoặc làm hỏng chuỗi ID.
- **Trợ lý CSKH (`Aura AI` tại `/api/support`)**:
  - Truy vấn trực tiếp danh mục tour đang mở bán (`tours` + `tour_departures`) và lịch sử đơn đặt của khách hàng đang đăng nhập (`tour_bookings`) để trả lời chính xác từng mức giá, số chỗ trống và đường dẫn đặt tour theo luồng **Server-Sent Events (SSE)**.

---

## 5. Thiết kế Cơ sở dữ liệu (`PostgreSQL + PostGIS + pgRouting`)

Hệ thống sử dụng cơ sở dữ liệu `gis_vietnam` với các nhóm bảng chính:

| Nhóm | Tên bảng | Mô tả |
| :--- | :--- | :--- |
| **Bản đồ & Địa điểm GIS** | `poi`, `accommodation`, `boundaries`, `provinces_clean`, `province_stats`, `place_photos` | Hơn 805.000 POI, 52.000 cơ sở lưu trú (`GEOMETRY(Point, 4326)`) và ranh giới hành chính 63 tỉnh/thành (`GEOMETRY(MultiPolygon, 4326)`). |
| **Cache Địa điểm Thông minh** | `serper_places_store`, `serper_places_cache` | Lưu trữ bền vững thông tin địa điểm làm giàu (tọa độ, địa chỉ, đánh giá, số lượng review, chi tiết JSONB) giúp truy vấn lặp lại đạt tốc độ tức thì. |
| **Đồ thị Mạng đường bộ** | `roads`, `roads_vertices_pgr`, `roads_components` | Hơn 873.000 đoạn đường (`GEOMETRY(LineString, 4326)`) và 790.000 nút giao thông đã vật hóa thành phần liên thông phục vụ `pgr_dijkstra`. |
| **Lịch trình Tự túc** | `itineraries`, `favorites` | Lưu thông tin chuyến đi (`destination`, `duration_days`, `start_date`, `budget`) và các cột `JSONB` (`stops`, `sections`, `reservations`). |
| **Tour trọn gói & Thanh toán** | `tours`, `tour_itinerary_days`, `tour_departures`, `tour_bookings`, `tour_booking_passengers`, `tour_payments`, `payment_webhook_events` | Quản lý toàn bộ vòng đời sản phẩm tour, lịch khởi hành, khóa giữ chỗ, hành khách và đối soát giao dịch VietQR payOS / Stripe. |
| **Tài khoản & Hỗ trợ** | `users`, `tour_operators`, `support_conversations`, `support_messages` | Quản lý người dùng (`user`, `operator`, `admin`), hồ sơ đơn vị lữ hành và lịch sử hội thoại hỗ trợ khách hàng. |

---

## 6. Danh mục API Endpoints chính

| Phân hệ | Method & Endpoint | Chức năng |
| :--- | :--- | :--- |
| **Xác thực** | `POST /api/auth/login`, `POST /api/auth/register` | Đăng nhập, đăng ký tài khoản và cấp JWT Token. |
| **Điểm đến & Địa điểm** | `GET /api/destinations`, `GET /api/places/search`, `GET /api/places/{type}/{id}` | Tra cứu tỉnh/thành, tìm kiếm địa điểm đa tiêu chí và làm giàu thông tin địa điểm. |
| **Lịch trình tự túc** | `GET/POST/PUT/DELETE /api/itineraries`, `POST /api/itineraries/{id}/optimize`, `POST /api/itineraries/recommend` | Quản lý chuyến đi, tối ưu thứ tự điểm dừng bằng 2-Opt TSP và gợi ý lịch trình tự động. |
| **Trợ lý AI & Định tuyến** | `POST /api/chat`, `POST /api/route` | Trợ lý AI ngữ cảnh chuyến đi (Trip Planner AI) và tìm đường bộ ngắn nhất `pgr_dijkstra`. |
| **Tour & Thanh toán** | `GET /api/tours`, `POST /api/tours/book`, `POST /api/tours/bookings/{id}/checkout-payos`, `POST /api/tours/bookings/{id}/checkout`, `GET /api/tours/bookings/{id}/status` | Tìm tour, đặt giữ chỗ, tạo link thanh toán VietQR payOS / Stripe và đồng bộ trạng thái thanh toán. |
| **Nhà điều hành (Operator)** | `GET/POST/PUT /api/operator/tours`, `GET /api/operator/bookings`, `GET /api/operator/bookings/customers/list`, `GET /api/operator/departures/revenue/summary` | Quản lý tour, lịch khởi hành, duyệt đơn, quản lý khách hàng CRM và báo cáo doanh thu đa chiều. |
| **Hỗ trợ CSKH (Aura AI)** | `POST /api/support/conversations/stream`, `POST /api/support/conversations/{id}/messages/stream` | Chat trực tuyến với Aura AI qua giao thức SSE Streaming và chuyển tiếp nhân viên hỗ trợ. |

---

## 7. Hướng dẫn Cài đặt & Khởi chạy

### 7.1. Yêu cầu hệ thống
- **Docker** & **Docker Compose** (chạy PostgreSQL 15 + PostGIS 3 + pgRouting)
- **Python 3.12+** (khuyến nghị `Python 3.13`)
- **Node.js 20+ / 22+** & **npm**

### 7.2. Khởi chạy nhanh bằng `Makefile`

```bash
# 1. Sao chép và cấu hình biến môi trường
cp .env.example .env
# Điền JWT_SECRET, DEEPSEEK_API_KEY, SERPER_API_KEY (và khóa payOS/Stripe nếu test thanh toán)

# 2. Khởi động container PostgreSQL/PostGIS/pgRouting (cổng 5433)
make db

# 3. Cài đặt môi trường Python cho Backend (chỉ cần chạy lần đầu)
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cd ..

# 4. Cài đặt thư viện cho Frontend (chỉ cần chạy lần đầu)
cd web && npm install && cd ..

# 5. Chạy Backend FastAPI (http://localhost:8000)
make backend

# 6. Chạy Frontend Vite (http://localhost:5173) — mở ở cửa sổ terminal thứ hai
make frontend
```

Hoặc chạy đồng thời cả Database, Backend và Frontend bằng một lệnh duy nhất:
```bash
make dev
```

### 7.3. Sao lưu & Khôi phục Cơ sở dữ liệu khi chuyển máy
```bash
# Xuất toàn bộ CSDL gis_vietnam ra file nén gis_vietnam.dump
make dump

# Khôi phục CSDL từ file gis_vietnam.dump vào Docker container
make restore
```

---

## 8. Cấu hình Biến môi trường (`.env`)

Các biến môi trường quan trọng trong file `.env` (đọc bởi `backend/app/core/config.py`):

| Biến môi trường | Giá trị mẫu / Mặc định | Mô tả |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/gis_vietnam` | Chuỗi kết nối PostgreSQL/PostGIS (`gis_vietnam` cho toàn quốc). |
| `JWT_SECRET` | *(Bắt buộc)* | Khóa bí mật ký JWT Token (sinh bằng `openssl rand -hex 32`). |
| `LLM_PROVIDER` | `deepseek` | Nhà cung cấp mô hình ngôn ngữ (`deepseek` hoặc `ollama`). |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Tên model DeepSeek sử dụng cho Aura AI và Trip Planner AI. |
| `DEEPSEEK_API_KEY` | `sk-...` | API Key của DeepSeek. |
| `SERPER_API_KEY` | `...` | API Key của Google Serper để tìm kiếm POI và ảnh địa điểm. |
| `TAVILY_API_KEY` | `tvly-...` | API Key của Tavily AI hỗ trợ tra cứu giá vé, giờ mở cửa, kinh nghiệm. |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | `...` | Bộ khóa tích hợp cổng thanh toán ngân hàng **VietQR payOS**. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | `sk_test_...` | Bộ khóa tích hợp thanh toán thẻ quốc tế **Stripe Checkout**. |

---

## 9. Kiểm thử & Đảm bảo chất lượng

1. **Chạy bộ kiểm thử Backend (`unittest`)**:
   ```bash
   make test
   # Hoặc chạy trực tiếp:
   cd backend && ./venv/bin/python -m unittest discover -s tests
   ```

2. **Kiểm tra chuẩn mã nguồn & Build bản Production cho Frontend**:
   ```bash
   cd web
   npm run lint
   npm run build
   ```
