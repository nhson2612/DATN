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
               ph.url                 AS anh,
               ph.details             AS cached_details
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
               ph.url             AS anh,
               ph.details         AS cached_details
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
    if has_photo:
        dieu_kien.append("ph.url IS NOT NULL")

    select_sim = ""
    order_sim = ""
    query_params = []

    if q:
        import unicodedata
        q_norm = str(q).lower().replace("đ", "d")
        q_norm = unicodedata.normalize("NFD", q_norm)
        q_norm = "".join(c for c in q_norm if unicodedata.category(c) != "Mn")
        words = [w for w in q_norm.split() if len(w) >= 1]
        bigrams = [" ".join(words[i:i+2]) for i in range(len(words)-1)]

        word_regexes = [rf"\m{w}\M" for w in words]
        bigram_regexes = [rf"\m{b}\M" for b in bigrams]

        cond_parts = []
        if word_regexes:
            cond_parts.append("(" + " AND ".join(["norm_txt(t.name) ~ %s" for _ in word_regexes]) + ")")
            params.extend(word_regexes)

        for b in bigram_regexes:
            cond_parts.append("norm_txt(t.name) ~ %s")
            params.append(b)

        dieu_kien.append("(" + " OR ".join(cond_parts) + ")")

        full_phrase_regex = rf"\m{' '.join(words)}\M"
        bigram_union_regex = "|".join(bigram_regexes) if bigram_regexes else r"\mnot_found\M"

        select_sim = f""",
            (
                (CASE WHEN norm_txt(t.name) = %s THEN 5000 ELSE 0 END) +
                (CASE WHEN norm_txt(t.name) LIKE '%%' || %s || '%%' THEN 3000 ELSE 0 END) +
                (CASE WHEN norm_txt(t.name) ~ (%s) THEN 2000 ELSE 0 END) +
                (CASE WHEN t.tags->>'category_root' = 'cultural_and_historic' OR t.{cot_loai} IN ('landmark_and_historical_building', 'museum') THEN 500 ELSE 0 END) +
                (CASE WHEN t.tags->>'social' IS NOT NULL THEN 100 ELSE 0 END)
            ) AS score
        """
        order_sim = "score DESC,"
        query_params.extend([q_norm, q_norm, bigram_union_regex])

    where = " AND ".join(dieu_kien)
    offset = (max(page, 1) - 1) * page_size

    query_params.extend(params)
    query_params.extend([page_size, offset])

    rows = execute_query(
        f"""
        SELECT t.id, t.name, t.{cot_loai} AS category, '{bang}' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               t.tags->>'addr:street' AS dia_chi,
               t.tags->>'phone'       AS dien_thoai,
               t.tags->>'website'     AS website,
               t.tags->>'social'      AS social,
               ph.url                 AS anh,
               ph.details             AS cached_details,
               count(*) OVER ()       AS tong
               {select_sim}
        FROM {bang} t
        LEFT JOIN place_photos ph ON ph.place_type = '{bang}' AND ph.place_id = t.id
        WHERE {where}
        ORDER BY {order_sim}
                 (t.{cot_loai} = 'landmark_and_historical_building'),
                 (ph.url IS NULL),
                 (t.name !~ '^[A-Za-zÀ-ỹ0-9]'),
                 t.name
        LIMIT %s OFFSET %s
        """,
        tuple(query_params),
    ) or []

    tong = rows[0]["tong"] if rows else 0
    for r in rows:
        r.pop("tong", None)
        r.pop("score", None)
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
                   t.tags->>'social'         AS social,
                   t.tags->>'brand'          AS thuong_hieu,
                   t.tags->>'category_root'  AS nhom,
                   t.tags                    AS tags,
                   ph.url AS anh, ph.attribution AS anh_nguon,
                   ph.details AS cached_details
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
                   ph.url AS anh, ph.attribution AS anh_nguon,
                   ph.details AS cached_details
            FROM accommodation a
            LEFT JOIN place_photos ph
                   ON ph.place_type = 'accommodation' AND ph.place_id = a.id
            WHERE a.id = %s
        """
    else:
        return None
    rows = execute_query(sql, (place_id,))
    return rows[0] if rows else None


def nearby_of_type(bang: str, lon: float, lat: float,
                   meters: int = 3000, limit: int = 12):
    """Địa điểm cùng loại nằm gần một toạ độ, sắp theo khoảng cách.

    `nearby()` chỉ tra bảng poi. Hàm này nhận tên bảng để còn tìm chỗ ngủ quanh
    các điểm đã xếp trong ngày — bảng accommodation không có cột amenity dùng
    làm category nên phải tách câu.
    """
    if bang not in ("poi", "accommodation"):
        raise ValueError("bang phải là poi hoặc accommodation")
    cot_loai = "COALESCE(t.amenity, t.tourism)" if bang == "poi" else "COALESCE(t.tourism, t.amenity)"
    return execute_query(
        f"""
        SELECT t.id, t.name, {cot_loai} AS category, '{bang}' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               NULLIF(t.tags->>'addr:street', '') AS dia_chi,
               NULLIF(t.tags->>'addr:city', '')   AS thanh_pho,
               round(ST_Distance(t.geom::geography,
                     ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)) AS met
        FROM {bang} t
        WHERE ST_DWithin(t.geom::geography,
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
          AND t.name !~ '^(POI|Accommodation|Road) [0-9]+$'
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
        """,
        (lon, lat, lon, lat, meters, lon, lat, limit),
    ) or []


def nearby(lon: float, lat: float, exclude_id: int, meters: int = 2000, limit: int = 6):
    """Địa điểm gần đó."""
    return execute_query(
        """
        SELECT t.id, t.name, t.amenity AS category, 'poi' AS type,
               ST_X(t.geom) AS lon, ST_Y(t.geom) AS lat,
               round(ST_Distance(t.geom::geography,
                     ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)) AS met,
               ph.url AS anh,
               ph.details AS cached_details
        FROM poi t
        LEFT JOIN place_photos ph ON ph.place_type = 'poi' AND ph.place_id = t.id
        WHERE t.id <> %s
          AND ST_DWithin(t.geom::geography,
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
          AND t.name !~ '^(POI|Accommodation|Road) [0-9]+$'
        ORDER BY ST_Distance(t.geom::geography,
                             ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
        LIMIT %s
        """,
        (lon, lat, exclude_id, lon, lat, meters, lon, lat, limit),
    ) or []


def get_cached_details(place_type: str, place_id: int) -> dict | None:
    """Đọc lại JSONB `details` đã lưu (ảnh Wikimedia)."""
    rows = execute_query(
        "SELECT details FROM place_photos WHERE place_type = %s AND place_id = %s",
        (place_type, place_id),
    )
    return rows[0]["details"] if rows and rows[0].get("details") else None


def save_place_photo_details(place_type: str, place_id: int, url: str = None, attribution: str = "Google Maps", details: dict = None):
    """Lưu/cập nhật cache ảnh và thông tin chi tiết địa điểm vào DB."""
    import json
    details_json = json.dumps(details) if details else None
    url_val = url or ""

    execute_query(
        """
        INSERT INTO place_photos (place_type, place_id, url, attribution, details)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (place_type, place_id)
        DO UPDATE SET
            url = CASE WHEN EXCLUDED.url <> '' THEN EXCLUDED.url ELSE place_photos.url END,
            attribution = EXCLUDED.attribution,
            details = COALESCE(EXCLUDED.details, place_photos.details),
            fetched_at = CURRENT_TIMESTAMP
        """,
        (place_type, place_id, url_val, attribution, details_json),
    )

