# Bộ tài liệu GeoAI Tourism

Bộ tài liệu này mô tả hệ thống du lịch thông minh trong repository. Tài liệu được đối chiếu với mã nguồn trong `backend/app`, giao diện trong `web/src`, cơ sở dữ liệu trong `db/` và các bài kiểm thử trong `backend/tests`.

## Danh mục 10 tài liệu

1. [Tổng quan hệ thống](01-tong-quan-he-thong.md)
2. [Yêu cầu nghiệp vụ và đặc tả chức năng](02-yeu-cau-nghiep-vu.md)
3. [Kiến trúc và thiết kế kỹ thuật](03-kien-truc-ky-thuat.md)
4. [Thiết kế cơ sở dữ liệu và dữ liệu](04-co-so-du-lieu.md)
5. [Đặc tả API](05-dac-ta-api.md)
6. [Hướng dẫn người dùng](06-huong-dan-nguoi-dung.md)
7. [Hướng dẫn quản trị và nhà điều hành](07-quan-tri-van-hanh.md)
8. [Cài đặt, cấu hình và triển khai](08-cai-dat-trien-khai.md)
9. [Kiểm thử và đánh giá](09-kiem-thu-danh-gia.md)
10. [Bảo mật, rủi ro và lộ trình](10-bao-mat-rui-ro-lo-trinh.md)

## Phạm vi và quy ước

- Tên endpoint dùng đúng đường dẫn hiện có trong FastAPI.
- Các tính năng thanh toán Stripe được mô tả là tích hợp tùy cấu hình; không coi khóa test là cấu hình production.
- Dữ liệu `rating`, `review_count`, `price_level` và `stars` hiện chưa phải dữ liệu đánh giá thực tế theo README của dự án.
- Những mục ghi “chưa có” hoặc “cần bổ sung” là giới hạn đã phát hiện, không phải cam kết tính năng.

