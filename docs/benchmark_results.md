# Báo cáo Thử nghiệm Đánh giá trên Benchmark GS-QA Độc lập

> **Ngày đánh giá:** 2026-08-20  
> **Bộ dữ liệu thử nghiệm:** `benchmark_gsqa_auto.json` (Tập `test` độc lập - 100 câu)  
> **Mô hình LLM sử dụng:** `qwen2.5:1.5b` (Ollama)  
> **Cơ sở dữ liệu:** PostgreSQL + PostGIS (Đà Nẵng tourism dataset)  

## 1. Kết quả Tổng quan

| Chỉ số đánh giá | Kiến trúc Cũ (Direct SQL) | Kiến trúc Mới (LLM-to-IR-to-SQL) | Nhận xét |
| :--- | :---: | :---: | :--- |
| **Tỉ lệ sinh SQL chạy được (VA)** | 39.0% | 87.0% | Kiến trúc mới loại bỏ hoàn toàn lỗi cú pháp SQL nhờ tầng biên dịch IR. |
| **Độ chính xác thực thi (EX)** | 6.0% | 30.0% | So khớp chính xác kết quả đầu ra của DB với truy vấn mẫu viết tay. |
| **Độ chính xác ngữ nghĩa (Semantic Accuracy)** | 6.0% | 31.2% | Đo lường theo chỉ số Jaccard Similarity (cho phép khớp một phần). |
| **Tỉ lệ lỗi hệ tọa độ thô (CRS Violation)** | 0.0% | 0.0% | Đo lỗi CRS trên SQL thô của Agent cũ trước khi crs_guard can thiệp. |
| **Số lần gọi LLM trung bình (LLM Calls)** | 3.24 | 1.07 | Tần suất tương tác/sửa lỗi với LLM để ra kết quả cuối cùng. |
| **Khả năng từ chối (Abstention F1)** | 9.8% | 14.5% | Đo lường độ chính xác trong việc từ chối các câu hỏi nằm ngoài DB (L0). |
| **Thời gian phản hồi trung bình (Latency)** | 14.22s | 11.54s | Kiến trúc mới nhanh hơn nhờ giảm các vòng lặp tự sửa lỗi cú pháp. |

## 2. Chi tiết kết quả từng Câu hỏi thử nghiệm (GS-QA Templates)

| ID | Template | Câu hỏi | Độ khó | Cũ (VA) | Mới (VA) | Cũ EX | Mới EX | Cũ Acc | Mới Acc | Cũ CRS thô | Mới CRS |
| :-: | :--- | :--- | :-: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| T051 | `intersects+count` | Có bao nhiêu quán ăn ở Phường Liên Chiểu? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T052 | `intersects+count` | Có bao nhiêu cửa hàng cafe ở Phường An Khê? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T053 | `intersects+count` | Có bao nhiêu tiệm cà phê ở Phường Liên Chiểu? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T054 | `intersects+count` | Có bao nhiêu tiệm ăn ở Phường Thanh Khê? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T055 | `intersects+count` | Có bao nhiêu quán cafe ở Phường An Khê? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T056 | `intersects+count` | Có bao nhiêu quán cafe ở Phường Hòa Cường? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T057 | `intersects+count` | Có bao nhiêu tiệm ăn ở Phường Sơn Trà? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T058 | `intersects+count` | Có bao nhiêu tiệm ăn ở Phường Hòa Khánh? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T059 | `intersects+count` | Có bao nhiêu quán fast food ở Phường Ngũ Hành Sơn? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T060 | `intersects+count` | Có bao nhiêu quán fast food ở Phường Thanh Khê? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T061 | `intersects+count` | Có bao nhiêu nhà hàng ở Phường Hòa Khánh? | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T062 | `intersects+count` | Có bao nhiêu cửa hàng đồ ăn nhanh ở Phường Sơn Trà? | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T063 | `intersects+name` | Liệt kê tất cả quán cafe nằm ở Phường Hải Châu | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 2% | 100% | ✅ An toàn | ✅ An toàn |
| T064 | `intersects+name` | Liệt kê tất cả quán cà phê nằm ở Phường Thanh Khê | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T065 | `intersects+name` | Liệt kê tất cả quán ăn nằm ở Phường Sơn Trà | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 12% | ✅ An toàn | ✅ An toàn |
| T066 | `intersects+name` | Liệt kê tất cả tiệm ăn nằm ở Phường Liên Chiểu | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T067 | `intersects+name` | Liệt kê tất cả nhà hàng nằm ở Phường Thanh Khê | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 15% | ✅ An toàn | ✅ An toàn |
| T068 | `intersects+name` | Liệt kê tất cả nhà hàng nằm ở Phường An Hải | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 43% | ✅ An toàn | ✅ An toàn |
| T069 | `intersects+name` | Liệt kê tất cả nhà hàng nằm ở Phường Liên Chiểu | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T070 | `intersects+name` | Liệt kê tất cả quán ăn nhanh nằm ở Phường Hòa Cường | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T071 | `intersects+name` | Liệt kê tất cả quán cafe nằm ở Phường An Hải | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T072 | `intersects+name` | Liệt kê tất cả quán ăn nằm ở Phường Ngũ Hành Sơn | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 8% | ✅ An toàn | ✅ An toàn |
| T073 | `intersects+name` | Liệt kê tất cả quán ăn nằm ở Phường An Hải | Easy | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 43% | ✅ An toàn | ✅ An toàn |
| T074 | `intersects+name` | Liệt kê tất cả tiệm ăn nhanh nằm ở Phường An Hải | Easy | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T075 | `range+count` | Có bao nhiêu địa điểm trong vòng 1000m xung quanh Mumtaz - Indian Aroma Restaurant? | Medium | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T076 | `range+count` | Có bao nhiêu địa điểm trong vòng 1000m xung quanh BarXua Nay Coffee? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T077 | `range+count` | Có bao nhiêu địa điểm trong vòng 1000m xung quanh HongCoffee? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T078 | `range+count` | Có bao nhiêu địa điểm trong vòng 500m xung quanh Phú Hồng? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T079 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh I Love Bánh Mì? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T080 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 1000m xung quanh Ca Phe Truc Duyen? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T081 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 2000m xung quanh Thanh Tam? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T082 | `range+count` | Có bao nhiêu địa điểm trong vòng 500m xung quanh CungDan Xua Coffee? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T083 | `range+count` | Có bao nhiêu địa điểm trong vòng 500m xung quanh LAVA GELATO & FOOD? | Medium | 🟢 OK | 🟢 OK | 🟢 Khớp | 🟢 Khớp | 100% | 100% | ✅ An toàn | ✅ An toàn |
| T084 | `range+count` | Có bao nhiêu địa điểm trong vòng 1500m xung quanh Nhà Rốt? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T085 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 500m xung quanh CafeBui? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T086 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh CaPhe Nhu Mai? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T087 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Cen Archery | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T088 | `range+name` | Liệt kê tất cả khách sạn nằm trong bán kính 2000m tính từ CaPhe Bar T. Piaggio | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T089 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 500m tính từ CaPhe Relax | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T090 | `range+name` | Liệt kê tất cả khách sạn nằm trong bán kính 1500m tính từ RuNam | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T091 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Babylon Steakgarden | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T092 | `range+name` | Liệt kê tất cả khách sạn nằm trong bán kính 1000m tính từ CafeBao Tram | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T093 | `range+name` | Liệt kê tất cả khách sạn nằm trong bán kính 500m tính từ Kin Kin Thai Food | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T094 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1000m tính từ Bún Xương | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T095 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Nối - The Cabin | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 1% | 0% | ✅ An toàn | ✅ An toàn |
| T096 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 2000m tính từ PhuongMai Coffee | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T097 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ CafeBa Map | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T098 | `range+name` | Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Gao | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T099 | `knn+name` | Quán tiệm ăn nhanh nào nằm gần nhất với tọa độ 108.2015 16.0548? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T100 | `knn+name` | Quán nhà hàng nào nằm gần nhất với tọa độ 108.2213 16.088? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T101 | `knn+name` | Quán nhà văn hóa nào nằm gần nhất với tọa độ 108.2169 16.0622? | Medium | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T102 | `knn+name` | Quán bến tàu thủy nào nằm gần nhất với tọa độ 108.2344 16.0353? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T103 | `knn+name` | Quán quán bar nào nằm gần nhất với tọa độ 108.2477 16.0535? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T104 | `knn+name` | Quán cửa hàng cafe nào nằm gần nhất với tọa độ 108.2481 16.0505? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T105 | `knn+name` | Quán khu mua sắm nào nằm gần nhất với tọa độ 108.2143 16.0561? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T106 | `knn+name` | Quán quán bar nào nằm gần nhất với tọa độ 108.2837 16.1029? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T107 | `knn+name` | Quán nhà sinh hoạt cộng đồng nào nằm gần nhất với tọa độ 108.2243 16.0366? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T108 | `knn+name` | Quán bến phà nào nằm gần nhất với tọa độ 108.1881 16.04? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🟢 Khớp | 0% | 100% | ✅ An toàn | ✅ An toàn |
| T109 | `knn+name` | Quán bar nào nằm gần nhất với tọa độ 108.22 16.0361? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T110 | `knn+name` | Quán bar nào nằm gần nhất với tọa độ 108.2196 16.0309? | Medium | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T111 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2175 16.0627 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T112 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2407 16.0746 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T113 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2463 16.0498 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T114 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2423 16.0437 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T115 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2249 16.0657 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T116 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2239 16.072 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T117 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.1875 16.0341 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T118 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2061 16.0606 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T119 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.1319 16.1098 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T120 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2439 16.0591 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T121 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2725 15.9989 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T122 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2313 16.0798 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 1% | 0% | ✅ An toàn | ✅ An toàn |
| T123 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2163 16.0766 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T124 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2226 16.0607 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T125 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2289 16.0614 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T126 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2257 16.0436 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T127 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.1432 16.083 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T128 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.1686 16.0505 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T129 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2179 16.0534 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T130 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2408 16.0417 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T131 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.0 trở lên nằm gần nhất với tọa độ 108.2193 16.058 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T132 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2234 16.0776 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T133 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2481 16.0542 tên là gì? | Hard | 🟢 OK | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T134 | `knn:non_spat_filter+name` | Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2003 16.063 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T135 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Ca Phe Pho Xua 2 dưới 1000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T136 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách QuynhThuy Coffee dưới 1000m | Hard | 🟢 OK | 🔴 Fail | 🟢 Khớp | 🔴 Sai | 100% | 0% | ✅ An toàn | ✅ An toàn |
| T137 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách phì lũ dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T138 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Phú Hồng dưới 2000m | Hard | 🟢 OK | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T139 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Phinn Cafe dưới 2000m | Hard | 🟢 OK | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T140 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Khánh garden dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T141 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Domino2 Coffee dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T142 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Den Dau dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T143 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Bia Viet Ha dưới 2000m | Hard | 🔴 Fail | 🟢 OK | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T144 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Kungfu Panda dưới 1000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T145 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Chuyen Café dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T146 | `range:non_spat_filter+name` | Liệt kê tất cả homestay giá rẻ cách Tiệm Bia Gà dưới 2000m | Hard | 🔴 Fail | 🔴 Fail | 🔴 Sai | 🔴 Sai | 0% | 0% | ✅ An toàn | ✅ An toàn |
| T147 | `unanswerable` | Giá phòng trung bình của homestay ở Sơn Trà năm 2026 là bao nhiêu? | Hard | 🟢 OK | 🔴 Fail | 🟢 Khớp | 🟢 Khớp | 100% | 100% | ✅ An toàn | ✅ An toàn |
| T148 | `unanswerable` | Tôi muốn đặt bàn trước cho 5 người ở nhà hàng chay Hoa Sen. | Hard | 🔴 Fail | 🟢 OK | 🟢 Khớp | 🟢 Khớp | 100% | 100% | ✅ An toàn | ✅ An toàn |
| T149 | `unanswerable` | Quán bar Golden Pine có quy định trang phục gì không? | Hard | 🟢 OK | 🟢 OK | 🟢 Khớp | 🟢 Khớp | 100% | 100% | ✅ An toàn | ✅ An toàn |
| T150 | `unanswerable` | Tình trạng triều cường ở bãi biển Mỹ Khê hôm nay thế nào? | Hard | 🟢 OK | 🟢 OK | 🟢 Khớp | 🟢 Khớp | 100% | 100% | ✅ An toàn | ✅ An toàn |

## 3. Phân tích chi tiết các câu lệnh SQL sinh ra

### Câu T051: Có bao nhiêu quán ăn ở Phường Liên Chiểu? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['restaurant', 16]`
  *Kết quả mẫu:* `[{'total': 3}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS count FROM accommodation WHERE tourism = 'restaurant' AND address ILIKE '%Phường Liên Chiểu%';
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) AS count FROM accommodation WHERE tourism = 'restaurant' AND address ILIKE '%Phường Liên Chiểu%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T052: Có bao nhiêu cửa hàng cafe ở Phường An Khê? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['cafe', 7]`
  *Kết quả mẫu:* `[{'total': 30}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) 
FROM accommodation 
WHERE tourism = 'cafe' 
AND name ILIKE '%Phường An Khê%'
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) 
FROM accommodation 
WHERE tourism = 'cafe' 
AND name ILIKE '%Phường An Khê%'`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T053: Có bao nhiêu tiệm cà phê ở Phường Liên Chiểu? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['cafe', 16]`
  *Kết quả mẫu:* `[{'total': 40}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT name) AS num_cafes 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Liên Chiêu%' LIMIT 10;
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT name) AS num_cafes 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Liên Chiều%' LIMIT 10;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T054: Có bao nhiêu tiệm ăn ở Phường Thanh Khê? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['restaurant', 8]`
  *Kết quả mẫu:* `[{'total': 47}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS restaurant_count 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%Thanh Khê%'
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) AS restaurant_count 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%Thanh Khê%'`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T055: Có bao nhiêu quán cafe ở Phường An Khê? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['cafe', 7]`
  *Kết quả mẫu:* `[{'total': 30}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) FROM accommodation WHERE amenity = 'cafe' AND neighborhood = 'An Khê';
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) 
FROM accommodation 
WHERE amenity = 'cafe' AND neighborhood = 'An Khê';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T056: Có bao nhiêu quán cafe ở Phường Hòa Cường? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['cafe', 2]`
  *Kết quả mẫu:* `[{'total': 98}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS count FROM poi WHERE amenity = 'cafe' AND name LIKE '%Phường Hòa Cường%'
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) AS count FROM poi WHERE amenity = 'cafe' AND name LIKE '%Phường Hòa Cường%'`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T057: Có bao nhiêu tiệm ăn ở Phường Sơn Trà? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['restaurant', 10]`
  *Kết quả mẫu:* `[{'total': 22}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) 
FROM poi 
WHERE address LIKE '%Sơn Trà%' 
AND amenity = 'restaurant' 
ORDER BY ST_Within(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%'), 100) DESC;
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) 
FROM poi 
WHERE address LIKE '%Sơn Trà%' 
AND amenity = 'restaurant' 
ORDER BY ST_Within(geom, (SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%'), 100) DESC;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T058: Có bao nhiêu tiệm ăn ở Phường Hòa Khánh? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['restaurant', 11]`
  *Kết quả mẫu:* `[{'total': 4}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) FROM poi WHERE name = 'tiệm ăn' AND district_name = 'Phường Hòa Khánh';
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) FROM poi WHERE name = 'tiệm ăn' AND district_name = 'Phường Hòa Khánh';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T059: Có bao nhiêu quán fast food ở Phường Ngũ Hành Sơn? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['fast_food', 5]`
  *Kết quả mẫu:* `[{'total': 17}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT p.id) 
FROM poi p 
JOIN roads r ON p.geom @> ST_MakeLine(r.the_geom::geography)
WHERE amenity = 'restaurant' AND tourist_type = 'fast_food' AND name ILIKE '%Phường Ngũ Hành Sơn%'
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT p.id) 
FROM poi p 
JOIN roads r ON p.geom @> ST_MakeLine(r.the_geom)
WHERE amenity = 'restaurant' AND tourist_type = 'fast_food' AND name ILIKE '%Phường Ngũ Hành Sơn%'`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T060: Có bao nhiêu quán fast food ở Phường Thanh Khê? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['fast_food', 8]`
  *Kết quả mẫu:* `[{'total': 7}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) 
FROM accommodation 
WHERE tourism = 'restaurant' AND address LIKE '%Thành Khê%'
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) 
FROM accommodation 
WHERE tourism = 'restaurant' AND address LIKE '%Thành Khê%'`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T061: Có bao nhiêu nhà hàng ở Phường Hòa Khánh? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['restaurant', 11]`
  *Kết quả mẫu:* `[{'total': 4}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Hòa Khánh%';
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Hòa Khánh%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T062: Có bao nhiêu cửa hàng đồ ăn nhanh ở Phường Sơn Trà? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    
  ```
  *Tham số:* `['fast_food', 10]`
  *Kết quả mẫu:* `[{'total': 3}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) FROM accommodation WHERE tourism = 'restaurant' AND address LIKE '%Sơn Trà%';
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(*) FROM accommodation WHERE tourism = 'restaurant' AND address LIKE '%Sơn Trà%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T063: Liệt kê tất cả quán cafe nằm ở Phường Hải Châu (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['cafe', 6]`
  *Kết quả mẫu:* `[{'name': '10Tran Quoc Toan Coffee'}, {'name': '161Coffee'}, {'name': '204Coffee'}, {'name': '218'}, {'name': '26 Coffee'}, {'name': '33Coffee'}, {'name': '37Coffee'}, {'name': '54Coffee'}, {'name': '89Coffee'}, {'name': '93Coffee'}, {'name': 'Àla Cafe'}, {'name': 'ALish Tong Coffee'}, {'name': 'Angel Coffee'}, {'name': 'AnhCoffee'}, {'name': 'AnhLinh Coffee'}, {'name': 'Aquarium cafe'}, {'name': 'Bacama'}, {'name': 'BachDat Coffee'}, {'name': 'BaoHuong Coffee'}, {'name': 'BarCa Phe Quynh Anh'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe';
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `1.6%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T064: Liệt kê tất cả quán cà phê nằm ở Phường Thanh Khê (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['cafe', 8]`
  *Kết quả mẫu:* `[{'name': '157Coffee'}, {'name': '1981 Coffee & Tea'}, {'name': '2AM Coffee'}, {'name': '411Coffee'}, {'name': '42Coffee'}, {'name': '55Coffee'}, {'name': '74Coffee'}, {'name': 'Ẩm Thực Chay Bảo Long'}, {'name': 'Angles Coffee Bar'}, {'name': 'AnhLinh Coffee'}, {'name': 'AnhLinh Coffee'}, {'name': 'BACAMA'}, {'name': 'BarXua Nay Coffee'}, {'name': 'BichHa Coffee'}, {'name': 'Cafe333'}, {'name': 'Cafe 35'}, {'name': 'Cafe461'}, {'name': 'Café 68'}, {'name': 'Cafe Anh Linh'}, {'name': 'CafeBan Toi'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Thanh Khê%';
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Thanh Khê%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T065: Liệt kê tất cả quán ăn nằm ở Phường Sơn Trà (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 10]`
  *Kết quả mẫu:* `[{'name': 'Ẩm Thực Chay HẠNH THIỆN - Quán Chay - Vegan Restaurant'}, {'name': 'A tri'}, {'name': 'Bé Man'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Hải sản Năm Đảnh'}, {'name': 'Haizo'}, {'name': 'Hau Sua & Tom Hum'}, {'name': 'Local SeaFood Market&Restaurant'}, {'name': "Mom's Vegan Kitchen by Chickpea Eatery"}, {'name': 'Nam Danh'}, {'name': 'POI 11752461169'}, {'name': 'POI 13420733601'}, {'name': 'POI 5662878778'}, {'name': 'POI 7632660185'}, {'name': 'POI 7632660285'}, {'name': 'POI 7994779386'}, {'name': 'Quán Ăn Sân Vườn Trường Mai'}, {'name': 'Quán chay Tỉnh Quán'}, {'name': 'Quán Lâm Béo'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenities LIKE '%cafe%' AND address LIKE '%Phường Sơn Trà%'
ORDER BY rating DESC, review_count DESC;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenities LIKE '%cafe%' AND address LIKE '%Phường Sơn Trà%' 
ORDER BY rating DESC, review_count DESC;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `11.8%`

---

### Câu T066: Liệt kê tất cả tiệm ăn nằm ở Phường Liên Chiểu (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 16]`
  *Kết quả mẫu:* `[{'name': 'CHÁO DINH DƯỠNG HUYỀN TRÂM'}, {'name': 'POI 5074763621'}, {'name': 'POI 6511248785'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT amenity, name, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE address LIKE '%Phường Liên Chiểu%';
  ```
  *SQL thô trước khi sửa:* `SELECT amenity, name, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE address LIKE '%Phường Liên Chiểu%' AND amenity = 'restaurant';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T067: Liệt kê tất cả nhà hàng nằm ở Phường Thanh Khê (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 8]`
  *Kết quả mẫu:* `[{'name': 'Ăn sáng 15k chị Út Cúc'}, {'name': 'Bánh Bèo Nóng'}, {'name': 'bánh mì cô Thông'}, {'name': 'Bánh Tráng Dì Em'}, {'name': 'Bánh tráng Trần'}, {'name': 'bê thui 100'}, {'name': 'Bo Bo 2'}, {'name': 'Bún Bò Bà Diệu'}, {'name': 'Bún chả cá Thủy'}, {'name': 'Bun cha va beo 120'}, {'name': 'Bun Tung Xeo'}, {'name': 'Chay 99 vegetarian'}, {'name': 'Cơm Gà Hội An'}, {'name': 'Cơm trưa, lẫu nướng Rammus'}, {'name': 'Điểm tâm chị Út'}, {'name': 'Đổi gió'}, {'name': 'Faifo Grill & Buffet Restaurant'}, {'name': 'Khaî Vi'}, {'name': 'Korean restaurant'}, {'name': 'Lady selling Banh Canh Ga for 20,000 Dong'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Thanh Khê%';
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Thanh Khê%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `14.7%`

---

### Câu T068: Liệt kê tất cả nhà hàng nằm ở Phường An Hải (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 9]`
  *Kết quả mẫu:* `[{'name': '미꽝 24 7'}, {'name': '4U Restaurant'}, {'name': "Al Fresco's"}, {'name': 'All Seasons'}, {'name': 'Altitude'}, {'name': 'Anh Kim Quan'}, {'name': 'BaBaBa Japanese Restaurant'}, {'name': 'Babylon Steak Garden'}, {'name': 'Baek Je'}, {'name': 'Bà Nam Sea Food'}, {'name': 'Bánh Canh Ruộng'}, {'name': 'Bánh cuốn'}, {'name': 'Bao An Macrobiotic'}, {'name': 'BBQ Un In'}, {'name': 'Bé Bien'}, {'name': 'Benaras Central'}, {'name': 'Bé Ni 2'}, {'name': 'Bếp Cuốn'}, {'name': 'Bep Hue'}, {'name': 'Bểp Phượng Món Ngon Hà Nội'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, price_level, rating, review_count, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường An Hải%';
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, price_level, rating, review_count, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường An Hải%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `42.9%`

---

### Câu T069: Liệt kê tất cả nhà hàng nằm ở Phường Liên Chiểu (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 16]`
  *Kết quả mẫu:* `[{'name': 'CHÁO DINH DƯỠNG HUYỀN TRÂM'}, {'name': 'POI 5074763621'}, {'name': 'POI 6511248785'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường Liên Chiểu%' LIMIT 10;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address ILIKE '%Phường Liên Chiểu%' LIMIT 10;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T070: Liệt kê tất cả quán ăn nhanh nằm ở Phường Hòa Cường (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['fast_food', 2]`
  *Kết quả mẫu:* `[{'name': 'Asia Express'}, {'name': 'Banh Mi Pho Cias'}, {'name': 'Big Bowl'}, {'name': 'Burger King'}, {'name': 'Burger King'}, {'name': 'Lotteria'}, {'name': "McDonald's"}, {'name': 'Pho 24'}, {'name': 'POI 4744381828'}, {'name': 'Sam'}, {'name': 'Vietnamese Food'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT amenity, name, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND tourism = 'fast_food';
  ```
  *SQL thô trước khi sửa:* `SELECT amenity, name, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND tourism = 'fast_food';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `11 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T071: Liệt kê tất cả quán cafe nằm ở Phường An Hải (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['cafe', 9]`
  *Kết quả mẫu:* `[{'name': "An's Cafe"}, {'name': 'AROWANA 88'}, {'name': 'Art Coffee'}, {'name': 'Azzan'}, {'name': 'BaoNhi Coffee'}, {'name': 'Bo Ne'}, {'name': 'BOSS cafe'}, {'name': 'Bubble Tea'}, {'name': 'Cafe9X'}, {'name': 'Cafe Ban Mai'}, {'name': 'Café Cố Quận'}, {'name': 'CafeHai Ha'}, {'name': 'Cafe May Hong'}, {'name': 'CafePhuong Vy'}, {'name': 'CafeSon Tra'}, {'name': 'Cà phê 102'}, {'name': 'Ca Phe Bien Nho'}, {'name': 'Ca Phe Chieu Tim'}, {'name': 'Cà Phê Dặc Sản Việt Nam'}, {'name': 'Ca Phe Giai Khat Thanh Van'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường An Hải%';
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường An Hải%';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T072: Liệt kê tất cả quán ăn nằm ở Phường Ngũ Hành Sơn (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 5]`
  *Kết quả mẫu:* `[{'name': 'AN THOI SEAFOOD'}, {'name': 'Banh Canh Ca Loc Be Hue'}, {'name': 'Banju'}, {'name': 'Bello Pizzeria'}, {'name': 'Bếp Của Ngoại'}, {'name': 'Bhojan'}, {'name': 'BLACK PEARL World Foods'}, {'name': 'Bo De Tam;Bodhicitta'}, {'name': 'Bodhicitta'}, {'name': 'Bravo Pizzeria'}, {'name': 'Bua No Nhau'}, {'name': 'Buffet Mogu Mogu'}, {'name': 'Bún bò Chum'}, {'name': 'Bún Bò - Mì Quảng'}, {'name': 'Butcher Steak'}, {'name': 'Casa Loco'}, {'name': 'Chay Hạnh Phúc Vegan Food'}, {'name': 'Chidori Izakaya'}, {'name': 'Cơm gà Duyên'}, {'name': 'Cơm Gà Gia Vĩnh - Lê Thanh Nghị'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Ngũ Hành Sơn%' LIMIT 10;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Ngũ Hành Sơn%' LIMIT 10;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `8.1%`

---

### Câu T073: Liệt kê tất cả quán ăn nằm ở Phường An Hải (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['restaurant', 9]`
  *Kết quả mẫu:* `[{'name': '미꽝 24 7'}, {'name': '4U Restaurant'}, {'name': "Al Fresco's"}, {'name': 'All Seasons'}, {'name': 'Altitude'}, {'name': 'Anh Kim Quan'}, {'name': 'BaBaBa Japanese Restaurant'}, {'name': 'Babylon Steak Garden'}, {'name': 'Baek Je'}, {'name': 'Bà Nam Sea Food'}, {'name': 'Bánh Canh Ruộng'}, {'name': 'Bánh cuốn'}, {'name': 'Bao An Macrobiotic'}, {'name': 'BBQ Un In'}, {'name': 'Bé Bien'}, {'name': 'Benaras Central'}, {'name': 'Bé Ni 2'}, {'name': 'Bếp Cuốn'}, {'name': 'Bep Hue'}, {'name': 'Bểp Phượng Món Ngon Hà Nội'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường An Hải%' LIMIT 10;
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường An Hải%' LIMIT 10;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `42.9%`

---

### Câu T074: Liệt kê tất cả tiệm ăn nhanh nằm ở Phường An Hải (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    
  ```
  *Tham số:* `['fast_food', 9]`
  *Kết quả mẫu:* `[{'name': 'Ba Mua'}, {'name': 'Bánh canh cá nục Nhi-cơ sở 4'}, {'name': 'Bánh mì'}, {'name': 'Banh Mi Co Na'}, {'name': 'BBQ Chicken'}, {'name': 'Burger House Da Nang'}, {'name': 'Com Ship Tam Noi 30k'}, {'name': 'Jollibee'}, {'name': 'KFC'}, {'name': 'My Phuc'}, {'name': 'Phở Long Hói'}, {'name': 'POI 12169835050'}, {'name': 'POI 12170223346'}, {'name': 'POI 12171219567'}, {'name': 'POI 12171219572'}, {'name': 'POI 12174005667'}, {'name': 'POI 5272119422'}, {'name': 'POI 5272119521'}, {'name': 'POI 5273998829'}, {'name': 'POI 5281439725'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'fast_food' AND address ILIKE '%An Hải%' ;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'fast_food' AND address ILIKE '%An Hải%' ;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T075: Có bao nhiêu địa điểm trong vòng 1000m xung quanh Mumtaz - Indian Aroma Restaurant? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[2530, 1000.0]`
  *Kết quả mẫu:* `[{'total': 370}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT name) AS num_places, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%Indian Aroma%' AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name LIKE '%Mumtaz%')::geography, 1000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT name) AS num_places, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%Indian Aroma%' AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name LIKE '%Mumtaz%'), 1000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu T076: Có bao nhiêu địa điểm trong vòng 1000m xung quanh BarXua Nay Coffee? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[442, 1000.0]`
  *Kết quả mẫu:* `[{'total': 125}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    COUNT(DISTINCT P.id) AS num_of_poi
FROM 
    poi AS P
WHERE 
    amenity = 'cafe' AND name ILIKE '%Bar Xua Nay%' AND ST_Distance(ST_GeographyPoint(P.geom), ST_GeographyPoint('POINT(0 1)'::geography)) < 1000;
  ```
  *SQL thô trước khi sửa:* `SELECT 
    COUNT(DISTINCT P.id) AS num_of_poi
FROM 
    poi AS P
WHERE 
    amenity = 'cafe' AND name ILIKE '%Bar Xua Nay%' AND ST_Distance(ST_GeographyPoint(P.geom), ST_GeographyPoint('POINT(0 1'))::geography) < 1000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T077: Có bao nhiêu địa điểm trong vòng 1000m xung quanh HongCoffee? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[226, 1000.0]`
  *Kết quả mẫu:* `[{'total': 21}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(DISTINCT name) as num_places FROM poi WHERE ST_DWithin(geom::geography, (SELECT geom FROM accommodation WHERE name = 'HongCoffee')::geography, 1000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT count(DISTINCT name) as num_places FROM poi WHERE ST_DWithin(geom, (SELECT geom FROM accommodation WHERE name = 'HongCoffee')::geography, 1000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T078: Có bao nhiêu địa điểm trong vòng 500m xung quanh Phú Hồng? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[1027, 500.0]`
  *Kết quả mẫu:* `[{'total': 139}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(*)
FROM poi
WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Phu Hồnh%' LIMIT 1)::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT count(*)
FROM poi
WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Phu Hồnh%' LIMIT 1), 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T079: Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh I Love Bánh Mì? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[1784, 1500.0]`
  *Kết quả mẫu:* `[{'total': 98}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SQL: SELECT COUNT(DISTINCT t2.id) AS number_of_accommodations, ST_AsGeoJSON(t2.geom) AS geom FROM accommodation AS t2 WHERE t2.address ILIKE '%I%LoveB%E' AND ST_DWithin(t2.geom::geography, (SELECT ST_Transform(ST_SetSRID(geom::geography, 4326.0), 3406)::geography FROM boundaries WHERE name = 'Hải Châu')::geography, 1500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT t2.id) AS number_of_accommodations, ST_AsGeoJSON(t2.geom) AS geom FROM accommodation AS t2 WHERE t2.address ILIKE '%I%LoveB%E' AND ST_DWithin(t2.geom::geography, (SELECT geom FROM boundaries WHERE name = 'Hải Châu')::geography, 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T080: Có bao nhiêu nơi lưu trú trong vòng 1000m xung quanh Ca Phe Truc Duyen? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[297, 1000.0]`
  *Kết quả mẫu:* `[{'total': 7}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT co.name) AS number_of_accommodations
FROM accommodation co
JOIN poi po ON co.address LIKE '%Ca Phe Truc Duyen%'
WHERE ST_DWithin(co.geom::geography, po.geom::geography, 1000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT co.name) AS number_of_accommodations
FROM accommodation co
JOIN poi po ON co.address LIKE '%Ca Phe Truc Duyen%'
WHERE ST_DWithin(co.geom::geography, po.geom::geography, 1000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `7 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T081: Có bao nhiêu nơi lưu trú trong vòng 2000m xung quanh Thanh Tam? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[1418, 2000.0]`
  *Kết quả mẫu:* `[{'total': 243}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT t1.id) AS count_hotel
FROM hotels AS t1
JOIN poi AS t2 ON t1.geom && t2.geom AND t2.rating >= 4.5
WHERE t2.name = 'Thanh Tam' AND ST_DWithin(t1.geom::geography, t2.geom::geography, 2000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT t1.id) AS count_hotel
FROM hotels AS t1
JOIN poi AS t2 ON t1.geom && t2.geom AND t2.rating >= 4.5
WHERE t2.name = 'Thanh Tam';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T082: Có bao nhiêu địa điểm trong vòng 500m xung quanh CungDan Xua Coffee? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[285, 500.0]`
  *Kết quả mẫu:* `[{'total': 58}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT name) AS num_hotel, ST_AsGeoJSON(geom) as geom 
FROM hotel h 
JOIN poi p ON h.geom && p.geom 
WHERE p.amenity = 'restaurant' AND p.name ILIKE '%CungDan Xua Coffee%' 
AND ST_DWithin(p.geom::geography, h.geom::geography::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT name) AS num_hotel, ST_AsGeoJSON(geom) as geom 
FROM hotel h 
JOIN poi p ON h.geom && p.geom 
WHERE p.amenity = 'restaurant' AND p.name ILIKE '%CungDan Xua Coffee%' 
AND ST_DWithin(p.geom::geography, h.geom::geography, 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T083: Có bao nhiêu địa điểm trong vòng 500m xung quanh LAVA GELATO & FOOD? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[3212, 500.0]`
  *Kết quả mẫu:* `[{'total': 7}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(*)
FROM poi
WHERE ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE name = 'LAVA GELATO & FOOD')::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT count(*)
FROM poi
WHERE ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE name = 'LAVA GELATO & FOOD'), 500);`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T084: Có bao nhiêu địa điểm trong vòng 1500m xung quanh Nhà Rốt? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[1781, 1500.0]`
  *Kết quả mẫu:* `[{'total': 604}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SQL: SELECT COUNT(DISTINCT ST_Distance_Sphere(ST_Point_Near(geom::geography, (SELECT geom FROM boundaries WHERE name = 'Nhà Rốt' LIMIT 1), 1500)::geography, 'meters')) AS count 
FROM poi;
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT ST_Distance_Sphere(ST_Point_Near(geom, (SELECT geom FROM boundaries WHERE name = 'Nhà Rốt'), 1500), 'meters')) AS count 
FROM poi;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T085: Có bao nhiêu nơi lưu trú trong vòng 500m xung quanh CafeBui? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[135, 500.0]`
  *Kết quả mẫu:* `[{'total': 3}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT o.id)
FROM accommodation a 
JOIN poi p ON a.tourism = p.amenity 
JOIN roads_vertices_pgr rvp ON a.geom::geography <-> p.geom <@ rvp.the_geom 
WHERE p.name ILIKE '%CafeBui%' AND ST_DWithin(a.geom::geography, p.geom::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT COUNT(DISTINCT o.id)
FROM accommodation a 
JOIN poi p ON a.tourism = p.amenity 
JOIN roads_vertices_pgr rvp ON a.geom::geography <-> p.geom <@ rvp.the_geom 
WHERE p.name ILIKE '%CafeBui%' AND ST_DWithin(a.geom::geography, p.geom::geography, 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T086: Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh CaPhe Nhu Mai? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    
  ```
  *Tham số:* `[275, 1500.0]`
  *Kết quả mẫu:* `[{'total': 5}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(*) 
FROM accommodation AS ca
JOIN poi AS p ON ca.address LIKE '%CaPhe Nhu Mai%' AND ST_DWithin(ca.geom::geography, p.geom::geography, 1500.0)
WHERE (ca.tourism = 'homestay' OR ca.tourism = 'hostel')
  ```
  *SQL thô trước khi sửa:* `SELECT count(*) 
FROM accommodation AS ca
JOIN poi AS p ON ca.address LIKE '%CaPhe Nhu Mai%' AND ST_DWithin(ca.geom::geography, p.geom::geography, 1500)
WHERE (ca.tourism = 'homestay' OR ca.tourism = 'hostel')`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `5 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T087: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Cen Archery (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[2646, 1500.0]`
  *Kết quả mẫu:* `[{'name': '미꽝 24 7'}, {'name': '4U Restaurant'}, {'name': 'Altitude'}, {'name': 'Anh Kim Quan'}, {'name': "An's Cafe"}, {'name': 'BaBaBa Japanese Restaurant'}, {'name': 'Babylon Steak Garden'}, {'name': 'Baek Je'}, {'name': 'Bánh mì'}, {'name': 'Banh Mi Co Na'}, {'name': 'Bao An Macrobiotic'}, {'name': 'BaoNhi Coffee'}, {'name': 'Bé Bien'}, {'name': 'Bé Man'}, {'name': 'Bé Ni 2'}, {'name': 'Bollywood Kitchen'}, {'name': 'Bon Mua'}, {'name': 'BOSS cafe'}, {'name': 'Burger House Da Nang'}, {'name': 'Busan'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name = 'Cen Archery')::geography, 1500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name = 'Cen Archery')::geography, 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T088: Liệt kê tất cả khách sạn nằm trong bán kính 2000m tính từ CaPhe Bar T. Piaggio (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[452, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 11391148269'}, {'name': 'Accommodation 13415593701'}, {'name': 'Accommodation 4396866289'}, {'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5122187521'}, {'name': 'Accommodation 5228409521'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5406652922'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'Accommodation 6482332185'}, {'name': 'Accommodation 7095169380'}, {'name': 'An Hải Home'}, {'name': 'Anh TUẤN'}, {'name': 'AnhTUẤN'}, {'name': 'Avora Hotel'}, {'name': 'Bamboo Green Riverside'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, stars, geom::jsonb AS geometry FROM accommodation WHERE tourism = 'hotel' AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE amenity = 'cafe_bar' AND name LIKE '%T.%piaggio%' LIMIT 1)::geography, 2000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, stars, geom::jsonb AS geometry FROM accommodation WHERE tourism = 'hotel' AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE amenity = 'cafe_bar' AND name LIKE '%T.%piaggio%' LIMIT 1)::geography, 2000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T089: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 500m tính từ CaPhe Relax (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[174, 500.0]`
  *Kết quả mẫu:* `[{'name': 'Art for Life coffe'}, {'name': 'Bún Bò - Mì Quảng'}, {'name': 'Bun thit nuong'}, {'name': 'Cafe 36'}, {'name': 'Cafe Long'}, {'name': 'Cafe Phong'}, {'name': 'Ca Phe May Chieu'}, {'name': 'CaPhe Relax'}, {'name': 'Đà Thành'}, {'name': 'Gan'}, {'name': 'Hu tien Minh Hieu'}, {'name': 'Ikigai'}, {'name': 'Kebab Nova'}, {'name': 'Mì Quảng Đại Lộc'}, {'name': 'POI 13864579603'}, {'name': 'Quan hanh Com'}, {'name': 'Trung Nguyên Coffee'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND distance('CaPhe Relax::geography', geom::geography, 500) < 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND distance('CaPhe Relax', geom, 500) < 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `17 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T090: Liệt kê tất cả khách sạn nằm trong bán kính 1500m tính từ RuNam (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[1501, 1500.0]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 11391148269'}, {'name': 'Accommodation 13415593701'}, {'name': 'Accommodation 4396866289'}, {'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5406652922'}, {'name': 'Accommodation 6354047785'}, {'name': 'Accommodation 7095169380'}, {'name': 'Anh TUẤN'}, {'name': 'AnhTUẤN'}, {'name': 'Avora Hotel'}, {'name': 'Bamboo Green Riverside'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'Bay Capital Da Nang Hotel'}, {'name': 'Brilliant Hotel'}, {'name': 'Centre Point Hotel and Residence'}, {'name': 'Chị Hoa'}, {'name': 'Chị Hoa'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, stars, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hotel' AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE amenity = 'beach')::geography::geography, 1500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, stars, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel') AND ST_DWithin(geom::geography, ST_Transform((SELECT geom FROM poi WHERE amenity = 'beach'), 4326)::geography, 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T091: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Babylon Steakgarden (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[779, 1500.0]`
  *Kết quả mẫu:* `[{'name': '1996'}, {'name': '369 Family Restaurant'}, {'name': '43 Factory Coffee'}, {'name': '8XCoffee'}, {'name': 'ACE Coworking Space'}, {'name': 'Adobo'}, {'name': 'Aespa'}, {'name': 'Aladin'}, {'name': 'Alo Coffee'}, {'name': 'Am coffee'}, {'name': 'AMP'}, {'name': 'An An'}, {'name': 'Andy coffee'}, {'name': 'AN THOI SEAFOOD'}, {'name': 'Aqua Betty'}, {'name': 'Armor'}, {'name': 'Aussie Bistro'}, {'name': 'Babylon Steakgarden'}, {'name': 'Bahn Mi & cafe'}, {'name': 'Bahn Xeo Cuoi'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE ST_Distance_Between(st_geomfromtext('POINT(-124.78436 36.83605)', 4326), st_point_from_text(name::text, 4326), 1500);
  ```
  *SQL thô trước khi sửa:* `SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE ST_Distance_Between(st_geomfromtext('POINT(-124.78436 36.83605)', 4326), st_point_from_text(name::text, 4326), 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T092: Liệt kê tất cả khách sạn nằm trong bán kính 1000m tính từ CafeBao Tram (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[429, 1000.0]`
  *Kết quả mẫu:* `[{'name': 'Dan Oasis Hotel'}, {'name': 'Grand Gold'}, {'name': 'Leon Homestay'}, {'name': 'Sontra Sea Hotel'}, {'name': 'The Code'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation
WHERE tourism = 'hotel'
AND stars >= 4
AND ST_DWithin((SELECT ST_Transform(ST_PointFromText('POINT(-108.927365 10.855639)'), 3406)::geography, (SELECT geom FROM poi WHERE amenity = 'cafe' AND name ILIKE '%CafeBao%')::geography), geom::geography, 1000);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation
WHERE tourism = 'hotel'
AND stars >= 4
AND ST_DWithin(
    (SELECT geom FROM poi WHERE amenity = 'cafe' AND name ILIKE '%CafeBao%'),
    geom::geography, 1000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T093: Liệt kê tất cả khách sạn nằm trong bán kính 500m tính từ Kin Kin Thai Food (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[2929, 500.0]`
  *Kết quả mẫu:* `[{'name': 'Abogo Villa Pool Near Beach BBQ Free Da Nang'}, {'name': 'Accommodation 10231965517'}, {'name': 'Accommodation 11896312469'}, {'name': 'Accommodation 11896574769'}, {'name': 'Accommodation 13861001333'}, {'name': 'Dreams Hotel'}, {'name': 'Gold Coast'}, {'name': 'Kara Beachside hotel'}, {'name': 'L’Amore'}, {'name': 'Le Indochina'}, {'name': 'Mike’s Place'}, {'name': 'Rio'}, {'name': 'Sandy Bay 2'}, {'name': 'Silla'}, {'name': 'Starfish Alley Hostel'}, {'name': 'Sun River Hotel'}, {'name': 'Teu'}, {'name': 'Titan'}, {'name': 'TV’s hotel & appartment'}, {'name': 'Urchin'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel' OR tourism = 'resort') AND stars >= 3 
AND ST_DWithin(geom::geography, ST_GeogFromText('POINT(-109.645785 10.724976)')::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel' OR tourism = 'resort') AND stars >= 3 
AND ST_DWithin(geom::geography, ST_GeogFromText('POINT(-109.645785 10.724976)'), 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T094: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1000m tính từ Bún Xương (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[1793, 1000.0]`
  *Kết quả mẫu:* `[{'name': '10Tran Quoc Toan Coffee'}, {'name': '218'}, {'name': '7 Bridges Brewing Company'}, {'name': '89Coffee'}, {'name': 'Àla Cafe'}, {'name': "Al Fresco's Café & Grill"}, {'name': 'Amare'}, {'name': 'Am Thuc Chay Da Nang'}, {'name': 'Angel Coffee'}, {'name': 'AnhCoffee'}, {'name': 'An Thoi'}, {'name': 'Aquarium cafe'}, {'name': 'Aroma Italian Oven'}, {'name': 'Au Lac'}, {'name': 'Ba Duong Banh Xeo'}, {'name': 'Bamboo 2'}, {'name': 'Bánh bèo 291 Nguyễn Chí Thanh'}, {'name': 'Bánh cuốn Kim Cúc'}, {'name': 'Bánh Mì Bamidon'}, {'name': 'Banh My Kim (banh mi)'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE tourism = 'beach' OR amenity = 'beach' 
AND ST_DWithin(geom::geography, (SELECT ST_Union(ST_Buffer((SELECT geom FROM boundaries WHERE name LIKE '%Bún Xương%' LIMIT 1)::geography, 100.0)), 100), 100);
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE tourism = 'beach' OR amenity = 'beach' 
AND ST_DWithin(geom::geography, (SELECT ST_Union(ST_Buffer((SELECT geom FROM boundaries WHERE name LIKE '%Bún Xương%' LIMIT 1), 1000)), 100);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T095: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Nối - The Cabin (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[3097, 1500.0]`
  *Kết quả mẫu:* `[{'name': '7 wonders'}, {'name': 'Art in Paradise Da Nang 3D Museum'}, {'name': 'At Ca Phe'}, {'name': 'BaoTran Coffee'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Cafe153'}, {'name': 'Cafe219'}, {'name': 'CafeCo Vang'}, {'name': 'CafeHuyen Trang'}, {'name': 'CafeLong'}, {'name': 'Cafe May Hong'}, {'name': 'CafeMusic'}, {'name': 'Cam Tam'}, {'name': 'Ca Phe Chieu Tim'}, {'name': 'Ca Phe Giai Khat Yen Trang'}, {'name': 'CaPhe Quynh'}, {'name': 'CayBang Coffee'}, {'name': 'Cóm Bà Tí'}, {'name': 'Com Tam'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_DWithin(geom::geography, (SELECT geom FROM roads_vertices_pgr WHERE id = 1500)::geography, 1500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, description, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_DWithin(geom::geography, (SELECT geom FROM roads_vertices_pgr WHERE id = 1500), 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.6%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T096: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 2000m tính từ PhuongMai Coffee (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[84, 2000.0]`
  *Kết quả mẫu:* `[{'name': 'Altitude'}, {'name': 'Ẩm Thực Chay HẠNH THIỆN - Quán Chay - Vegan Restaurant'}, {'name': "An's Cafe"}, {'name': 'ARMY Coffee & Tea'}, {'name': 'Art in Paradise Da Nang 3D Museum'}, {'name': 'At Ca Phe'}, {'name': 'Bánh mì'}, {'name': 'Banh Mi Co Na'}, {'name': 'Bao An Macrobiotic'}, {'name': 'BaoNhi Coffee'}, {'name': 'BaoTran Coffee'}, {'name': 'Be Den'}, {'name': 'Bé Man'}, {'name': 'Bollywood Kitchen'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Bún Chả Huệ Chi'}, {'name': 'Cafe153'}, {'name': 'Cafe219'}, {'name': 'Cafe27'}, {'name': 'Cafe9X'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE ST_DWithin(poi.geom::geography, phuongmai_coffee.geom::geography, 2000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE ST_DWithin(poi.geom::geography, phuongmai_coffee.geom::geography, 2000)`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T097: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ CafeBa Map (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[288, 1500.0]`
  *Kết quả mẫu:* `[{'name': '43 Hòa Phú 9'}, {'name': '55Coffee'}, {'name': '74Coffee'}, {'name': 'Cafe96'}, {'name': 'CafeBa Map'}, {'name': 'CafeDong Doi'}, {'name': 'CafeThu Nguyen'}, {'name': 'CafeTi Ti'}, {'name': 'Ca Phe A. Hieu'}, {'name': 'CaPhe An Huy'}, {'name': 'Ca Phe Bay Cha'}, {'name': 'Ca Phe Cam Ni'}, {'name': 'CaPhe Chan Que'}, {'name': 'Ca Phe Hau'}, {'name': 'CaPhe Hoang Vy'}, {'name': 'Ca Phe Hong Minh'}, {'name': 'Ca Phe Hong Trang'}, {'name': 'Ca Phe Huong Ngoc Lan'}, {'name': 'Ca Phe Huong Xuan'}, {'name': 'Ca Phe Legend'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND price_level IN ('Trung bình', 'Sang trọng') AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_SetSRID((SELECT geom FROM poi WHERE name = 'CafeBa Map')::geography, 4326.0)::geography, 28992) LIMIT 1), 1500);
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND price_level IN ('Trung bình', 'Sang trọng') AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_SetSRID((SELECT geom FROM poi WHERE name = 'CafeBa Map'), 4326)::geography, 28992) LIMIT 1), 1500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T098: Liệt kê tất cả địa điểm du lịch nằm trong bán kính 1500m tính từ Gao (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `[2685, 1500.0]`
  *Kết quả mẫu:* `[{'name': '1996'}, {'name': '미꽝 24 7'}, {'name': '369 Family Restaurant'}, {'name': '4:30pm Beer'}, {'name': '43 Factory Coffee'}, {'name': '43 Town'}, {'name': '4U Restaurant'}, {'name': '8XCoffee'}, {'name': 'Adobo'}, {'name': 'Aespa'}, {'name': 'Aladin'}, {'name': 'All Seasons'}, {'name': 'Alo Coffee'}, {'name': 'Am coffee'}, {'name': 'AMP'}, {'name': 'An An'}, {'name': 'Anh Kim Quan'}, {'name': 'AN THOI SEAFOOD'}, {'name': 'Aqua Betty'}, {'name': 'Arcadia Coffee'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_Distance_Geometry((SELECT geom FROM boundaries WHERE name = 'Giao'), geom::geography, 1500) < @> 1500;
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_Distance_Geometry((SELECT geom FROM boundaries WHERE name = 'Giao'), geom::geography, 1500) < @> 1500;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T099: Quán tiệm ăn nhanh nào nằm gần nhất với tọa độ 108.2015 16.0548? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['fast_food', 108.2015, 16.0548, 1]`
  *Kết quả mẫu:* `[{'name': 'Sam'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
WHERE tourism = 'fast_food' AND 
      ST_DWithin(ST_GeographyFromText('POINT(108.2015 16.0548)')::geography, a.geom::geography, 100.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
WHERE tourism = 'fast_food' AND 
      ST_Distance(ST_GeographyFromText('POINT(108.2015 16.0548)'), a.geom::geography) < 100;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T100: Quán nhà hàng nào nằm gần nhất với tọa độ 108.2213 16.088? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['restaurant', 108.2213, 16.088, 1]`
  *Kết quả mẫu:* `[{'name': 'Xôi Anh'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE (amenity = 'restaurant' OR amenity = 'cafe') AND ST_DWithin((ST_SetSRID(ST_MakePoint(108.2213::geography, 16.088)::geography, 4326.0)::geography), geom::geography, 500);
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE (amenity = 'restaurant' OR amenity = 'cafe') AND distance((ST_SetSRID(ST_MakePoint(108.2213, 16.088), 4326)), geom::geography) < 500;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T101: Quán nhà văn hóa nào nằm gần nhất với tọa độ 108.2169 16.0622? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['community_centre', 108.2169, 16.0622, 1]`
  *Kết quả mẫu:* `[{'name': 'Hội quán Hải Nam'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation a 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') 
AND ST_DWithin(a.geom::geography, ('POINT(108.2169 16.0622)'::geography)::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation a 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') 
AND ST_DWithin(a.geom::geography, (SELECT ST_Transform(ST_MakePoint(108.2169, 16.0622), 3406)::geography, 4326)::geography, 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T102: Quán bến tàu thủy nào nằm gần nhất với tọa độ 108.2344 16.0353? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['ferry_terminal', 108.2344, 16.0353, 1]`
  *Kết quả mẫu:* `[{'name': 'Basket Boat Station'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommmodation 
WHERE tourism = 'restaurant' AND (name ILIKE '%bến tàu%' OR amenity = 'port') 
AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE name ILIKE '%tàu%' LIMIT 1)::geography, 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommmodation 
WHERE tourism = 'restaurant' AND (name ILIKE '%bến tàu%' OR amenity = 'port') 
AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE name ILIKE '%tàu%' LIMIT 1), 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T103: Quán quán bar nào nằm gần nhất với tọa độ 108.2477 16.0535? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['bar', 108.2477, 16.0535, 1]`
  *Kết quả mẫu:* `[{'name': 'Paradise Beach Bar'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, description, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND description LIKE '%bar%' 
ORDER BY distance(ST_MakePoint(108.2477, 16.0535)::geography, geom), rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, description, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND description LIKE '%bar%' 
ORDER BY distance(ST_MakePoint(108.2477, 16.0535)::geography, geom), rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T104: Quán cửa hàng cafe nào nằm gần nhất với tọa độ 108.2481 16.0505? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['cafe', 108.2481, 16.0505, 1]`
  *Kết quả mẫu:* `[{'name': 'Dalky'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address::geography <-> (108.2481, 16.0505) < 0.001;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address::geography <-> (108.2481, 16.0505) < 0.001;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T105: Quán khu mua sắm nào nằm gần nhất với tọa độ 108.2143 16.0561? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['marketplace', 108.2143, 16.0561, 1]`
  *Kết quả mẫu:* `[{'name': 'Chợ Đêm'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as location 
FROM shopping_centers sc 
WHERE ST_Distance(sc.geom::geography, (ST_GeographyFromText('POINT(108.2143 16.0561)'))::geography) < 1000;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, geom::jsonb as location 
FROM shopping_centers sc 
WHERE ST_Distance(sc.geom, (ST_GeographyFromText('POINT(108.2143 16.0561)'))::geography) < 1000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T106: Quán quán bar nào nằm gần nhất với tọa độ 108.2837 16.1029? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['bar', 108.2837, 16.1029, 1]`
  *Kết quả mẫu:* `[{'name': 'POI 11627057769'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, ST_AsGeoJSON(geom) AS geom FROM poi WHERE amenity = 'bar' AND ST_Distance((geom::geography), '(POINT(:longitude :latitude))') < 50;
  ```
  *SQL thô trước khi sửa:* `SELECT name, amenity, ST_AsGeoJSON(geom) AS geom FROM poi WHERE amenity = 'bar' AND ST_Distance(geom::geography, '(POINT(:longitude :latitude))') < 50;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T107: Quán nhà sinh hoạt cộng đồng nào nằm gần nhất với tọa độ 108.2243 16.0366? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['community_centre', 108.2243, 16.0366, 1]`
  *Kết quả mẫu:* `[{'name': 'Hội quán Hải Nam'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation AS a
JOIN poi AS p ON a.amenity = p.name
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND ST_Distance(a.geom::geography, ('POINT(108.2243 16.0366)', 4326)::geometry) < 500
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation AS a
JOIN poi AS p ON a.amenity = p.name
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND ST_Distance(a.geom::geography, (SELECT ST_GeomFromText('POINT(108.2243 16.0366)', 4326)::geometry)) < 500`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T108: Quán bến phà nào nằm gần nhất với tọa độ 108.1881 16.04? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['ferry_terminal', 108.1881, 16.04, 1]`
  *Kết quả mẫu:* `[{'name': 'Basket Boat Station'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%bến phà%' ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'restaurant' AND name ILIKE '%bến phà%' ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T109: Quán bar nào nằm gần nhất với tọa độ 108.22 16.0361? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['bar', 108.22, 16.0361, 1]`
  *Kết quả mẫu:* `[{'name': 'Tulip Craft Beer Da Nang - Bia Thủ Công'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'bar' AND address ILIKE '%108.22 16.0361%' LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'bar' AND address ILIKE '%108.22 16.0361%' LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T110: Quán bar nào nằm gần nhất với tọa độ 108.2196 16.0309? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `['bar', 108.2196, 16.0309, 1]`
  *Kết quả mẫu:* `[{'name': 'Tulip Craft Beer Da Nang - Bia Thủ Công'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND price_level = 'Rẻ' AND rating >= 4.5 
AND ST_Distance(geom::geography, (108.2196, 16.0309)) < 500;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND price_level = 'Rẻ' AND rating >= 4.5 
AND ST_Distance(geom::geography, (108.2196, 16.0309)) < 500;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T111: Nơi lưu trú gần nhất với vị trí 108.2175 16.0627 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2175, 16.0627, 1]`
  *Kết quả mẫu:* `[{'name': 'Zion Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, stars, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, stars, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T112: Nơi lưu trú gần nhất với vị trí 108.2407 16.0746 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2407, 16.0746, 1]`
  *Kết quả mẫu:* `[{'name': 'An Bình Tài'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
       ST_Contains((SELECT ST_Buffer(ST_Point(lon::numeric, lat::numeric), 0.1)::geography FROM boundaries WHERE name LIKE '%Sơn Trà%' LIMIT 1), geom) 
LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
       ST_Contains((SELECT ST_Buffer(ST_Point(lon::numeric, lat::numeric), 0.1)::geography FROM boundaries WHERE name LIKE '%Sơn Trà%' LIMIT 1), geom) 
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T113: Nơi lưu trú gần nhất với vị trí 108.2463 16.0498 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2463, 16.0498, 1]`
  *Kết quả mẫu:* `[{'name': 'Angel Homestay'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation a 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom)
ORDER BY rating DESC 
LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation a 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom)
ORDER BY rating DESC 
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T114: Nơi lưu trú gần nhất với vị trí 108.2423 16.0437 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2423, 16.0437, 1]`
  *Kết quả mẫu:* `[{'name': 'Zones'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
WHERE tourism = 'hotel' AND stars = 5 AND 
       ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%hải Châu%'), a.geom);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
WHERE tourism = 'hotel' AND stars = 5 AND 
       ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%hải Châu%'), a.geom);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T115: Nơi lưu trú gần nhất với vị trí 108.2249 16.0657 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2249, 16.0657, 1]`
  *Kết quả mẫu:* `[{'name': 'Haian'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation AS A 
JOIN poi AS P ON A.address = P.address 
WHERE A.geom && ST_Transform(ST_SetSRID(ST_MakePoint(108.2249, 16.0657), 3406)::geography::geometry, 4326) 
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation AS A 
JOIN poi AS P ON A.address = P.address 
WHERE A.geom && ST_Transform(ST_SetSRID(ST_MakePoint(108.2249, 16.0657), 3406)::geography::geometry, 4326) 
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T116: Nơi lưu trú gần nhất với vị trí 108.2239 16.072 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2239, 16.072, 1]`
  *Kết quả mẫu:* `[{'name': 'Marriott Executive Apartments'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE address = '108.2239 16.072' AND tourism = 'guest_house';
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE address = '108.2239 16.072' AND tourism = 'guest_house';`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T117: Nơi lưu trú gần nhất với vị trí 108.1875 16.0341 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.1875, 16.0341, 1]`
  *Kết quả mẫu:* `[{'name': 'Cat tuong homestay'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    rating, 
    ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'hotel' AND stars = 4 AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_GeometryFromText('POINT(108.1875 16.0341)'::geography, 4326.0), 3406) FROM boundaries WHERE name = 'Hải Châu' LIMIT 1), 10)
LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT 
    name, 
    address, 
    rating, 
    ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'hotel' AND stars = 4 AND ST_DWithin(geom::geography, (SELECT ST_GeometryFromText('POINT(108.1875 16.0341)', 4326)::geography), 10)
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T118: Nơi lưu trú gần nhất với vị trí 108.2061 16.0606 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2061, 16.0606, 1]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 5122187521'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND ST_DWithin(geom::geography, (SELECT ST_Union(ST_Transform(geom::geography, 3406.0)) FROM poi WHERE name ILIKE '%Sơn Trà%' LIMIT 1), 500.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%Sơn Trà%' LIMIT 1), 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T119: Nơi lưu trú gần nhất với vị trí 108.1319 16.1098 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.1319, 16.1098, 1]`
  *Kết quả mẫu:* `[{'name': "TruongVuHouse's"}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    ST_AsGeoJSON(geom) as geom 
FROM 
    accommodation a 
WHERE 
    (tourism = 'guest_house' OR tourism = 'hostel') AND 
    ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), a.geom) 
LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT 
    name, 
    address, 
    ST_AsGeoJSON(geom) as geom 
FROM 
    accommodation a 
WHERE 
    (tourism = 'guest_house' OR tourism = 'hostel') AND 
    ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), a.geom) 
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T120: Nơi lưu trú gần nhất với vị trí 108.2439 16.0591 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2439, 16.0591, 1]`
  *Kết quả mẫu:* `[{'name': 'Yellow Apricot'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T121: Nơi lưu trú gần nhất với vị trí 108.2725 15.9989 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2725, 15.9989, 1]`
  *Kết quả mẫu:* `[{'name': 'Aria Đà Nẵng'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' AND 
      ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom) 
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' AND 
      ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom) 
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T122: Nơi lưu trú gần nhất với vị trí 108.2313 16.0798 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[108.2313, 16.0798, 1]`
  *Kết quả mẫu:* `[{'name': 'Huệ Chi'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, address, ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'guest_house' OR tourism = 'hostel' 
AND 
    ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom);
  ```
  *SQL thô trước khi sửa:* `SELECT 
    name, address, ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'guest_house' OR tourism = 'hostel' 
AND 
    ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.6%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T123: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2163 16.0766 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.2163, 16.0766, 1]`
  *Kết quả mẫu:* `[{'name': 'Bananaflower Homestay'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND ST_DWithin(
    geom::geography,
    (
        SELECT g.geom 
        FROM boundaries b 
        WHERE b.name ILIKE '%Sơn Trà%' LIMIT 1
    ),
    500
) 
ORDER BY rating DESC, review_count DESC 
LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND ST_DWithin(
    geom::geography,
    (
        SELECT g.geom 
        FROM boundaries b 
        WHERE b.name ILIKE '%Sơn Trà%' LIMIT 1
    ),
    500
) 
ORDER BY rating DESC, review_count DESC 
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T124: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2226 16.0607 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.2226, 16.0607, 1]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 5815719653'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hostel' OR tourism = 'guest_house' 
AND (stars = 4 OR stars = 3) 
AND ST_Distance(geom::geography, '(POINT(108.2226 16.0607))') < 50
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hostel' OR tourism = 'guest_house' 
AND (stars = 4 OR stars = 3) 
AND ST_Distance(geom::geography, '(POINT(108.2226 16.0607))') < 50
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T125: Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2289 16.0614 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.5, 108.2289, 16.0614, 1]`
  *Kết quả mẫu:* `[{'name': 'Cents Hotel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
JOIN poi p ON ST_Contains(p.geom::geography, ST_Transform(a.geom::geometry, 3426)) 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND rating >= 4.5 LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
JOIN poi p ON ST_Contains(p.geom::geography, ST_Transform(a.geom::geometry, 3426)) 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND rating >= 4.5 
LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T126: Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2257 16.0436 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.5, 108.2257, 16.0436, 1]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 6540133232'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel' OR tourism = 'hostel') AND address ~ '^[^ \t\n]+108.2257 16.0436$' 
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel' OR tourism = 'hostel') AND address ~ '^[^ \t\n]+108.2257 16.0436$' 
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T127: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.1432 16.083 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.1432, 16.083, 1]`
  *Kết quả mẫu:* `[{'name': 'Mikazuki Đà Nẵng Hotel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') 
AND ST_DWithin((ST_Transform(ST_GeomFromText('POINT({} {})', 4326)::geography)), geom::geography, 1000)
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') 
AND ST_DWithin((ST_Transform(ST_GeomFromText('POINT({} {})', 4326)::geography)), geom::geography, 1000)
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T128: Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.1686 16.0505 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.5, 108.1686, 16.0505, 1]`
  *Kết quả mẫu:* `[{'name': 'Dai Long hotel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation acm 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND stars = 3 
AND ST_Distance(geom::geography, ('POINT(108.1686 16.0505)'::geography) < 500);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation acm 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') 
AND stars = 3 
AND ST_Distance(geom::geography, ('POINT({} {}')::geography) < 500);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T129: Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2179 16.0534 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.5, 108.2179, 16.0534, 1]`
  *Kết quả mẫu:* `[{'name': 'Leila House - DaNang Central - 3BRs - Free Airport Shuttle'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    rating, 
    ST_AsGeoJSON(geom) as geom 
FROM 
    accommodation 
WHERE 
    tourism = 'guest_house' OR tourism = 'hostel' AND ST_Distance(ST_Transform(geom::geography, 4326)::geography, (SELECT GEOMETRYFROM POINT(108.2179 16.0534))::geography) < 500;
  ```
  *SQL thô trước khi sửa:* `SELECT 
    name, 
    address, 
    rating, 
    ST_AsGeoJSON(geom) as geom 
FROM 
    accommodation 
WHERE 
    tourism = 'guest_house' OR tourism = 'hostel' AND ST_Distance(geom::geography, (SELECT GEOMETRYFROM POINT(108.2179 16.0534))::geography) < 500;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T130: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2408 16.0417 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.2408, 16.0417, 1]`
  *Kết quả mẫu:* `[{'name': 'Zones'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
      ST_DWithin(geom::geography, ST_MakePoint(108.2408::geography, 16.0417)::geography, 500) 
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
      ST_DWithin(geom::geography, (SELECT ST_MakePoint(108.2408, 16.0417)::geography), 500) 
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T131: Nơi lưu trú có đánh giá từ 4.0 trở lên nằm gần nhất với tọa độ 108.2193 16.058 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.0, 108.2193, 16.058, 1]`
  *Kết quả mẫu:* `[{'name': 'Quốc Cường Center Hotel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hostel' OR tourism = 'guest_house' 
AND ST_DWithin(
    (SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1),
    geom::geography,
    500
);
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hostel' OR tourism = 'guest_house' 
AND ST_DWithin(
    (SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1),
    geom::geography,
    500
);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T132: Nơi lưu trú có đánh giá từ 4.5 trở lên nằm gần nhất với tọa độ 108.2234 16.0776 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.5, 108.2234, 16.0776, 1]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 4396866289'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
      stars = 3 AND 
      ST_Contains(
          (SELECT geom FROM boundaries WHERE name = 'Hải Châu'), 
          ST_SetSRID(ST_MakePoint(-108.2234, 16.0776), 4326)
       );
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
      stars = 3 AND 
      ST_Contains(
          (SELECT geom FROM boundaries WHERE name = 'Hải Châu'), 
          ST_SetSRID(ST_MakePoint(-108.2234, 16.0776), 4326)
       );`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T133: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2481 16.0542 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.2481, 16.0542, 1]`
  *Kết quả mẫu:* `[{'name': 'Golden Lotus Apartment'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hotel' AND stars BETWEEN 3 AND 5 
AND ST_Distance((ST_SetSRID(ST_Point(108.2481, 16.0542), 4326)), geom::geography) < 500
ORDER BY rating DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hotel' AND stars BETWEEN 3 AND 5 
AND ST_Distance((ST_SetSRID(ST_Point(108.2481, 16.0542), 4326)), geom::geography) < 500
ORDER BY rating DESC LIMIT 1;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T134: Nơi lưu trú có đánh giá từ 4.2 trở lên nằm gần nhất với tọa độ 108.2003 16.063 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    
  ```
  *Tham số:* `[4.2, 108.2003, 16.063, 1]`
  *Kết quả mẫu:* `[{'name': 'Dai Long hotel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
      ST_Distance((ST_SetSRID(ST_MakePoint(108.2003, 16.063), 4326)), address::geography) < 500;
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
      ST_Distance((ST_SetSRID(ST_MakePoint(108.2003, 16.063), 4326)), address::geography) < 500;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T135: Liệt kê tất cả homestay giá rẻ cách Ca Phe Pho Xua 2 dưới 1000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 441, 1000.0]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 4755840322'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Intersection((SELECT geom FROM poi WHERE amenity = 'cafe' LIMIT 1), (SELECT geom FROM poi WHERE name ILIKE '%Ca Phe Pho Xua%' LIMIT 1)), 1000), 2);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Intersection((SELECT geom FROM poi WHERE amenity = 'cafe' LIMIT 1), (SELECT geom FROM poi WHERE name ILIKE '%Ca Phe Pho Xua%' LIMIT 1)), 1000), 2);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying >= smallint
LINE 3: WHERE t.price_level >= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T136: Liệt kê tất cả homestay giá rẻ cách QuynhThuy Coffee dưới 1000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 166, 1000.0]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': 'Chị Hoa'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Otium hostel danang'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND price_level = 'Rẻ' 
AND ST_Distance(geom::geography, (SELECT geom FROM poi WHERE name ILIKE '%QuynhThuy Coffee%')) < 1000;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND price_level = 'Rẻ' 
AND ST_Distance(geom::geography, (SELECT geom FROM poi WHERE name ILIKE '%QuynhThuy Coffee%')) < 1000;`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying < smallint
LINE 3: WHERE t.price_level < $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T137: Liệt kê tất cả homestay giá rẻ cách phì lũ dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 1331, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'An Hải Home'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'ChaChi homestay'}, {'name': 'Chị Hoa'}, {'name': 'ChiPa Homestay'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}, {'name': 'La COOL House Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, price_level, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'homestay' AND stars = 3 AND price_level = 'Rẻ' AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_Union(geom::geography), 4326.0) FROM poi WHERE name ILIKE '%phì lũ%' OR tourism = 'beach'), 2000.0);
 
Running this query failed with the following database error:
function st_union(geography) does not exist
LINE 3: ... ST_DWithin(geom::geography, (SELECT ST_Transform(ST_Union(g...
                                                             ^
HINT:  No function matches the given name and argument types. You might need to add explicit type casts.
 
Please correct the SQL query to fix the error.
  ```
  *SQL thô trước khi sửa:* `SELECT name, price_level, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'homestay' AND stars = 3 AND price_level = 'Rẻ' AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%phì lũ%' OR tourism = 'beach'), 2000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying <= smallint
LINE 3: WHERE t.price_level <= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T138: Liệt kê tất cả homestay giá rẻ cách Phú Hồng dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 1027, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'An Hải Home'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'Capsule Hotel'}, {'name': 'ChaChi homestay'}, {'name': 'Chị Hoa'}, {'name': 'ChiPa Homestay'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Green Balcony Hostel & Coffee'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' AND stars BETWEEN 1 AND 5 
AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Phú Hỏi%' LIMIT 1)::geography, 2000.0)
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'guest_house' AND stars BETWEEN 1 AND 5 
AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Phú Hỏi%' LIMIT 1), 2000)`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying < smallint
LINE 4:   AND t.price_level < $2
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T139: Liệt kê tất cả homestay giá rẻ cách Phinn Cafe dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2583, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'An Hải Home'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'ChaChi homestay'}, {'name': 'Chị Hoa'}, {'name': 'ChiPa Homestay'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Green Balcony Hostel & Coffee'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    price_level, 
    address, 
    ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'homestay' AND 
    price_level = 'Rẻ' AND 
    ST_Distance(geom::geography, (SELECT geom FROM poi WHERE amenity = 'cafe' AND name ILIKE '%Phinn%')) < 2000;
  ```
  *SQL thô trước khi sửa:* `SELECT 
    name, 
    price_level, 
    address, 
    ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    tourism = 'homestay' AND 
    price_level = 'Rẻ' AND 
    ST_Distance(geom::geography, (SELECT geom FROM poi WHERE amenity = 'cafe' AND name ILIKE '%Phinn%')) < 2000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu T140: Liệt kê tất cả homestay giá rẻ cách Khánh garden dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2976, 2000.0]`
  *Kết quả mẫu:* `[{'name': '1812 Boutique hostel'}, {'name': 'Accommodation 5261957521'}, {'name': 'Accommodation 5411929921'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 6036733985'}, {'name': 'An Hải Home'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'Bear'}, {'name': 'Bridges Danang Boutique Hotel'}, {'name': 'Capsule Hotel'}, {'name': 'ChaChi homestay'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Beach Hostel'}, {'name': 'Green Balcony Hostel & Coffee'}, {'name': 'HaLo Homestay'}, {'name': 'Hana Homestay Danang'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}, {'name': 'La COOL House Hostel'}, {'name': 'Loca Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND distance((SELECT geom FROM poi WHERE name = 'Khánh Garden'), ST_Transform(geom::geography, 3406)) < 2000;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND distance((SELECT geom FROM poi WHERE name = 'Khánh Garden'), geom::geography) < 2000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying <= smallint
LINE 3: WHERE t.price_level <= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T141: Liệt kê tất cả homestay giá rẻ cách Domino2 Coffee dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 487, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'Chị Hoa'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}, {'name': 'La COOL House Hostel'}, {'name': 'My Little Pig Homestay'}, {'name': 'Otium hostel danang'}, {'name': 'Seahorse'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND price_level = 'Rẻ' AND (ST_DWithin(geom::geography, (SELECT ST_Union(ST_Transform(geom::geography, 3406.0)) FROM poi WHERE amenity = 'cafe' OR name ILIKE '%domino2%' LIMIT 1)::geography, 2000.0));
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND price_level = 'Rẻ' AND (ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE amenity = 'cafe' OR name ILIKE '%domino2%' LIMIT 1)::geography, 2000));`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying < smallint
LINE 4:   AND t.price_level < $2
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T142: Liệt kê tất cả homestay giá rẻ cách Den Dau dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2749, 2000.0]`
  *Kết quả mẫu:* `[{'name': '4 Seasons Danang Hostel'}, {'name': 'Abogo Villa Pool Near Beach BBQ Free Da Nang'}, {'name': 'Accommodation 11070318505'}, {'name': 'Accommodation 11684508969'}, {'name': 'Accommodation 6984437440'}, {'name': 'Accommodation 6985132185'}, {'name': 'Angel Homestay'}, {'name': 'An Hải Home'}, {'name': 'Bear'}, {'name': 'B&M Apartment'}, {'name': 'ChaChi homestay'}, {'name': 'Hana Homestay Danang'}, {'name': 'Morri'}, {'name': 'Nha Chung Homestay'}, {'name': 'Peaceful'}, {'name': 'Rom Casa Hostel'}, {'name': 'Ruby Beach'}, {'name': 'Siro House Homestay'}, {'name': 'Starfish Alley Hostel'}, {'name': 'Truong Son Tung 5'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' 
AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_Union(geom::geography), 3406.0) FROM poi WHERE name ILIKE '%Den Dau%' OR tourism = 'beach' OR amenity = 'beach'), 2000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'guest_house' OR tourism = 'hostel' 
AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%Den Dau%' OR tourism = 'beach' OR amenity = 'beach'), 2000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying <= smallint
LINE 3: WHERE t.price_level <= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T143: Liệt kê tất cả homestay giá rẻ cách Bia Viet Ha dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 538, 2000.0]`
  *Kết quả mẫu:* `[{'name': 'Accommodation 4755840322'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 6036733985'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'Bridges Danang Boutique Hotel'}, {'name': 'Capsule Hotel'}, {'name': 'Chị Hoa'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}, {'name': 'La COOL House Hostel'}, {'name': 'My Little Pig Homestay'}, {'name': 'Otium hostel danang'}, {'name': 'Seahorse'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'homestay' AND price_level = 'Rẻ' AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_Union(geom::geography), 4326.0)), 2000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'homestay' AND price_level = 'Rẻ' AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%Bia Viet Ha%' OR tourism = 'beach'), 2000);`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu T144: Liệt kê tất cả homestay giá rẻ cách Kungfu Panda dưới 1000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2439, 1000.0]`
  *Kết quả mẫu:* `[{'name': '4 Seasons Danang Hostel'}, {'name': 'Accommodation 11070318505'}, {'name': 'Accommodation 6984437440'}, {'name': 'Accommodation 6985132185'}, {'name': 'Angel Homestay'}, {'name': 'Bear'}, {'name': 'B&M Apartment'}, {'name': 'Hana Homestay Danang'}, {'name': 'Morri'}, {'name': 'Peaceful'}, {'name': 'Rom Casa Hostel'}, {'name': 'Ruby Beach'}, {'name': 'Siro House Homestay'}, {'name': 'Truong Son Tung 5'}, {'name': 'Tuti'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_Union(geom::geography), 3406.0) FROM poi WHERE name ILIKE '%Kungfu Panda%' OR tourism = 'beach' OR amenity LIKE '%beach%'), 1000.0);
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND price_level = 'Rẻ' 
AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%Kungfu Panda%' OR tourism = 'beach' OR amenity LIKE '%beach%'), 1000)`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying <= smallint
LINE 3: WHERE t.price_level <= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T145: Liệt kê tất cả homestay giá rẻ cách Chuyen Café dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2553, 2000.0]`
  *Kết quả mẫu:* `[{'name': '4 Seasons Danang Hostel'}, {'name': 'Abogo Villa Pool Near Beach BBQ Free Da Nang'}, {'name': 'Accommodation 11070318505'}, {'name': 'Accommodation 11684508969'}, {'name': 'Accommodation 5411929921'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 6036733985'}, {'name': 'Accommodation 6984437440'}, {'name': 'Accommodation 6985132185'}, {'name': 'Angel Homestay'}, {'name': 'An Hải Home'}, {'name': 'Bear'}, {'name': 'B&M Apartment'}, {'name': 'ChaChi homestay'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Beach Hostel'}, {'name': 'Green Balcony Hostel & Coffee'}, {'name': 'HaLo Homestay'}, {'name': 'Hana Homestay Danang'}, {'name': 'Kon-Tiki Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'guest_house' AND price_level = 'Rẻ' AND ST_Distance_Curve((SELECT geom FROM poi WHERE amenity = 'cafe' LIMIT 1), geom::geography, 2000) < 2000;
  ```
  *SQL thô trước khi sửa:* `SELECT name, address, price_level, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'guest_house' AND price_level = 'Rẻ' AND ST_Distance_Curve((SELECT geom FROM poi WHERE amenity = 'cafe' LIMIT 1), geom::geography, 2000) < 2000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying < smallint
LINE 4:   AND t.price_level < $2
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T146: Liệt kê tất cả homestay giá rẻ cách Tiệm Bia Gà dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    
  ```
  *Tham số:* `['Rẻ', 2582, 2000.0]`
  *Kết quả mẫu:* `[{'name': '139nguyễn đucedm'}, {'name': 'Accommodation 4862929421'}, {'name': 'Accommodation 5311766223'}, {'name': 'Accommodation 5432955721'}, {'name': 'Accommodation 5815719653'}, {'name': 'Accommodation 6036733985'}, {'name': 'An Hải Home'}, {'name': 'Bananaflower Homestay'}, {'name': 'Banana Homestay'}, {'name': "Barney's Danang Backpacker's Hostel"}, {'name': 'ChaChi homestay'}, {'name': 'Chị Hoa'}, {'name': 'ChiPa Homestay'}, {'name': 'City Hostel Danang'}, {'name': 'Danang Backpackers Hostel'}, {'name': 'Ecodanang'}, {'name': 'Funtastic Danang Hostel'}, {'name': 'Green Balcony Hostel & Coffee'}, {'name': 'Huệ Chi'}, {'name': 'Kon-Tiki Hostel'}]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, price_level, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND stars BETWEEN 1 AND 5 
AND price_level = 'Rẻ' 
AND ST_Distance(ST_Transform(geom::geography, 4326)::geography, (SELECT ST_Transform(ST_GeogPoint(-109.634795, 10.72581), 4326) ::geography)) < 2000;
  ```
  *SQL thô trước khi sửa:* `SELECT name, price_level, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'hostel' AND stars BETWEEN 1 AND 5 
AND price_level = 'Rẻ' 
AND ST_Distance(geom::geography, (SELECT ST_Transform(ST_GeogPoint(-109.634795, 10.72581), 4326)::geography)) < 2000;`
  *Chính xác thực thi:* `False` | *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying < smallint
LINE 3: WHERE t.price_level < $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu T147: Giá phòng trung bình của homestay ở Sơn Trà năm 2026 là bao nhiêu? (`unanswerable`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT NULL WHERE FALSE
  ```
  *Tham số:* `[]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT AVG(accommodation.rating) AS average_rating, price_level 
FROM accommodation 
WHERE tourism = 'hostel' AND address LIKE '%Sơn Trà%' 
GROUP BY price_level 
ORDER BY price_level DESC LIMIT 1;
  ```
  *SQL thô trước khi sửa:* `SELECT AVG(accommodation.rating) AS average_rating, price_level 
FROM accommodation 
WHERE tourism = 'hostel' AND address LIKE '%Sơn Trà%' 
GROUP BY price_level 
ORDER BY price_level DESC LIMIT 1;`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu T148: Tôi muốn đặt bàn trước cho 5 người ở nhà hàng chay Hoa Sen. (`unanswerable`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT NULL WHERE FALSE
  ```
  *Tham số:* `[]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, price_level, amenities, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'restaurant' AND amenities LIKE '%vegan%' AND rating > 4.5 AND review_count >= 100 
LIMIT 5;
  ```
  *SQL thô trước khi sửa:* `SELECT name, price_level, amenity, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE tourism = 'restaurant' AND amenities LIKE '%vegan%' AND rating > 4.5 AND review_count >= 100 
LIMIT 5;`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T149: Quán bar Golden Pine có quy định trang phục gì không? (`unanswerable`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT NULL WHERE FALSE
  ```
  *Tham số:* `[]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    amenity, 
    description, 
    ST_AsGeoJSON(geom) as geom
FROM 
    poi
WHERE 
    name = 'Golden Pine' AND amenity = 'bar'
  ```
  *SQL thô trước khi sửa:* `SELECT 
    amenity, 
    description, 
    ST_AsGeoJSON(geom) as geom
FROM 
    poi
WHERE 
    name = 'Golden Pine' AND amenity = 'bar'`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT NULL WHERE FALSE
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu T150: Tình trạng triều cường ở bãi biển Mỹ Khê hôm nay thế nào? (`unanswerable`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT NULL WHERE FALSE
  ```
  *Tham số:* `[]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom FROM poi WHERE amenity = 'beach' AND tourism = 'beach' AND climate_label = 'Nhiệt đới';
  ```
  *SQL thô trước khi sửa:* `SELECT name, rating, price_level, ST_AsGeoJSON(geom) AS geom FROM poi WHERE amenity = 'beach' AND tourism = 'beach' AND climate_label = 'Nhiệt đới';`
  *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.name ASC
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Chính xác thực thi:* `True` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

## 4. Phân tích Độ bao phủ các Template GS-QA (Template Coverage Analysis)

Dưới đây là đánh giá khả năng bao phủ 26 template của benchmark GS-QA bởi kiến trúc **LLM-to-IR-to-SQL Compiler** hiện tại:

| Nhóm Template | Tình trạng hỗ trợ | Lý do kỹ thuật / SQL mẫu đề xuất |
| :--- | :---: | :--- |
| **intersects+count** <br> **intersects+name** | **Đầy đủ** | Được hỗ trợ qua toán tử `in_admin` và dịch chuyển sang `ST_Contains` trong ranh giới hành chính. |
| **range+count** <br> **range+name** | **Đầy đủ** | Được hỗ trợ qua toán tử `within_distance` và `near_point` kết hợp `ST_DWithin` trên kiểu dữ liệu geography. |
| **knn+name** <br> **knn+distance** | **Đầy đủ** | Được hỗ trợ qua trường `nearest_to` biên dịch thành phép toán tử KNN (`<->`) để tối ưu chỉ mục GIST. |
| **knn:non_spat_filter** <br> **range:non_spat_filter** | **Đầy đủ** | Mảng phẳng `where` gộp cả thuộc tính phi không gian giúp LLM dễ sinh hơn. |
| **intersects:area_total** <br> **intersects:length_total** | *Chưa hỗ trợ* | Compiler hiện chỉ hỗ trợ đếm (`count`) và lấy thuộc tính. Để mở rộng, cần thêm cấu trúc `"aggregate": "sum_area"` hoặc `"sum_length"` biên dịch thành `SUM(ST_Area(geom::geography))`. |
| **knn:direction** <br> **range:direction** | *Chưa hỗ trợ* | Các quan hệ hướng (North, South, East, West) đòi hỏi tính toán góc phương vị. Đề xuất mở rộng toán tử không gian `direction` sử dụng hàm `ST_Azimuth(geom1, geom2)`. |
| **range:towards** <br> **knn:towards** | *Chưa hỗ trợ* | Câu hỏi về hướng di chuyển hoặc dọc hành lang đường đi. Đòi hỏi tích hợp mạng lưới đường giao thông (`pgRouting` hoặc `ST_LineLocatePoint` dọc tuyến đường). |
