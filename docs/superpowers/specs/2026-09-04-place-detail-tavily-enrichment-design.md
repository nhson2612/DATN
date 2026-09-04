# Thiết kế trang chi tiết POI và Tavily enrichment

Ngày: 2026-09-04

## Mục tiêu

Khi người dùng mở `/dia-diem/:type/:id`, ứng dụng phải hiển thị dữ liệu Overture
ngay lập tức và đồng thời làm giàu địa điểm bằng Tavily nếu địa điểm đó chưa từng
được xử lý. Kết quả có ích hoặc kết quả xác nhận không tìm thấy được lưu vĩnh
viễn trong PostgreSQL; những lần mở sau chỉ đọc cơ sở dữ liệu và không gọi
Tavily lại.

Trang chi tiết được thiết kế lại để ưu tiên ảnh, giờ mở cửa, điểm đánh giá, số
lượt đánh giá và nguồn chứng minh. Giao diện không được mô tả dữ liệu Tavily là
"đã xác thực trực tiếp từ nhà cung cấp".

## Phạm vi

Bao gồm:

- POI và accommodation vì cùng dùng route `/dia-diem/:type/:id`.
- Một Tavily Search cho mỗi địa điểm chưa có enrichment.
- Ảnh, phần tóm tắt, giờ mở cửa, rating, review count, review highlights và
  danh sách nguồn.
- Lưu raw response để có thể kiểm tra cách một field được tạo ra.
- Trạng thái tải, thành công, không tìm thấy và lỗi tạm thời trên giao diện.
- Thiết kế responsive cho desktop và mobile.

Không bao gồm:

- Bulk-enrich toàn bộ cơ sở dữ liệu.
- Tự động làm mới dữ liệu đã lưu.
- Crawl toàn bộ review hoặc suy diễn phân bố review theo số sao.
- Đưa Tavily API key xuống frontend.
- Download ảnh Tavily về máy chủ hoặc tuyên bố quyền sở hữu ảnh.

## Các quyết định chính

### Endpoint riêng thay vì chặn endpoint địa điểm

`GET /api/places/{type}/{id}` tiếp tục trả dữ liệu Overture hiện có. Frontend gọi
thêm `POST /api/places/{type}/{id}/enrichment` sau khi dữ liệu cơ bản đã xuất
hiện. Cách này giữ trang sử dụng được khi Tavily chậm hoặc lỗi.

Endpoint `POST` được chọn vì lần gọi đầu có side effect là tạo enrichment. Các
lần gọi sau có tính idempotent: cùng một địa điểm sẽ trả bản ghi đã lưu.

### Bảng enrichment riêng

Không lưu Tavily vào `place_photos.details`. Bảng đó đang được `meta_service`
và `photo_service` cập nhật; cả hai có đường ghi JSON riêng nên ghép thêm Tavily
vào đó tạo nguy cơ ghi đè dữ liệu và làm bảng ảnh gánh nhiều trách nhiệm.

Schema:

```sql
CREATE TABLE IF NOT EXISTS place_enrichments (
    id           BIGSERIAL PRIMARY KEY,
    place_type   VARCHAR(20) NOT NULL,
    place_id     INTEGER NOT NULL,
    provider     VARCHAR(30) NOT NULL DEFAULT 'tavily',
    status       VARCHAR(20) NOT NULL,
    summary      TEXT,
    opening_hours JSONB,
    rating       JSONB,
    review_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    images       JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources      JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_response JSONB,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (place_type, place_id),
    CHECK (place_type IN ('poi', 'accommodation')),
    CHECK (status IN ('fetching', 'success', 'not_found'))
);
```

Không tạo foreign key đa hình vì `place_id` có thể trỏ vào `poi` hoặc
`accommodation`. Service luôn kiểm tra địa điểm tồn tại trước khi tạo bản ghi.

### Quy tắc cache

- `success`: trả bản ghi đã lưu mãi mãi, không gọi Tavily lại.
- `not_found`: trả bản ghi đã lưu mãi mãi, không gọi Tavily lại.
- Timeout, DNS, HTTP 429 và HTTP 5xx: xóa/không tạo cache cuối cùng; lần mở sau
  được phép thử lại.
- `fetching` mới hơn 90 giây: request khác nhận HTTP 202 và frontend poll.
- `fetching` cũ hơn 90 giây: coi là lần chạy chết và cho một request chiếm lại.

Việc chiếm job dùng một `INSERT ... ON CONFLICT DO NOTHING` nguyên tử. Request
thắng race gọi Tavily; request còn lại không gọi provider. Đây là chống trùng ở
mức PostgreSQL, hoạt động cả khi backend chạy nhiều worker.

## Tavily request

Ứng dụng đọc cả `TAVILY_API_KEY` (tên chuẩn) và `TAVILI_API_KEY` (tên đang có
trong `~/.zshrc`), ưu tiên tên chuẩn. Secret chỉ tồn tại ở backend.

Mỗi địa điểm dùng một Search request:

```json
{
  "query": "<tên>, <địa chỉ>, <thành phố>. Find current opening hours, rating, review count, representative review highlights, short travel description and official photos. Distinguish the exact branch.",
  "topic": "general",
  "search_depth": "basic",
  "max_results": 8,
  "include_answer": true,
  "include_images": true,
  "include_image_descriptions": true,
  "include_raw_content": false
}
```

Điện thoại, website và Facebook URL được thêm vào query khi có. Không truyền
`country=vietnam` vì phép thử thực tế ngày 2026-09-04 trả rỗng khi dùng tham số
này, trong khi cùng truy vấn không ép country trả kết quả.

Timeout Tavily là 20 giây. Response lớn hơn 1 MiB bị từ chối. Backend dùng
`requests`, là dependency sẵn có, thay vì thêm SDK chỉ cho một HTTP endpoint.

## Chuẩn hóa và độ tin cậy

Raw Tavily `answer` không phải nguồn chứng minh. Backend chỉ nhận field có bằng
chứng trực tiếp trong `results[].content`.

Trước khi trích field, một result phải được gắn với đúng địa điểm bằng ít nhất
một trong các bằng chứng: domain trùng website Overture; phone trùng; hoặc tên
địa điểm khớp cùng địa chỉ/locality. Chỉ gần tên mà không có locality không đủ
cho chuỗi cửa hàng. Result không qua bước định danh vẫn được giữ trong raw
response nhưng không được dùng làm enrichment.

### Rating

Một rating hợp lệ phải có:

- Giá trị từ 0 đến 5.
- Rating và review count cùng xuất hiện trong một result content, hoặc rating có
  nhãn rõ ràng `/5` hay `stars`.
- `source_url` và tên host của result.

Nếu nhiều nguồn có rating, ưu tiên website chính thức; sau đó ưu tiên nguồn có
review count lớn nhất. Không trộn rating của nguồn này với review count của
nguồn khác. Cấu trúc lưu:

```json
{
  "value": 4.7,
  "review_count": 7813,
  "provider": "GetYourGuide",
  "source_url": "https://...",
  "evidence": "4.7 (7,813 reviews)"
}
```

Không tạo `rating_distribution` khi nguồn không công khai histogram.

### Review highlights

Lưu tối đa ba nhận xét đại diện khi snippet nói rõ về đúng địa điểm. Mỗi phần tử
có `{text, sentiment, source_title, source_url}`. `text` là bản tóm tắt ngắn,
không sao chép quá 280 ký tự từ một review. Không gọi nội dung quảng cáo, mô tả
tour hay rating của một tour con là review của địa điểm.

### Giờ mở cửa

Giờ mở cửa chỉ được nhận khi result content chứa nhãn như `opening hours`,
`open`, `hours`, `giờ mở cửa` cùng khoảng thời gian. Website trùng domain với
`poi.tags.website` được ưu tiên. Nếu chỉ tìm được một vế như `Closes at 22:00`,
UI phải ghi đúng "Đóng cửa lúc 22:00", không tự tạo giờ mở cửa.

Cấu trúc lưu cho phép một chuỗi tổng quát hoặc lịch theo ngày:

```json
{
  "display": "08:00–22:00 hằng ngày",
  "weekly": null,
  "source_url": "https://...",
  "evidence": "Opening Hours: 8:00 AM – 10:00 PM"
}
```

### Summary và nguồn

`answer` được dùng làm summary sau khi loại bỏ câu khẳng định rating/hours không
có evidence. Nếu không thể lọc an toàn, summary được tạo từ hai result content
đã qua bước định danh có điểm cao nhất và giới hạn 600 ký tự.

`success` yêu cầu ít nhất một field có nguồn hợp lệ trong summary, opening hours,
rating, review highlights hoặc images. Nếu Tavily trả kết quả nhưng không có
result nào qua bước định danh thì lưu `not_found`.

`sources` chứa tối đa tám phần tử `{title, url, content, score}`. Chỉ nhận URL
HTTP(S), loại trùng theo canonical URL và không render content dưới dạng HTML.

### Ảnh

Lưu tối đa tám ảnh `{url, title, description, host}`. Chỉ nhận URL HTTPS. Ảnh
Tavily là hotlink tới nguồn ngoài và không có thông tin license, vì vậy UI luôn
hiện host nguồn; ảnh lỗi rơi về ảnh đang có trong `place_photos` hoặc ảnh category
fallback. Không ghi ảnh Tavily vào `place_photos.url`.

## API response

Khi đã lưu:

```json
{
  "status": "success",
  "cached": true,
  "enrichment": {
    "summary": "...",
    "opening_hours": {},
    "rating": {},
    "review_highlights": [],
    "images": [],
    "sources": [],
    "fetched_at": "2026-09-04T...Z"
  }
}
```

Lần fetch đầu thành công trả cùng shape với `cached: false`. Khi request khác
đang chạy, endpoint trả HTTP 202 với `{status: "fetching"}`. Frontend poll tối đa
ba lần, cách nhau hai giây; sau đó giữ nguyên dữ liệu cơ bản.

Không trả `raw_response` ra public API. Raw response chỉ lưu trong DB để debug.

## Thiết kế giao diện

### Ngôn ngữ thị giác

Trang mang tinh thần sổ tay thực địa du lịch: ảnh địa điểm và thông tin thực dụng
là cấu trúc chính. Không dùng một lưới các card bo tròn đồng hạng.

Token màu:

- `forest`: `#0B5D42` — hành động và liên kết chính.
- `deep-forest`: `#073B2A` — tiêu đề và nền nhấn.
- `field`: `#F4F6F2` — nền trang.
- `paper`: `#FFFFFF` — bề mặt nội dung.
- `ink`: `#17211C` — chữ chính.
- `star`: `#E9A928` — chỉ dùng cho rating.

Giữ `Be Vietnam Pro`; tiêu đề 700/800, nội dung 400/500. Mọi nội dung canh trái
và đoạn văn không dài quá khoảng 75 ký tự mỗi dòng trên desktop.

### Bố cục desktop

```text
Quay lại                                      Lưu địa điểm

Tên địa điểm
Loại hình · Địa chỉ

┌───────────────────────────────┬──────────────┐
│                               │  Ảnh phụ 1   │
│          Ảnh chính            ├──────────────┤
│                               │  Ảnh phụ 2   │
└───────────────────────────────┴──────────────┘

  Điểm rating      Số đánh giá      Giờ mở cửa
────────────────────────────────────────────────
┌────────────────────────────────┬───────────────┐
│ Giới thiệu                     │ Bản đồ        │
│ Giờ mở cửa                     │ Liên hệ       │
│ Khách đã nói gì                │               │
│ Nguồn thông tin                │ Hành động     │
└────────────────────────────────┴───────────────┘

Địa điểm gần đây
```

Gallery bất đối xứng là điểm nhấn duy nhất. Phần stats dùng một dải liên tục có
đường phân cách. Nội dung dùng nền giấy và rule, chỉ các nút hành động có bo góc
rõ. Bản đồ và hành động nằm trong cột phải sticky.

### Mobile

- Tên và địa chỉ đứng trước gallery.
- Gallery thành một ảnh chính và rail ảnh ngang có scroll snap.
- Stats xếp thành hai cột; giờ mở cửa chiếm toàn hàng khi cần.
- Cột phải chuyển xuống sau phần giờ mở cửa.
- Link nguồn có vùng bấm tối thiểu 44 px.

### Trạng thái dữ liệu

- Dữ liệu Overture xuất hiện ngay.
- Khi enrichment đang chạy, gallery và dải stats dùng skeleton riêng; không che
  toàn trang.
- `success`: hiện dữ liệu kèm `Nguồn` cạnh từng field và dòng "Thông tin công
  khai được lưu ngày ...".
- `not_found`: hiện "Chưa tìm thấy thông tin công khai bổ sung"; không tạo vùng
  trống lớn.
- Lỗi tạm thời: hiện "Chưa tải được dữ liệu web; ứng dụng sẽ thử lại ở lần mở
  sau".

## Bảo mật và vận hành

- Client chỉ gửi `place_type` và `place_id`; backend tự dựng query từ DB để tránh
  biến endpoint thành proxy tìm kiếm tùy ý.
- Chặn SSRF bằng cách không fetch các URL do Tavily trả về; frontend chỉ render
  URL HTTPS qua thuộc tính ảnh/link.
- API key không ghi vào log, response hoặc DB.
- Log provider status, thời gian và place ID; không log secret hay toàn bộ raw
  response.
- Đặt giới hạn độ dài mọi chuỗi trước khi ghi DB.

## Kiểm thử

Backend unit tests dùng mock HTTP, không tiêu Tavily credit:

- Cache `success` và `not_found` không gọi provider lần hai.
- Timeout/429 không tạo cache vĩnh viễn.
- Hai request cùng place chỉ một request chiếm job.
- Job `fetching` quá 90 giây được chạy lại.
- Parser không trộn rating và review count từ hai nguồn.
- Parser không suy diễn giờ mở cửa còn thiếu một đầu.
- Parser không nhận review của tour con làm review của địa điểm.
- Result sai locality/chi nhánh không được dùng làm enrichment.
- URL không phải HTTP(S) bị loại.
- Raw response được lưu nhưng không xuất ra API.

API surface test bổ sung endpoint mới. Frontend test/kiểm tra build bao phủ các
trạng thái loading, success, not found và lỗi; kiểm tra link nguồn dùng
`rel="noopener noreferrer"`.

Sau khi chạy local, kiểm tra thủ công trang `/dia-diem/poi/265670` ở desktop và
mobile. Nếu môi trường có Chrome/CDP thì chụp ảnh và kiểm tra không có lỗi
JavaScript; nếu không có thì ghi rõ giới hạn xác minh thay vì tuyên bố đã kiểm
tra hình ảnh.

## Tiêu chí hoàn thành

- Lần đầu mở POI chưa có enrichment phát sinh đúng một Tavily Search.
- Bản ghi `success` hoặc `not_found` được đọc lại mà không gọi Tavily.
- Trang cơ bản vẫn hiển thị khi Tavily lỗi hoặc chậm.
- Rating/hours hiển thị đúng nguồn và evidence đã lưu.
- Ảnh Tavily có ghi host nguồn và fallback khi tải lỗi.
- API key không xuất hiện trong bundle frontend, log hay API response.
- Giao diện responsive, điều hướng bàn phím được và tôn trọng reduced motion.
