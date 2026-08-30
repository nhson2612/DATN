"""Truy vấn điểm đến (tỉnh/thành) và địa điểm thuộc điểm đến. Chỉ SQL."""

from app.core.database import execute_query

# 7 nhóm gốc của Overture, gom lại thành các mục người Việt hiểu được. Một trang
# điểm đến cần trả lời "ăn gì, chơi gì, xem gì, ngủ đâu" chứ không phải liệt kê
# 590 loại địa điểm chi tiết.
NHOM_HIEN_THI = {
    "tham_quan": {
        "ten": "Tham quan",
        "roots": ["cultural_and_historic", "geographic_entities"],
    },
    "an_uong": {
        "ten": "Ăn uống",
        "roots": ["food_and_drink"],
    },
    "vui_choi": {
        "ten": "Vui chơi giải trí",
        "roots": ["arts_and_entertainment", "sports_and_recreation"],
    },
    "mua_sam": {
        "ten": "Mua sắm",
        "roots": ["shopping"],
    },
}


def list_provinces(limit: int = 100):
    """Tỉnh/thành kèm số địa điểm, đọc từ bảng đếm sẵn `province_stats`.

    Đếm trực tiếp bằng COUNT(*) trên 805k dòng JOIN mất 72 giây mỗi lần tải
    trang. Con số này chỉ đổi khi nhập dữ liệu mới nên được tính sẵn trong
    scripts/assign_province.py.
    """
    return execute_query(
        """
        SELECT id, name, so_dia_diem, so_luu_tru, lon, lat
        FROM province_stats
        WHERE so_dia_diem > 0
        ORDER BY so_dia_diem DESC
        LIMIT %s
        """,
        (limit,),
    ) or []


def find_province(slug_hoac_ten: str):
    """Tra tỉnh theo slug hoặc tên gõ tắt.

    Người dùng gõ "da-nang" hoặc "Đà Nẵng", còn CSDL lưu "Thành phố Đà Nẵng" —
    phải bỏ được tiền tố hành chính, giống find_anchor trong search_service.
    """
    rows = execute_query(
        """
        SELECT id, name,
               ST_X(ST_Centroid(geom)) AS lon, ST_Y(ST_Centroid(geom)) AS lat
        FROM provinces_clean
        WHERE norm_txt(name) = %s
           OR regexp_replace(norm_txt(name),
                  '^(thanh pho|tinh|phuong|xa|quan|huyen) ', '') = %s
           OR replace(regexp_replace(norm_txt(name),
                  '^(thanh pho|tinh) ', ''), ' ', '-') = %s
        ORDER BY length(name)
        LIMIT 1
        """,
        (slug_hoac_ten, slug_hoac_ten, slug_hoac_ten),
    )
    return rows[0] if rows else None


def places_by_group(province_id: int, roots: list, limit: int = 12):
    """Địa điểm nổi bật của một nhóm trong tỉnh.

    Không sắp theo rating vì cột đó toàn giá trị mặc định 4.0 (xem README §4).
    Ưu tiên nơi có ảnh, rồi tới nơi có thông tin liên hệ — đó là tín hiệu thật
    duy nhất cho biết địa điểm đáng hiển thị.
    """
    return execute_query(
        """
        SELECT t.id, t.name, t.amenity AS category, 'poi' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               t.tags->>'addr:street' AS dia_chi,
               t.tags->>'phone'       AS dien_thoai,
               t.tags->>'website'     AS website,
               ph.url                 AS anh
        FROM poi t
        LEFT JOIN place_photos ph ON ph.place_type = 'poi' AND ph.place_id = t.id
        WHERE t.province_id = %s
          AND t.tags->>'category_root' = ANY(%s)
          AND t.name !~ '^(POI|Accommodation|Road) [0-9]+$'
        -- Đẩy `landmark_and_historical_building` xuống cuối: đó là thùng chứa
        -- của Overture, gộp cả căn hộ cho thuê lẫn di tích thật, nên nó lấn át
        -- các loại cụ thể như museum / buddhist_temple / beach.
        ORDER BY (t.amenity = 'landmark_and_historical_building'),
                 (ph.url IS NULL),
                 (t.tags->>'website' IS NULL),
                 (t.tags->>'phone' IS NULL),
                 -- Tên ngoài bảng chữ Latin/Việt (Hàn, Nhật, Trung) xuống cuối:
                 -- sắp theo alphabet thì chúng luôn đứng đầu, mà khách Việt đọc
                 -- không ra.
                 (t.name !~ '^[A-Za-zÀ-ỹ0-9]'),
                 t.name
        LIMIT %s
        """,
        (province_id, roots, limit),
    ) or []


def accommodations(province_id: int, limit: int = 12):
    return execute_query(
        """
        SELECT a.id, a.name, a.tourism AS category, 'accommodation' AS type,
               ST_X(a.geom) AS lon, ST_Y(a.geom) AS lat,
               a.address AS dia_chi, a.stars, a.price_range,
               a.tags->>'phone'   AS dien_thoai,
               a.tags->>'website' AS website,
               ph.url             AS anh
        FROM accommodation a
        LEFT JOIN place_photos ph
               ON ph.place_type = 'accommodation' AND ph.place_id = a.id
        WHERE a.province_id = %s
          AND a.name !~ '^(POI|Accommodation|Road) [0-9]+$'
        ORDER BY (ph.url IS NULL), (a.tags->>'website' IS NULL),
                 (a.name !~ '^[A-Za-zÀ-ỹ0-9]'), a.name
        LIMIT %s
        """,
        (province_id, limit),
    ) or []


def search_places(province_id=None, roots=None, category=None, q=None,
                  has_photo=False, page=1, page_size=24, bang="poi"):
    """Danh sách địa điểm có lọc + phân trang, cho view dạng lưới.

    Khác place_repo.all_as_geojson (trả GeoJSON cho bản đồ): ở đây trả danh sách
    phân trang kèm ảnh và thông tin liên hệ để render thẻ.

    Baymard: 40% trang du lịch thiếu bộ lọc chuyên ngành và đó là lý do hàng đầu
    khiến người dùng bỏ đi giữa chừng.
    """
    # Chỗ ở nằm ở bảng riêng `accommodation`, cột loại là `tourism` chứ không
    # phải `amenity`. Trang quản trị cần sửa được cả hai, nên tham số hoá bảng
    # thay vì viết một hàm gần-giống-hệt thứ hai.
    if bang not in ("poi", "accommodation"):
        raise ValueError(f"Bảng không hợp lệ: {bang!r}")
    cot_loai = "amenity" if bang == "poi" else "tourism"

    dieu_kien = ["t.name !~ '^(POI|Accommodation|Road) [0-9]+$'"]
    params = []

    if province_id:
        dieu_kien.append("t.province_id = %s")
        params.append(province_id)
    if roots:
        dieu_kien.append("t.tags->>'category_root' = ANY(%s)")
        params.append(list(roots))
    if category:
        dieu_kien.append(f"t.{cot_loai} = %s")
        params.append(category)
    if q:
        # norm_txt + chỉ mục trigram đã tạo sẵn cho search_service, dùng lại.
        dieu_kien.append("norm_txt(t.name) %% norm_txt(%s)")
        params.append(q)
    if has_photo:
        dieu_kien.append("ph.url IS NOT NULL")

    where = " AND ".join(dieu_kien)
    offset = (max(page, 1) - 1) * page_size

    rows = execute_query(
        f"""
        SELECT t.id, t.name, t.{cot_loai} AS category, '{bang}' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               t.tags->>'addr:street' AS dia_chi,
               t.tags->>'phone'       AS dien_thoai,
               t.tags->>'website'     AS website,
               ph.url                 AS anh,
               count(*) OVER ()       AS tong
        FROM {bang} t
        LEFT JOIN place_photos ph ON ph.place_type = '{bang}' AND ph.place_id = t.id
        WHERE {where}
        ORDER BY (t.{cot_loai} = 'landmark_and_historical_building'),
                 (ph.url IS NULL),
                 (t.name !~ '^[A-Za-zÀ-ỹ0-9]'),
                 t.name
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (page_size, offset),
    ) or []

    tong = rows[0]["tong"] if rows else 0
    for r in rows:
        r.pop("tong", None)
    return rows, tong


def get_place_detail(place_type: str, place_id: int):
    """Chi tiết một địa điểm cho trang detail."""
    if place_type == "poi":
        sql = """
            SELECT t.id, t.name, t.amenity AS category, 'poi' AS type,
                   t.description, t.province_id,
                   ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
                   t.tags->>'addr:street'    AS dia_chi,
                   t.tags->>'addr:city'      AS thanh_pho,
                   t.tags->>'phone'          AS dien_thoai,
                   t.tags->>'website'        AS website,
                   t.tags->>'brand'          AS thuong_hieu,
                   t.tags->>'category_root'  AS nhom,
                   ph.url AS anh, ph.attribution AS anh_nguon
            FROM poi t
            LEFT JOIN place_photos ph
                   ON ph.place_type = 'poi' AND ph.place_id = t.id
            WHERE t.id = %s
        """
    elif place_type == "accommodation":
        sql = """
            SELECT a.id, a.name, a.tourism AS category, 'accommodation' AS type,
                   NULL AS description, a.province_id,
                   ST_X(a.geom) AS lon, ST_Y(a.geom) AS lat,
                   a.address AS dia_chi, a.stars, a.price_range,
                   a.tags->>'addr:city' AS thanh_pho,
                   a.tags->>'phone'     AS dien_thoai,
                   a.tags->>'website'   AS website,
                   a.tags->>'brand'     AS thuong_hieu,
                   ph.url AS anh, ph.attribution AS anh_nguon
            FROM accommodation a
            LEFT JOIN place_photos ph
                   ON ph.place_type = 'accommodation' AND ph.place_id = a.id
            WHERE a.id = %s
        """
    else:
        return None
    rows = execute_query(sql, (place_id,))
    return rows[0] if rows else None


def nearby(lon: float, lat: float, exclude_id: int, meters: int = 2000, limit: int = 6):
    """Địa điểm gần đó — Baymard: người dùng muốn biết quanh đó còn gì."""
    return execute_query(
        """
        SELECT t.id, t.name, t.amenity AS category, 'poi' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               round(ST_Distance(t.geom::geography,
                     ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)) AS met,
               ph.url AS anh
        FROM poi t
        LEFT JOIN place_photos ph ON ph.place_type = 'poi' AND ph.place_id = t.id
        WHERE t.id <> %s
          AND ST_DWithin(t.geom::geography,
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
          AND t.name !~ '^(POI|Accommodation|Road) [0-9]+$'
        -- Sắp theo CÙNG thước đo với cột `met`: toán tử <-> đo khoảng cách phẳng
        -- theo độ, còn met đo mét trên mặt cầu, nên trộn hai cái cho ra thứ tự
        -- lệch (từng trả 9, 12, 14, 15, 17, 16 m).
        ORDER BY ST_Distance(t.geom::geography,
                             ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
        LIMIT %s
        """,
        (lon, lat, exclude_id, lon, lat, meters, lon, lat, limit),
    ) or []
