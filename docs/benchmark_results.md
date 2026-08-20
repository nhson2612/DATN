# Báo cáo Thử nghiệm Đánh giá trên Benchmark GS-QA

> **Ngày đánh giá:** 2026-08-20  
> **Bộ dữ liệu thử nghiệm:** `benchmark_gsqa_auto.json`  
> **Mô hình LLM sử dụng:** `qwen2.5:1.5b` (Ollama)  
> **Cơ sở dữ liệu:** PostgreSQL + PostGIS (Đà Nẵng tourism dataset)  

## 1. Kết quả Tổng quan

| Chỉ số đánh giá | Kiến trúc Cũ (Direct SQL) | Kiến trúc Mới (LLM-to-IR-to-SQL) | Nhận xét |
| :--- | :---: | :---: | :--- |
| **Tỉ lệ sinh SQL thành công (Execution SR)** | 40.0% | 94.0% | Kiến trúc mới loại bỏ lỗi cú pháp SQL và ép kiểu |
| **Độ chính xác ngữ nghĩa (Semantic Accuracy)** | 10.0% | 62.8% | Phép so sánh Jaccard/Exact Match kết quả trả về của DB so với đáp án mẫu |
| **Tỉ lệ lỗi hệ tọa độ (CRS Violation)** | 0.0% | 0.0% | Compiler kiểm soát hoàn toàn hệ tọa độ phẳng |
| **Thời gian phản hồi trung bình (Latency)** | 14.45s | 8.97s | Kiến trúc mới ổn định hơn nhờ giảm số vòng tự sửa |

## 2. Chi tiết kết quả từng Câu hỏi thử nghiệm (GS-QA Templates)

| ID | Template | Câu hỏi | Độ khó | Cũ (SQL) | Mới (IR) | Cũ Acc | Mới Acc | Cũ CRS | Mới CRS |
| :-: | :--- | :--- | :-: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `intersects+count` | Có bao nhiêu ferry_terminal ở Phường Sơn Trà? | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 2 | `intersects+count` | Có bao nhiêu cafe ở Phường Liên Chiểu? | Easy | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 3 | `intersects+count` | Có bao nhiêu cafe ở Phường Điện Bàn Đông? | Easy | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 4 | `intersects+count` | Có bao nhiêu restaurant ở Phường Điện Bàn? | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 5 | `intersects+count` | Có bao nhiêu fast_food ở Phường Liên Chiểu? | Easy | 🟢 OK | 🟢 OK | 100% | 100% | ✅ An toàn | ✅ An toàn |
| 6 | `intersects+count` | Có bao nhiêu pub ở Phường Điện Bàn Bắc? | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 7 | `intersects+count` | Có bao nhiêu community_centre ở Phường Hương Trà? | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 8 | `intersects+name` | Liệt kê danh sách các fast_food nằm ở Phường Quảng Phú | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 9 | `intersects+name` | Liệt kê danh sách các bar nằm ở Phường Hải Vân | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 10 | `intersects+name` | Liệt kê danh sách các marketplace nằm ở Phường Liên Chiểu | Easy | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 11 | `intersects+name` | Liệt kê danh sách các ferry_terminal nằm ở Phường Hòa Khánh | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 12 | `intersects+name` | Liệt kê danh sách các cafe nằm ở Phường Hải Vân | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 13 | `intersects+name` | Liệt kê danh sách các restaurant nằm ở Phường Thanh Khê | Easy | 🔴 Fail | 🟢 OK | 0% | 50% | ✅ An toàn | ✅ An toàn |
| 14 | `intersects+name` | Liệt kê danh sách các bar nằm ở Phường Sơn Trà | Easy | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 15 | `range+count` | Có bao nhiêu địa điểm trong vòng 500m xung quanh Cua Dai? | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 16 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 2000m xung quanh POI 4727717789? | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 17 | `range+count` | Có bao nhiêu địa điểm trong vòng 1000m xung quanh Thuỷ Sơn? | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 18 | `range+count` | Có bao nhiêu địa điểm trong vòng 1500m xung quanh Non Nuoc Beach? | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 19 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh Thanh Ha Pottery Village? | Medium | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 20 | `range+count` | Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh Hội quán Hải Nam? | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 21 | `range+count` | Có bao nhiêu địa điểm trong vòng 500m xung quanh Non Nuoc Beach? | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 22 | `range+name` | Tìm các khách sạn nằm trong bán kính 500m tính từ Kim Bong Carpentry Village | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 23 | `range+name` | Tìm các khách sạn nằm trong bán kính 1500m tính từ Saturday Option | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 24 | `range+name` | Tìm các địa điểm du lịch nằm trong bán kính 1000m tính từ POI 4727717789 | Medium | 🔴 Fail | 🔴 Fail | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 25 | `range+name` | Tìm các khách sạn nằm trong bán kính 2000m tính từ Kim Bong Carpentry Village | Medium | 🔴 Fail | 🟢 OK | 0% | 50% | ✅ An toàn | ✅ An toàn |
| 26 | `range+name` | Tìm các địa điểm du lịch nằm trong bán kính 1500m tính từ Thanh Ha Pottery Village | Medium | 🔴 Fail | 🟢 OK | 0% | 71% | ✅ An toàn | ✅ An toàn |
| 27 | `range+name` | Tìm các địa điểm du lịch nằm trong bán kính 2000m tính từ Kim Bong Carpentry Village | Medium | 🟢 OK | 🟢 OK | 0% | 50% | ✅ An toàn | ✅ An toàn |
| 28 | `range+name` | Tìm các địa điểm du lịch nằm trong bán kính 500m tính từ Thanh Ha Pottery Village | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 29 | `knn+name` | Quán bar nào nằm gần nhất với tọa độ 108.3298 15.8784? | Medium | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 30 | `knn+name` | Quán community_centre nào nằm gần nhất với tọa độ 108.3613 15.8964? | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 31 | `knn+name` | Quán marketplace nào nằm gần nhất với tọa độ 108.3689 15.8938? | Medium | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 32 | `knn+name` | Quán pub nào nằm gần nhất với tọa độ 108.363 15.8643? | Medium | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 33 | `knn+name` | Quán fast_food nào nằm gần nhất với tọa độ 108.3659 15.8944? | Medium | 🟢 OK | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 34 | `knn+name` | Quán bar nào nằm gần nhất với tọa độ 108.3045 15.8716? | Medium | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 35 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.3278 15.8657 tên là gì? | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 36 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 107.725 15.8102 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 37 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.2914 15.8537 tên là gì? | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 38 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.3647 15.8965 tên là gì? | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 39 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.4966 15.6664 tên là gì? | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 40 | `knn+distance` | Nơi lưu trú gần nhất với vị trí 108.3066 15.8686 tên là gì? | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 41 | `knn:non_spat_filter+name` | Khách sạn 3 sao nằm gần nhất với tọa độ 108.3225 15.8668 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 0% | 33% | ✅ An toàn | ✅ An toàn |
| 42 | `knn:non_spat_filter+name` | Khách sạn 4 sao nằm gần nhất với tọa độ 108.3288 15.8635 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 0% | 50% | ✅ An toàn | ✅ An toàn |
| 43 | `knn:non_spat_filter+name` | Khách sạn 5 sao nằm gần nhất với tọa độ 108.2912 15.8446 tên là gì? | Hard | 🟢 OK | 🟢 OK | 100% | 100% | ✅ An toàn | ✅ An toàn |
| 44 | `knn:non_spat_filter+name` | Khách sạn 5 sao nằm gần nhất với tọa độ 108.4901 15.6693 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 0% | 100% | ✅ An toàn | ✅ An toàn |
| 45 | `knn:non_spat_filter+name` | Khách sạn 3 sao nằm gần nhất với tọa độ 108.3095 15.8763 tên là gì? | Hard | 🔴 Fail | 🟢 OK | 0% | 33% | ✅ An toàn | ✅ An toàn |
| 46 | `range:non_spat_filter+name` | Liệt kê các homestay giá Trung bình cách Triem Tay Village dưới 2000m | Hard | 🟢 OK | 🔴 Fail | 100% | 0% | ✅ An toàn | ✅ An toàn |
| 47 | `range:non_spat_filter+name` | Liệt kê các homestay giá Sang trọng cách Thuỷ Sơn dưới 1000m | Hard | 🔴 Fail | 🔴 Fail | 0% | 0% | ✅ An toàn | ✅ An toàn |
| 48 | `range:non_spat_filter+name` | Liệt kê các homestay giá Trung bình cách Làng Bích Hoạ dưới 2000m | Hard | 🟢 OK | 🟢 OK | 100% | 100% | ✅ An toàn | ✅ An toàn |
| 49 | `range:non_spat_filter+name` | Liệt kê các homestay giá Sang trọng cách POI 4727717789 dưới 1000m | Hard | 🟢 OK | 🟢 OK | 100% | 100% | ✅ An toàn | ✅ An toàn |
| 50 | `range:non_spat_filter+name` | Liệt kê các homestay giá Rẻ cách Hội quán Hải Nam dưới 2000m | Hard | 🟢 OK | 🟢 OK | 0% | 0% | ✅ An toàn | ✅ An toàn |

## 3. Phân tích chi tiết các câu lệnh SQL sinh ra

### Câu 1: Có bao nhiêu ferry_terminal ở Phường Sơn Trà? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['ferry_terminal', '%Phường Sơn Trà%']`
  *Kết quả mẫu:* `0`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT id)
FROM boundaries
WHERE name ILIKE '%Sơn Trà%' AND admin_level = 6 AND tourism LIKE '%ferry_terminal%';
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 2: Có bao nhiêu cafe ở Phường Liên Chiểu? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['cafe', '%Phường Liên Chiểu%']`
  *Kết quả mẫu:* `40`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) 
FROM poi 
WHERE amenity = 'cafe' AND name ILIKE '%Phường Liên Chiêu%' LIMIT 10;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 3: Có bao nhiêu cafe ở Phường Điện Bàn Đông? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['cafe', '%Phường Điện Bàn Đông%']`
  *Kết quả mẫu:* `1`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS num_cafes
FROM poi 
WHERE amenity = 'cafe' AND name ILIKE '%Phường Điện Bàn Đông%'
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 4: Có bao nhiêu restaurant ở Phường Điện Bàn? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['restaurant', '%Phường Điện Bàn%']`
  *Kết quả mẫu:* `6`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(DISTINCT r.id) AS num_restaurants
FROM restaurants r
JOIN poi p ON ST_Contains(p.geom, r.geom)
WHERE p.amenity = 'restaurant' AND p.tourism = 'beach'
AND r.address LIKE '%Phường Điện Bàn%';
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 5: Có bao nhiêu fast_food ở Phường Liên Chiểu? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['fast_food', '%Phường Liên Chiểu%']`
  *Kết quả mẫu:* `0`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS count FROM accommodation WHERE tourism = 'fast_food' AND address ILIKE '%Phường Liên Chiều%'
  ```
  *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 6: Có bao nhiêu pub ở Phường Điện Bàn Bắc? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['pub', '%Phường Điện Bàn Bắc%']`
  *Kết quả mẫu:* `0`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT pub.name) AS count_pub FROM poi 
JOIN accommodation ON (pub.id = accommodation.id)
WHERE accommodation.tourism = 'restaurant' AND accommodation.address ILIKE '%Phường Điện Bàn Bắc%';
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 7: Có bao nhiêu community_centre ở Phường Hương Trà? (`intersects+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Tham số:* `['community_centre', '%Phường Hương Trà%']`
  *Kết quả mẫu:* `0`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(*) 
FROM boundaries as bc 
JOIN accommodation AS ac ON ac.address LIKE '%Phường Hương Trà%' 
WHERE ac.tourism = 'community_center' AND ac.geom @> (ST_Transform(ST_Buffer(POINT(ac.address), 1000)::geography, 4326))
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 8: Liệt kê danh sách các fast_food nằm ở Phường Quảng Phú (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['fast_food', '%Phường Quảng Phú%', 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, description, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'fast_food' AND address LIKE '%Phường Quảng Phú%' LIMIT 10;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 9: Liệt kê danh sách các bar nằm ở Phường Hải Vân (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['bar', '%Phường Hải Vân%', 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, description, rating, review_count, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'bar' AND tourism = 'restaurant' AND address LIKE '%Phường Hải Vân%';
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 10: Liệt kê danh sách các marketplace nằm ở Phường Liên Chiểu (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['marketplace', '%Phường Liên Chiểu%', 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address FROM accommodation WHERE tourism = 'marketplace' AND ST_Contains(ST_GeographyFromText('POINT(108.296435 21.077439)'), geom);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 11: Liệt kê danh sách các ferry_terminal nằm ở Phường Hòa Khánh (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['ferry_terminal', '%Phường Hòa Khánh%', 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, geom::jsonb AS geojson 
FROM ferry_terminal 
WHERE ST_Contains(geom::geography, (SELECT geom FROM boundaries WHERE name = 'Phường Hòa Khánh'));
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 12: Liệt kê danh sách các cafe nằm ở Phường Hải Vân (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['cafe', '%Phường Hải Vân%', 10]`
  *Kết quả mẫu:* `['LyNa Coffee', 'MaiTrang Coffee', 'POI 7173944885', 'Hải Vân Viên', 'POI 11535887469', 'UyenPhuong Coffee']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, review_count, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%Phường Hải Vân%'
ORDER BY rating DESC, review_count DESC;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `6 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 13: Liệt kê danh sách các restaurant nằm ở Phường Thanh Khê (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['restaurant', '%Phường Thanh Khê%', 10]`
  *Kết quả mẫu:* `['phú mỹ thành nhà hàng', 'Bánh Bèo Nóng', 'POI 4585476694', 'POI 4805182821', 'Nhà Hàng Chay Hoa Sen - Vegetarian Restaurant', 'Bun cha va beo 120', 'Bún Bò Bà Diệu', 'Cơm trưa, lẫu nướng Rammus', 'Bánh Tráng Dì Em', 'Quán Chay XUÂN']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, price_level, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'restaurant' AND address LIKE '%Phường Thanh Khê%' LIMIT 10;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Độ chính xác ngữ nghĩa:* `50.0%`

---

### Câu 14: Liệt kê danh sách các bar nằm ở Phường Sơn Trà (`intersects+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Tham số:* `['bar', '%Phường Sơn Trà%', 10]`
  *Kết quả mẫu:* `['POI 4658435989']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, ST_AsGeoJSON(geom) AS geom FROM poi WHERE amenity = 'bar' AND address LIKE '%Phường Sơn Trà%';
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 15: Có bao nhiêu địa điểm trong vòng 500m xung quanh Cua Dai? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Cua Dai%', 500.0]`
  *Kết quả mẫu:* `25`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT count(*)
FROM poi AS p
WHERE ST_DWithin(p.geom::geography, (SELECT geom FROM boundaries WHERE name = 'Cua Dai')::geography, 500.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 16: Có bao nhiêu nơi lưu trú trong vòng 2000m xung quanh POI 4727717789? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%POI 4727717789%', 2000.0]`
  *Kết quả mẫu:* `19`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT name) 
FROM accommodation AS acmt JOIN poi AS poi1 ON ST_DWithin(acmt.geom::geography, poi1.geom::geography, 2000.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 17: Có bao nhiêu địa điểm trong vòng 1000m xung quanh Thuỷ Sơn? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Thuỷ Sơn%', 1000.0]`
  *Kết quả mẫu:* `25`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    count(*)
FROM 
    poi 
WHERE 
    ST_DistanceSphere(poi.geom, (SELECT geom FROM boundaries WHERE name = 'Thuỷ Sơn')) < 1000;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 18: Có bao nhiêu địa điểm trong vòng 1500m xung quanh Non Nuoc Beach? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Non Nuoc Beach%', 1500.0]`
  *Kết quả mẫu:* `6`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*)
FROM poi
WHERE ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE name = 'Non Nuoc Biển')::geography, 1500.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 19: Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh Thanh Ha Pottery Village? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Thanh Ha Pottery Village%', 1500.0]`
  *Kết quả mẫu:* `3`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT T2.id) 
FROM boundaries AS T1 
JOIN accommodation AS T3 ON ST_DWithin(T1.geom::geography, T3.geom::geography, 1500.0)
JOIN poi AS T4 ON T3.id = T4.id AND (T4.amenity IN ('hostel', 'guest_house') OR T4.tourism IN ('hostel', 'guest_house'))
WHERE T4.name ILIKE '%Thanh Ha Pottery Village%'
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `3 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 20: Có bao nhiêu nơi lưu trú trong vòng 1500m xung quanh Hội quán Hải Nam? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Hội quán Hải Nam%', 1500.0]`
  *Kết quả mẫu:* `218`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT id) AS count_of_hotels FROM accommodation WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name = 'Hội quán Hải Nam')::geography, 1500.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 21: Có bao nhiêu địa điểm trong vòng 500m xung quanh Non Nuoc Beach? (`range+count`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Tham số:* `['%Non Nuoc Beach%', 500.0]`
  *Kết quả mẫu:* `2`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT t2.id) AS num_points 
FROM poi AS t1 
JOIN ST_Buffer((SELECT geom FROM poi WHERE name = 'Non Nuoc Beach')::geography, 500)::geography AS buffer ON t1.geom && buffer 
WHERE t1.amenity IN ('beach', 'resort', 'cafe', 'restaurant')
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT count(*) AS total
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 22: Tìm các khách sạn nằm trong bán kính 500m tính từ Kim Bong Carpentry Village (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Kim Bong Carpentry Village%', 500.0, 10]`
  *Kết quả mẫu:* `['Nguyen Duy Homestay']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    ST_AsGeoJSON(geom) as geom
FROM 
    accommodation
WHERE 
    tourism = 'hotel' 
    AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name LIKE '%Kim Bong Carpentry Village%')::geography, 500.0)
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 23: Tìm các khách sạn nằm trong bán kính 1500m tính từ Saturday Option (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Saturday Option%', 1500.0, 10]`
  *Kết quả mẫu:* `['Son Tra Resort & Spa']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, stars, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hotel' AND stars > 0 AND ST_DWithin(geom::geography, (SELECT ST_Transform(ST_GeomFromText('LINESTRING(-12.3745669 115.1849228, -12.3745669 115.1849228)'), 4326)::geography, 1500), 1500);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 24: Tìm các địa điểm du lịch nằm trong bán kính 1000m tính từ POI 4727717789 (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%POI 4727717789%', 1000.0, 10]`
  *Kết quả mẫu:* `['POI 4727717789']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE id = '4727717789' LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu 25: Tìm các khách sạn nằm trong bán kính 2000m tính từ Kim Bong Carpentry Village (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Kim Bong Carpentry Village%', 2000.0, 10]`
  *Kết quả mẫu:* `['Accommodation 1576490972', 'Nhi Nhi Hotel', 'Emerald Hoi An Riverside Resort', 'Khach San Phu Thinh', 'Vinh Hung', 'An Hoi', 'Long Life Riverside', 'Pho Hoi', 'Little Hoi An Boutique Hotel & Spa', 'Anantara Resort']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, geom::jsonb AS geom 
FROM accommodation ac 
WHERE (tourism = 'hotel') AND ST_DWithin(geom::geography, ST_SetSRID(ST_GeomFromText('POINT(-109.87 16.45)'::geography, 4326.0), 4326), 2000)
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Độ chính xác ngữ nghĩa:* `50.0%`

---

### Câu 26: Tìm các địa điểm du lịch nằm trong bán kính 1500m tính từ Thanh Ha Pottery Village (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Thanh Ha Pottery Village%', 1500.0, 10]`
  *Kết quả mẫu:* `['Thanh Ha Pottery Village', 'Thuy Ta Song Que', 'Triem Tay Village', 'bamboo', 'Minh', 'Terracotta Park', 'POI 5825158353', 'Chill spot with hammocks', 'Cay Thi Coffee', 'POI 7144664585']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE ST_Distance_Sphere(geom::geography, (SELECT ST_SetSRID(ST_PointFromText('POINT(-109.648725 16.364179)', 4326), 4326)::geography) * 1000) <= 1500;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `14 bản ghi` | *Độ chính xác ngữ nghĩa:* `71.4%`

---

### Câu 27: Tìm các địa điểm du lịch nằm trong bán kính 2000m tính từ Kim Bong Carpentry Village (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Kim Bong Carpentry Village%', 2000.0, 10]`
  *Kết quả mẫu:* `['Cargo Club Cafe & Restaurant', 'Che Bar', 'Day & Night Café', 'Banana Leaf', 'Blue Dragon', 'Can', 'Cordon Bleu', 'Dac San Hoi An', 'Du Port', 'Faifoo']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Kim Bong Carpentry Village%' LIMIT 1)::geography, 2000.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `20 bản ghi` | *Độ chính xác ngữ nghĩa:* `50.0%`

---

### Câu 28: Tìm các địa điểm du lịch nằm trong bán kính 500m tính từ Thanh Ha Pottery Village (`range+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['%Thanh Ha Pottery Village%', 500.0, 10]`
  *Kết quả mẫu:* `['Thanh Ha Pottery Village', 'Terracotta Park', 'POI 7144664585', 'POI 9840393561', 'Làng mộc Thanh Hà']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, description, rating, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE distance(ST_GeographyFromText('POINT(-108.670344 16.254928)'), geom::geography, 100) < 500;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `5 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 29: Quán bar nào nằm gần nhất với tọa độ 108.3298 15.8784? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['bar', 108.3298, 15.8784, 1]`
  *Kết quả mẫu:* `['Mezcal Cocteleria']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'bar' AND address::geography && ST_GeomFromText('POINT(108.3298 15.8784)', 4326);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 30: Quán community_centre nào nằm gần nhất với tọa độ 108.3613 15.8964? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['community_centre', 108.3613, 15.8964, 1]`
  *Kết quả mẫu:* `['Hội quán Hải Nam']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'community_centre' AND ST_DWithin(ST_SetSRID(Point(108.3613::geography, 15.8964)::geography, 4326.0), geom::geography, 100)
LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 31: Quán marketplace nào nằm gần nhất với tọa độ 108.3689 15.8938? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['marketplace', 108.3689, 15.8938, 1]`
  *Kết quả mẫu:* `['Chợ Đêm']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, geom::jsonb AS json FROM accommodation WHERE ST_Contains(geom::geography, (SELECT ST_Transform(ST_PointFromText('POINT(108.3689 15.8938)', 4326), 3406)::geography)) ORDER BY distance(geom::geography, (SELECT ST_Transform(ST_PointFromText('POINT(108.3689 15.8938)', 4326), 3406)::geography)) LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 32: Quán pub nào nằm gần nhất với tọa độ 108.363 15.8643? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['pub', 108.363, 15.8643, 1]`
  *Kết quả mẫu:* `['Route 66 Cafe & Beer Club']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'pub' AND ST_DWithin(ST_SetSRID(geom::geography, 4326), (ST_GeomFromText('POINT(108.363 15.8643)', 4326)::geography, 4326), 100);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 33: Quán fast_food nào nằm gần nhất với tọa độ 108.3659 15.8944? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['fast_food', 108.3659, 15.8944, 1]`
  *Kết quả mẫu:* `['POI 4810074526']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'fast_food' AND ST_DWithin(geom::geography, (SELECT geom FROM poi WHERE amenity = 'restaurant' LIMIT 1)::geography, 10.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 34: Quán bar nào nằm gần nhất với tọa độ 108.3045 15.8716? (`knn+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `['bar', 108.3045, 15.8716, 1]`
  *Kết quả mẫu:* `['brown eyes']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'bar' AND ST_DWithin((POINT('108.3045 15.8716'))::geography, geom::geography, 1000.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 35: Nơi lưu trú gần nhất với vị trí 108.3278 15.8657 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[108.3278, 15.8657, 1]`
  *Kết quả mẫu:* `['Nguyen Duy Homestay']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
       ST_DWithin((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), 
                  geom::geography, 0.001); -- Adjust the distance in meters as needed
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.address = %s
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 36: Nơi lưu trú gần nhất với vị trí 107.725 15.8102 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[107.725, 15.8102, 1]`
  *Kết quả mẫu:* `['Accommodation 13006550737']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom FROM accommodation WHERE tourism = 'hostel' AND (ST_Contains(ST_GeographyFromText('SRID=4326;POINT(107.725 15.8102)'), geom)) ORDER BY distance(st_centroid(geom), ST_GeographyFromText('SRID=4326;POINT(107.725 15.8102)')) LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.name = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 37: Nơi lưu trú gần nhất với vị trí 108.2914 15.8537 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[108.2914, 15.8537, 1]`
  *Kết quả mẫu:* `['Accommodation 4542951496']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'hotel') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom)
ORDER BY rating DESC LIMIT 10;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.name = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 38: Nơi lưu trú gần nhất với vị trí 108.3647 15.8965 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[108.3647, 15.8965, 1]`
  *Kết quả mẫu:* `['Accommodation 5730645424']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'guest_house' OR tourism = 'hostel') AND 
      ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1), geom)
ORDER BY price_level DESC, review_count DESC
LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.address = %s
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 39: Nơi lưu trú gần nhất với vị trí 108.4966 15.6664 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[108.4966, 15.6664, 1]`
  *Kết quả mẫu:* `['Blue Ocean homestay']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation a 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
ST_DWithin((SELECT geom FROM boundaries WHERE name ILIKE '%Hải Châu%' LIMIT 1)::geography, a.geom::geography, 50.0);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.name = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 40: Nơi lưu trú gần nhất với vị trí 108.3066 15.8686 tên là gì? (`knn+distance`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[108.3066, 15.8686, 1]`
  *Kết quả mẫu:* `['Terracotta Homestay']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND ST_Contains((SELECT geom FROM boundaries WHERE name ILIKE '%Sơn Trà%' LIMIT 1), geom);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.address = %s
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

---

### Câu 41: Khách sạn 3 sao nằm gần nhất với tọa độ 108.3225 15.8668 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[3, 108.3225, 15.8668, 1]`
  *Kết quả mẫu:* `['Homestay The Corner']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hotel' AND stars = 3 
AND ST_DWithin(
    geom::geography,
    (SELECT geog FROM boundaries WHERE name LIKE '%Hải Châu%'),
    1000
);
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `3 bản ghi` | *Độ chính xác ngữ nghĩa:* `33.3%`

---

### Câu 42: Khách sạn 4 sao nằm gần nhất với tọa độ 108.3288 15.8635 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[4, 108.3288, 15.8635, 1]`
  *Kết quả mẫu:* `['Lantana Riverside Hotel Hoi An']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hotel' AND stars = 4 
AND ST_Distance(geom::geography, (SELECT ST_GeometryFromText('POINT(108.3288 15.8635)').ST_Buffer('1km'))::geography) < 100;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi` | *Độ chính xác ngữ nghĩa:* `50.0%`

---

### Câu 43: Khách sạn 5 sao nằm gần nhất với tọa độ 108.2912 15.8446 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[5, 108.2912, 15.8446, 1]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    ST_AsGeoJSON(geom) AS geom 
FROM 
    accommodation 
WHERE 
    stars = 5 AND 
    (address LIKE '%tọa độ 108.2912 15.8446%' OR 
     address LIKE '%tọa độ 108.2912 15.8446%')
LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 44: Khách sạn 5 sao nằm gần nhất với tọa độ 108.4901 15.6693 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[5, 108.4901, 15.6693, 1]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, ST_AsGeoJSON(geom) AS geom 
FROM accommodation 
WHERE (tourism = 'hotel' OR tourism = 'guest_house') AND stars = 5 
AND ST_DWithin(geom::geography, '(SELECT ST_Transform(ST_SetSRID(ST_MakePoint(108.4901::geography, 15.6693), 4326)::geography, 4326)', 1000)
ORDER BY stars DESC LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 45: Khách sạn 3 sao nằm gần nhất với tọa độ 108.3095 15.8763 tên là gì? (`knn:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Tham số:* `[3, 108.3095, 15.8763, 1]`
  *Kết quả mẫu:* `['Homestay The Corner']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, rating, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE stars = 3 AND ST_Distance((ST_Transform(ST_SetSRID(ST_Point(108.3095, 15.8763), 4326), 3406)), geom::geography) <= 100
ORDER BY rating DESC LIMIT 1;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `3 bản ghi` | *Độ chính xác ngữ nghĩa:* `33.3%`

---

### Câu 46: Liệt kê các homestay giá Trung bình cách Triem Tay Village dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND t.tourism = ANY(%s)
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['Trung bình', ['guest_house', 'hostel'], '%Triem Tay Village%', 2000.0, 10]`
  *Kết quả mẫu:* `[]`

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
    price_level = 'Trung bình' AND 
    ST_DWithin(
        geom::geography,
        (SELECT geom FROM boundaries WHERE name = 'Triem Tay Village')::geography,
        2000
    );
  ```
  *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu 47: Liệt kê các homestay giá Sang trọng cách Thuỷ Sơn dưới 1000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND t.tourism = ANY(%s)
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['Sang trọng', ['guest_house', 'hostel'], '%Thuỷ Sơn%', 1000.0, 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, price_level, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
      stars = 5 AND 
      ST_Distance_Sphere(geom::geography, (SELECT ST_Transform(ST_Buffer((SELECT geom FROM boundaries WHERE name ILIKE '%Thuỷ Sơn%' LIMIT 1), 1000)::geography, 4326))) < 1000;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: operator does not exist: character varying >= smallint
LINE 3: WHERE t.price_level >= $1
                            ^
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.*

---

### Câu 48: Liệt kê các homestay giá Trung bình cách Làng Bích Hoạ dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND t.tourism = ANY(%s)
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['Trung bình', ['guest_house', 'hostel'], '%Làng Bích Hoạ%', 2000.0, 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    price_level, 
    address, 
    ST_AsGeoJSON(geom) as geom 
FROM 
    accommodation 
WHERE 
    tourism = 'hostel' 
AND 
    price_level = 'Trung bình' 
AND 
    ST_DWithin((SELECT geom FROM boundaries WHERE name LIKE '%Làng Bích Hoạ%' LIMIT 1)::geography, geom::geography, 2000.0);
  ```
  *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 49: Liệt kê các homestay giá Sang trọng cách POI 4727717789 dưới 1000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND t.tourism = ANY(%s)
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['Sang trọng', ['guest_house', 'hostel'], '%POI 4727717789%', 1000.0, 10]`
  *Kết quả mẫu:* `[]`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT h.name, h.stars, h.address, ST_AsGeoJSON(h.geom) AS geom 
FROM accommodation h 
JOIN poi p ON ST_DWithin(p.geom::geography, h.geom::geography, 1000.0)
WHERE h.amenity = 'hostel' AND h.price_level = 'Sang trọng' AND h.id = 4727717789;
  ```
  *Độ chính xác ngữ nghĩa:* `100.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `100.0%`

---

### Câu 50: Liệt kê các homestay giá Rẻ cách Hội quán Hải Nam dưới 2000m (`range:non_spat_filter+name`)
- **Câu truy vấn đáp án mẫu (Gold SQL):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND t.tourism = ANY(%s)
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Tham số:* `['Rẻ', ['guest_house', 'hostel'], '%Hội quán Hải Nam%', 2000.0, 10]`
  *Kết quả mẫu:* `['Accommodation 1576490972', 'Nhà Nghỉ Thời Đại', 'Hoi An Green Life Homestay', 'Trust Villa', 'Memories Guest House', 'VIP Garden Home', 'Accommodation 4141988889', 'rang dong sunrise', 'Cloudy Homestay', 'Petunia Garden Homestay & Hostel']`

- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, price_level, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hostel' OR tourism = 'guest_house') AND 
      stars = 3 AND 
      price_level = 'Rẻ' AND 
      ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(-109.6746518, 10.8624944), 4326)::geography) < 2000;
  ```
  *Độ chính xác ngữ nghĩa:* `0.0%`
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.price_level = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi` | *Độ chính xác ngữ nghĩa:* `0.0%`

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
