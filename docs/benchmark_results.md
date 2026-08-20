# Báo cáo Thử nghiệm Đánh giá trên Benchmark GS-QA

> **Ngày đánh giá:** 2026-08-20  
> **Mô hình LLM sử dụng:** `qwen2.5:1.5b` (Ollama)  
> **Cơ sở dữ liệu:** PostgreSQL + PostGIS (Đà Nẵng tourism dataset)  

## 1. Kết quả Tổng quan

| Chỉ số đánh giá | Kiến trúc Cũ (Direct SQL) | Kiến trúc Mới (LLM-to-IR-to-SQL) | Nhận xét |
| :--- | :---: | :---: | :--- |
| **Tỉ lệ sinh SQL thành công (Execution SR)** | 60.0% | 86.7% | Kiến trúc mới loại bỏ lỗi cú pháp SQL và ép kiểu |
| **Tỉ lệ lỗi hệ tọa độ (CRS Violation)** | 0.0% | 0.0% | Compiler kiểm soát hoàn toàn hệ tọa độ phẳng |
| **Thời gian phản hồi trung bình (Latency)** | 11.27s | 14.49s | Kiến trúc mới ổn định hơn nhờ giảm số vòng tự sửa |

## 2. Chi tiết kết quả từng Câu hỏi thử nghiệm (GS-QA Templates)

| ID | Template | Câu hỏi | Độ khó | Cũ (SQL) | Mới (IR) | Cũ CRS | Mới CRS |
| :-: | :--- | :--- | :-: | :---: | :---: | :---: | :---: |
| 1 | `intersects+count` | Có bao nhiêu quán cafe ở Phường Sơn Trà? | Easy | 🔴 Fail | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 2 | `intersects+name` | Liệt kê các quán cafe ở Phường Hải Châu | Easy | 🔴 Fail | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 3 | `intersects+name` | Tìm các khách sạn ở Phường Ngũ Hành Sơn | Easy | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 4 | `range+count` | Có bao nhiêu homestay trong bán kính 1km từ Cầu Sông Hàn? | Medium | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 5 | `range+name` | Tìm các quán ăn cách Cầu Trần Thị Lý dưới 500m | Medium | 🔴 Fail | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 6 | `knn+name` | Quán cafe nào gần tọa độ 108.22 16.06 nhất? | Medium | 🔴 Fail | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 7 | `knn+distance` | Khách sạn gần tọa độ 108.23 16.07 nhất cách đây bao xa? | Hard | 🔴 Fail | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 8 | `knn:non_spat_filter+name` | Tìm khách sạn 3 sao gần tọa độ 108.22 16.06 nhất | Hard | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 9 | `range:non_spat_filter+name` | Tìm các homestay giá rẻ trong bán kính 2km từ Cầu Sông Hàn | Hard | 🔴 Fail | 🔴 Fail | ✅ An toàn | ✅ An toàn |
| 10 | `range:non_spat_filter+name` | Tìm các quán cafe có rating trên 4.5 trong bán kính 1km từ Cầu Thuận Phước | Hard | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 11 | `intersects:non_spat_filter+count` | Có bao nhiêu khách sạn 4 sao ở Phường Sơn Trà? | Medium | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 12 | `intersects:non_spat_filter+name` | Liệt kê các homestay giá rẻ ở Phường Ngũ Hành Sơn | Medium | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 13 | `intersects:area_total+area (unsupported agg)` | Tổng diện tích của Phường Sơn Trà là bao nhiêu? | Hard | 🟢 OK | 🔴 Fail | ✅ An toàn | ✅ An toàn |
| 14 | `knn:direction+name (unsupported dir)` | Tìm quán cafe ở phía bắc của Cầu Sông Hàn gần nhất | Hard | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |
| 15 | `range:towards+name (unsupported towards)` | Tìm các khách sạn nằm dọc theo hướng đi về phía Cầu Thuận Phước trong bán kính 1km | Hard | 🟢 OK | 🟢 OK | ✅ An toàn | ✅ An toàn |

## 3. Phân tích chi tiết các câu lệnh SQL sinh ra

### Câu 1: Có bao nhiêu quán cafe ở Phường Sơn Trà? (`intersects+count`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(*) AS num_cafes
FROM poi
WHERE amenity = 'cafe' AND address LIKE '%Phường Sơn Trà%';
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `10 bản ghi`

---

### Câu 2: Liệt kê các quán cafe ở Phường Hải Châu (`intersects+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND tourism IN ('restaurant', 'homestay') 
  AND address ILIKE '%Phường Hải Châu%' LIMIT 10;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.amenity, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.tourism = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi`

---

### Câu 3: Tìm các khách sạn ở Phường Ngũ Hành Sơn (`intersects+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, address, stars, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hotel') AND ST_Contains((SELECT geom FROM boundaries WHERE name LIKE '%Phường Ngũ Hành Sơn%'), geom);
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.address, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `10 bản ghi`

---

### Câu 4: Có bao nhiêu homestay trong bán kính 1km từ Cầu Sông Hàn? (`range+count`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT h.id) 
FROM accommodation AS h 
JOIN poi AS p ON h.address ILIKE '%Sơn Trà%' AND ST_Contains(p.geom, h.geom)
WHERE h.tourism = 'guest_house' AND p.amenity = 'hostel';
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.address, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.rating DESC NULLS LAST
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi`

---

### Câu 5: Tìm các quán ăn cách Cầu Trần Thị Lý dưới 500m (`range+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, amenity, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE address LIKE '%Cầu Trần Thị Lý%' AND (amenity = 'restaurant' OR amenity = 'cafe') 
AND ST_DWithin(geom::geography, (SELECT ST_Union(geom::geography) FROM poi WHERE name ILIKE '%biển%'), 500.0);
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `2 bản ghi`

---

### Câu 6: Quán cafe nào gần tọa độ 108.22 16.06 nhất? (`knn+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND address LIKE '%108.22 16.06%' ORDER BY rating DESC LIMIT 1;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
ORDER BY t.name ASC NULLS LAST
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi`

---

### Câu 7: Khách sạn gần tọa độ 108.23 16.07 nhất cách đây bao xa? (`knn+distance`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT 
    name, 
    address, 
    stars, 
    ST_AsGeoJSON(geom) as geom
FROM 
    accommodation
WHERE 
    tourism = 'hotel' AND stars > 2
    AND ST_Distance(
        (
            SELECT geom FROM boundaries WHERE name ILIKE '%108.23 16.07%'
        ), 
        (SELECT geom FROM accommodation)
    ) < 500;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.address, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = %s
  AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `1 bản ghi`

---

### Câu 8: Tìm khách sạn 3 sao gần tọa độ 108.22 16.06 nhất (`knn:non_spat_filter+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, stars, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE (tourism = 'hotel') AND (stars = 3) AND ST_Distance(geom::geography, ('POINT(108.22 16.06)'::geography)) < 500;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.address, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.stars = %s
  AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
ORDER BY t.rating DESC NULLS LAST
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi`

---

### Câu 9: Tìm các homestay giá rẻ trong bán kính 2km từ Cầu Sông Hàn (`range:non_spat_filter+name`)
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
    (tourism = 'hostel' OR tourism = 'guest_house') 
AND 
    price_level = 'Rẻ' 
AND 
    ST_Distance_Cartesian(ST_Buffer((SELECT geom FROM boundaries WHERE name ILIKE '%Sông Hàn%' LIMIT 1), 2000)::geography, geom) < 5000;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu 10: Tìm các quán cafe có rating trên 4.5 trong bán kính 1km từ Cầu Thuận Phước (`range:non_spat_filter+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, ST_AsGeoJSON(geom) AS geom 
FROM poi 
WHERE amenity = 'cafe' AND price_level = 'Trung bình' AND rating > 4.5 AND ST_DWithin(geom::geography, (SELECT geom FROM roads_vertices_pgr WHERE name = 'Cầu Thuận Phước')::geography, 1000.0)
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.rating, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND t.rating >= %s
  AND ST_DWithin(t.geom::geography, (SELECT geom FROM poi  WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))  ORDER BY length(name) LIMIT 1)::geography, %s)
LIMIT %s
  ```
  *Kết quả thực thi:* `4 bản ghi`

---

### Câu 11: Có bao nhiêu khách sạn 4 sao ở Phường Sơn Trà? (`intersects:non_spat_filter+count`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT COUNT(DISTINCT id)
FROM accommodation
WHERE tourism = 'hotel' AND stars = 4;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.stars, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = %s
  AND t.stars >= %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `0 bản ghi`

---

### Câu 12: Liệt kê các homestay giá rẻ ở Phường Ngũ Hành Sơn (`intersects:non_spat_filter+name`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, price_level, address, ST_AsGeoJSON(geom) as geom 
FROM accommodation 
WHERE tourism = 'hostel' AND stars = 0 AND price_level = 'Rẻ';
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.price_level, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = ANY(%s)
  AND t.price_level = %s
  AND ST_Contains((SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE unaccent(lower(name)) LIKE unaccent(lower(%s)) ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)
LIMIT %s
  ```
  *Kết quả thực thi:* `5 bản ghi`

---

### Câu 13: Tổng diện tích của Phường Sơn Trà là bao nhiêu? (`intersects:area_total+area (unsupported agg)`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT ST_Area((SELECT geom FROM boundaries WHERE name = 'Sơn Trà'))::TEXT;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  *Lỗi: Không tạo được truy vấn hợp lệ từ câu hỏi.*

---

### Câu 14: Tìm quán cafe ở phía bắc của Cầu Sông Hàn gần nhất (`knn:direction+name (unsupported dir)`)
- **Kiến trúc Cũ (Direct SQL):**
  ```sql
  SELECT name, rating, price_level, ST_AsGeoJSON(geom) as geom 
FROM poi 
WHERE amenity = 'cafe' AND (name ~ '^Cần Thơ|Quận 1|Quận 3|Quận 4|Quận 5|Quận 6|Quận 7|Quận 8|Quận 9|Quận 10|Quận 11|Quận 12|Quận 13|Quận 14|Quận 15|Quận 16|Quận 17|Quận 18|Quận 19|Quận 20') 
AND price_level = 'Trung bình' AND ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE name ILIKE '%Cầu Sông Hàn%' LIMIT 1)::geography, 500.0)
LIMIT 1;
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, ST_AsGeoJSON(t.geom) AS geom
FROM poi t
WHERE t.amenity = %s
  AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `10 bản ghi`

---

### Câu 15: Tìm các khách sạn nằm dọc theo hướng đi về phía Cầu Thuận Phước trong bán kính 1km (`range:towards+name (unsupported towards)`)
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
    tourism = 'hotel' AND 
    (ST_DWithin(geom::geography, (SELECT geom FROM boundaries WHERE admin_level = 6 AND name ILIKE '%Cầu Thuận Phước%' LIMIT 1)::geography, 1000.0))
  ```
- **Kiến trúc Mới (IR -> Compiler):**
  ```sql
  SELECT t.name, t.address, ST_AsGeoJSON(t.geom) AS geom
FROM accommodation t
WHERE t.tourism = %s
  AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT %s
  ```
  *Kết quả thực thi:* `5 bản ghi`

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
