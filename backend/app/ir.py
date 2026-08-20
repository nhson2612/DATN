"""
Biểu diễn trung gian (IR) cho truy vấn không gian, và trình biên dịch IR -> PostGIS.

LLM chỉ sinh ra JSON theo đặc tả dưới đây; toàn bộ SQL do module này sinh.
Nhờ vậy:
  - LLM không cần biết cú pháp PostGIS (không bịa tên hàm)
  - ::geography luôn được sinh đúng -> không còn lỗi nhầm độ/mét
  - Bảng, cột nằm ngoài danh sách trắng bị chặn ngay
  - Mọi giá trị đều tham số hoá -> không thể SQL injection
  - LIMIT luôn có mặt

ĐẶC TẢ IR
{
  "target":   "poi" | "accommodation",
  "select":   ["name", "rating", ...],
  "aggregate": "count",                       // tuỳ chọn; có thì bỏ qua "select"
  "where": [                                  // MỘT mảng phẳng cho mọi điều kiện
      {"op": "eq"|"neq"|"gt"|"gte"|"lt"|"lte", "col": <cột>, "value": <giá trị>},
      {"op": "in",        "col": <cột>, "value": [<giá trị>, ...]},
      {"op": "name_like", "value": "<chuỗi con của tên>"},
      {"op": "in_admin",  "name": "<tên quận/phường>"},
      {"op": "within_distance", "meters": <số>,
                                "ref": {"table": "poi"|"accommodation", "name": "<tên>"}},
      {"op": "near_point", "lon": <số>, "lat": <số>, "meters": <số>}
  ],                                          // "filters"/"spatial" vẫn được chấp nhận
  "nearest_to": {"lon": <số>, "lat": <số>},   // tuỳ chọn; sắp theo khoảng cách tăng dần
  "order_by":   {"col": <cột>, "dir": "asc"|"desc"},
  "limit":      <số, tối đa 100>
}
"""

MAX_LIMIT = 100
DEFAULT_LIMIT = 20

# Danh sách trắng. Cột nằm ngoài đây bị từ chối, kể cả khi LLM bịa ra.
TABLES = {
    "poi": {
        "name", "amenity", "tourism", "description",
        "rating", "review_count", "price_level", "climate_label",
    },
    "accommodation": {
        "name", "amenity", "tourism", "address", "price_range",
        "stars", "rating", "review_count", "price_level",
    },
}

COMPARISONS = {"eq": "=", "neq": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<="}
SPATIAL_OPS = {"in_admin", "within_distance", "near_point"}
ALL_OPS = sorted(set(COMPARISONS) | {"in", "name_like"} | SPATIAL_OPS)

# Ranh giới lấy từ OSM bị tự cắt (84/94 bản ghi) nên bắt buộc phải làm sạch
# trước khi dùng ST_Contains, nếu không kết quả không xác định.
VALID_BOUNDARY = "ST_CollectionExtract(ST_MakeValid(geom), 3)"

# Khớp tên không phân biệt dấu: unaccent() cho phép người dùng gõ "hai chau".
NAME_MATCH = "unaccent(lower({col})) LIKE unaccent(lower(%s))"


class IRError(ValueError):
    """IR không hợp lệ. Thông điệp được trả ngược cho LLM để nó tự sửa."""


def _check_column(table, col):
    if col not in TABLES[table]:
        raise IRError(
            f"Cột '{col}' không tồn tại trong bảng '{table}'. "
            f"Các cột hợp lệ: {sorted(TABLES[table])}"
        )
    return col


def _number(value, field):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise IRError(f"Trường '{field}' phải là số, nhận được {value!r}")


def _compile_condition(table, f, where, params):
    """Biên dịch một điều kiện, thuộc tính hay không gian đều được.

    Cố tình gộp hai loại vào chung một mảng: thử nghiệm cho thấy model nhỏ
    thường xuyên đặt nhầm toán tử không gian vào mảng thuộc tính khi IR có
    hai mảng song song. Cấu trúc phẳng loại bỏ hẳn lớp lỗi này.
    """
    op = f.get("op")

    if op in SPATIAL_OPS:
        return _compile_spatial(f, where, params)

    if op == "name_like":
        where.append(NAME_MATCH.format(col="t.name"))
        params.append(f"%{f['value']}%")

    elif op == "in":
        col = _check_column(table, f["col"])
        values = f.get("value")
        if not isinstance(values, list) or not values:
            raise IRError("Toán tử 'in' cần 'value' là danh sách không rỗng")
        where.append(f"t.{col} = ANY(%s)")
        params.append(list(values))

    elif op in COMPARISONS:
        col = _check_column(table, f["col"])
        where.append(f"t.{col} {COMPARISONS[op]} %s")
        params.append(f["value"])

    else:
        raise IRError(
            f"Toán tử '{op}' không tồn tại. Chỉ được dùng: {ALL_OPS}. "
            f"Mọi điều kiện đặt chung trong mảng \"where\"."
        )


def _compile_spatial(s, where, params):
    op = s.get("op")

    if op == "in_admin":
        where.append(
            f"ST_Contains((SELECT {VALID_BOUNDARY} FROM boundaries "
            f"WHERE {NAME_MATCH.format(col='name')} "
            f"ORDER BY ST_Area(geom) DESC LIMIT 1), t.geom)"
        )
        params.append(f"%{s['name']}%")

    elif op == "within_distance":
        ref = s.get("ref") or {}
        ref_table = ref.get("table")
        if ref_table not in TABLES:
            raise IRError(
                f"ref.table '{ref_table}' không hợp lệ. Hợp lệ: {sorted(TABLES)}"
            )
        # ::geography do compiler sinh -> khoảng cách luôn tính bằng mét
        where.append(
            f"ST_DWithin(t.geom::geography, "
            f"(SELECT geom FROM {ref_table} "
            f" WHERE {NAME_MATCH.format(col='name')} "
            f" ORDER BY length(name) LIMIT 1)::geography, %s)"
        )
        params.append(f"%{ref.get('name', '')}%")
        params.append(_number(s.get("meters"), "meters"))

    elif op == "near_point":
        where.append(
            "ST_DWithin(t.geom::geography, "
            "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)"
        )
        params.append(_number(s.get("lon"), "lon"))
        params.append(_number(s.get("lat"), "lat"))
        params.append(_number(s.get("meters"), "meters"))

    else:
        raise IRError(
            f"Toán tử không gian '{op}' không hợp lệ. "
            f"Hợp lệ: in_admin, within_distance, near_point"
        )


def compile_ir(ir):
    """Biên dịch IR thành (sql, params). Ném IRError nếu IR sai."""
    if not isinstance(ir, dict):
        raise IRError("IR phải là một đối tượng JSON")

    table = ir.get("target")
    if table is None or table == "none":
        return "SELECT NULL WHERE FALSE", []
    if table not in TABLES:
        raise IRError(f"target '{table}' không hợp lệ. Hợp lệ: {sorted(TABLES)}")

    # "max"/"avg"... chua ho tro: bao loi ro thay vi lang le bo qua roi tra
    # ve ket qua sai — im lang la kieu that bai nguy hiem nhat.
    agg = ir.get("aggregate")
    if agg not in (None, "count"):
        raise IRError(f"aggregate '{agg}' chua duoc ho tro. Chi co: count")

    where, params = [], []

    # Chap nhan ca "where" (dang phang, khuyen dung) lan "filters"/"spatial"
    # (dang cu) de model dat o dau cung chay dung.
    conditions = []
    for key in ("where", "filters", "spatial"):
        conditions.extend(ir.get(key) or [])
    for cond in conditions:
        _compile_condition(table, cond, where, params)

    # --- SELECT ---
    if ir.get("aggregate") == "count":
        select_sql = "count(*) AS total"
    else:
        # Khoan dung voi select: cot la khong anh huong tinh dung dan cua ket
        # qua loc, nen bo qua thay vi that bai ca cau truy van.
        cols = [c for c in (ir.get("select") or ["name"]) if c in TABLES[table]]
        if "name" not in cols:
            cols.insert(0, "name")
        select_sql = ", ".join(f"t.{c}" for c in cols)
        # geom luôn được bọc ST_AsGeoJSON để frontend vẽ được lên bản đồ
        select_sql += ", ST_AsGeoJSON(t.geom) AS geom"

    sql = f"SELECT {select_sql}\nFROM {table} t"
    if where:
        sql += "\nWHERE " + "\n  AND ".join(where)

    if ir.get("aggregate") == "count":
        return sql, params  # count không cần ORDER BY / LIMIT

    # --- Sắp xếp: ưu tiên "gần nhất" nếu có, dùng toán tử <-> để tận dụng index GIST ---
    near = ir.get("nearest_to")
    if near:
        sql += "\nORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
        params.append(_number(near.get("lon"), "nearest_to.lon"))
        params.append(_number(near.get("lat"), "nearest_to.lat"))
    else:
        ob = ir.get("order_by")
        if ob:
            col = _check_column(table, ob["col"])
            direction = "DESC" if str(ob.get("dir", "desc")).lower() == "desc" else "ASC"
            sql += f"\nORDER BY t.{col} {direction} NULLS LAST"
        else:
            sql += "\nORDER BY t.name ASC"

    # LIMIT luôn có, và bị chặn trần để một câu hỏi không kéo về cả bảng
    try:
        limit = int(ir.get("limit") or DEFAULT_LIMIT)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    sql += "\nLIMIT %s"
    params.append(max(1, min(limit, MAX_LIMIT)))

    return sql, params
