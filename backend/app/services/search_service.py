"""Tìm địa điểm từ câu hỏi tiếng Việt — KHÔNG qua LLM sinh truy vấn.

Vì sao không dùng IR (app/research/ir_agent.py): ở đó LLM phải quyết định bảng
nào, cột nào, giá trị enum nào, toán tử không gian nào — tất cả TRƯỚC khi nhìn
thấy dữ liệu. Nó đoán trong bóng tối, và mọi thứ nằm ngoài danh sách viết sẵn
trong prompt đều hỏng:

    "quán karaoke"      -> bịa amenity="karaoke" hoặc ép về "bar"  -> 0 dòng
    "khách sạn gần biển"-> bịa tourism="beach" (không tồn tại)     -> 0 dòng
    "quán bún đậu"      -> ép về amenity="restaurant"              -> 20 quán bất kỳ

Mỗi lần thiếu một trường hợp lại phải thêm một op vào IR và một dòng vào prompt.
Cụm tiếng Việt là vô hạn nên không danh sách nào phủ hết.

Ở đây đảo lại: CHẠM DỮ LIỆU TRƯỚC, đừng dịch trước. Cả câu hỏi được dùng làm
tham số tìm kiếm trên dữ liệu có thật, nên không có bước nào để bịa. LLM chỉ còn
việc diễn giải kết quả thành câu trả lời.
"""

import re

from app.core.database import execute_query
from app.core.logging import get_logger

logger = get_logger(__name__)

# Giới từ chỉ nơi chốn. Đây là chỗ tách "cần tìm gì" khỏi "ở đâu":
#     "quán bún đậu | gần | 102 Trần Phú"
#     "khách sạn    | gần | biển Mỹ Khê"
# Vế TRƯỚC giới từ là thứ cần tìm, vế SAU là mốc vị trí. Dùng cấu trúc câu chứ
# không dùng danh sách nội dung: giới từ tiếng Việt là tập hữu hạn và cố định,
# còn loại địa điểm thì vô hạn — đó là lý do mọi bảng liệt kê đều thiếu.
# Không tách như vậy thì "quán bún đậu" (thứ cần tìm) bị nhận nhầm thành mốc,
# vì trong DB có POI tên đúng bằng "Quán Bún Đậu".
PLACE_PREPS = ("gan nhat", "gan day", "gan", "quanh", "canh", "ben canh",
               "tai", "o ", "khu vuc", "trong ban kinh", "cach")

# Hư từ — bỏ khỏi từ khoá tìm kiếm.
# KHÔNG đưa "cho" vào đây dù nó là hư từ ("cho tôi hỏi"): bỏ dấu thì "chợ" cũng
# thành "cho", nên lọc nó đi là mất hẳn một loại địa điểm du lịch. Để "cho" thừa
# lại chỉ gây nhiễu nhẹ cho khớp mờ, còn "chợ gần đây" mà trả rỗng thì hỏng hẳn.
STOPWORDS = {
    "o", "tai", "gan", "quanh", "khu vuc", "day", "nhat",
    "toi", "minh", "co", "nao", "la", "gi", "the", "va", "hoac",
    "cua", "voi", "tu", "den", "di", "xem", "tim", "kiem", "hoi",
    "muon", "can", "hay", "khong", "duoc", "mot", "nhung", "cac", "nay",
}

MAX_NGRAM = 5          # "bãi biển Non Nước Đà Nẵng" = 5 từ
MIN_ANCHOR_LEN = 5     # tên ngắn hơn dễ khớp bừa ("An", "Hòa")

# Bán kính khi KHÔNG có mốc (tìm quanh vị trí người dùng). Chỉ dùng cho đúng
# trường hợp đó — mốc là vùng thì tìm trong vùng, mốc là điểm thì bán kính suy
# từ cỡ của chính mốc (xem ban_kinh_quanh_diem).
RADIUS_QUANH_TOI_M = 3000
DEFAULT_RADIUS_M = RADIUS_QUANH_TOI_M   # tên cũ, giữ cho mã đang import
DEFAULT_LIMIT = 20
# Số lượt thử rút gọn từ khoá và ngưỡng "đã đủ kết quả" — mỗi lượt là một
# truy vấn nên không thử hết mọi cụm con.
MAX_RETRY_GRAM = 6
DU_KET_QUA = 5


def _norm(text: str) -> str:
    """Bỏ dấu, hạ chữ thường — khớp được cả khi người dùng gõ không dấu."""
    import unicodedata
    text = str(text).lower().replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def split_question(question: str):
    """Tách câu hỏi tại giới từ nơi chốn -> (cần tìm gì, mốc ở đâu).

    "quán bún đậu gần 102 Trần Phú" -> ("quan bun dau", "102 tran phu")
    "quán karaoke gần đây"          -> ("quan karaoke", "day")
    "chùa ở Đà Nẵng"                -> ("chua", "da nang")
    "quán cà phê"                   -> ("quan ca phe", "")
    """
    q = _norm(question)
    for prep in PLACE_PREPS:
        i = q.find(" " + prep)
        if i > 0:
            return q[:i].strip(), q[i + len(prep) + 1:].strip()
    return q, ""


def _ngrams(text: str):
    """Mọi cụm 1..MAX_NGRAM từ liên tiếp, dài trước ngắn sau.

    Dài trước để "biển Mỹ Khê" thắng "Mỹ Khê" — cụm dài xác định chính xác hơn.
    """
    words = text.split()
    out = []
    for size in range(min(MAX_NGRAM, len(words)), 0, -1):
        for i in range(len(words) - size + 1):
            g = " ".join(words[i:i + size])
            if len(g) >= MIN_ANCHOR_LEN and g not in STOPWORDS:
                out.append(g)
    return out


def find_anchor(place_part: str, lon: float, lat: float):
    """Cụm nào trong câu hỏi là TÊN một địa điểm/địa giới có thật trong DB?

    Trả về dict {kind, id, name, la_vung, lon, lat} hoặc None. Đây là chỗ thay
    cho việc bắt LLM
    đoán trước "Mỹ Khê" là phường hay là bãi biển: cứ tra DB, cái nào có thì
    dùng cái đó. Trùng tên ở nhiều tỉnh thì lấy cái gần người dùng nhất.
    """
    grams = _ngrams(place_part)
    if not grams:
        return None

    rows = execute_query(
        """
        WITH g(t) AS (SELECT unnest(%s::text[])),
        hits AS (
            SELECT 'boundary' AS kind, b.id, b.name, b.geom, g.t,
                   ST_Distance(ST_Centroid(b.geom)::geography,
                               ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS d
            -- Khớp cả khi người dùng gõ TẮT tên địa giới: CSDL lưu "Phường Sơn
            -- Trà" còn người ta gõ "Sơn Trà". Khớp chính xác thì mọi địa danh
            -- gõ tắt đều trượt — "quán cà phê ở Sơn Trà" từng rơi về tìm quanh
            -- vị trí người dùng, cách đó hàng trăm km.
            FROM boundaries b JOIN g
              ON norm_txt(b.name) = g.t
              OR regexp_replace(norm_txt(b.name),
                     '^(phuong|xa|quan|huyen|thi xa|thi tran|thanh pho|tinh) ',
                     '') = g.t
            UNION ALL
            SELECT 'poi', p.id, p.name, p.geom, g.t,
                   ST_Distance(p.geom::geography,
                               ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
            FROM poi p JOIN g ON norm_txt(p.name) = g.t
        )
        -- Trả `id` chứ không trả WKT: đa giác tỉnh dài 91.636 ký tự, mà mỗi
        -- câu hỏi gọi _tim tới 7 lượt (có vòng rút gọn từ khoá) nên sẽ phải
        -- đẩy hơn 600 KB toạ độ qua kết nối cho một câu hỏi.
        --
        -- Toạ độ tâm để bản đồ chấm được mốc: người dùng phải NHÌN THẤY hệ
        -- thống hiểu "gần Mỹ Khê" là gần chỗ nào, mới biết ngay khi nó hiểu sai.
        SELECT kind, id, name, t,
               ST_GeometryType(geom) <> 'ST_Point' AS la_vung,
               ST_X(ST_Centroid(geom)) AS lon, ST_Y(ST_Centroid(geom)) AS lat
        FROM hits
        ORDER BY length(t) DESC, d ASC
        LIMIT 1
        """,
        (grams, lon, lat, lon, lat),
    )
    if not rows:
        return None
    r = rows[0]
    logger.info("Mốc vị trí: %s %r %s (khớp cụm %r)", r["kind"], r["name"],
                "[vùng]" if r["la_vung"] else "[điểm]", r["t"])
    return r


def ban_kinh_quanh_diem(moc):
    """Bán kính hợp lý quanh MỘT MỐC, suy từ cỡ của chính mốc.

    Không có mốc thì tìm quanh người dùng — 3km là tầm đi lại trong thành phố.
    Có mốc là điểm (bãi biển, chợ, một quán) thì cũng 3km.
    "Gần <một vùng>" thì bán kính phải theo cỡ vùng: gần Hà Nội khác gần một
    phường. Lấy cạnh hình vuông cùng diện tích chia đôi.
    """
    if not moc or not moc.get("la_vung"):
        return RADIUS_QUANH_TOI_M
    rows = execute_query(
        f"""SELECT sqrt(ST_Area(geom::geography)) / 2 AS r
            FROM {'boundaries' if moc['kind'] == 'boundary' else 'poi'}
            WHERE id = %s""",
        (moc["id"],),
    )
    return float(rows[0]["r"]) if rows and rows[0]["r"] else RADIUS_QUANH_TOI_M


def anchor_candidates(place_part: str, lon: float, lat: float, limit: int = 6):
    """Mọi địa danh CÓ THẬT khớp tên, gần người dùng trước.

    Agent nhiều bước cần cả danh sách để chọn hoặc hỏi lại người dùng, chứ không
    chỉ cái đầu tiên như find_anchor. Đây là chỗ chặn LLM bịa địa danh: nó chỉ
    được chọn trong những dòng thật sự có trong CSDL.
    """
    grams = _ngrams(_norm(place_part)) or ([_norm(place_part)] if place_part else [])
    if not grams:
        return []
    return execute_query(
        """
        WITH g(t) AS (SELECT unnest(%s::text[])),
        hits AS (
            SELECT 'boundary' AS kind, b.id, b.name, b.geom, g.t,
                   ST_Distance(ST_Centroid(b.geom)::geography,
                               ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS d
            FROM boundaries b JOIN g
              ON norm_txt(b.name) = g.t
              OR regexp_replace(norm_txt(b.name),
                     '^(phuong|xa|quan|huyen|thi xa|thi tran|thanh pho|tinh) ',
                     '') = g.t
            UNION ALL
            SELECT 'poi', p.id, p.name, p.geom, g.t,
                   ST_Distance(p.geom::geography,
                               ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
            FROM poi p JOIN g ON norm_txt(p.name) = g.t
        )
        SELECT DISTINCT ON (name) kind, id, name, t, d,
               ST_GeometryType(geom) <> 'ST_Point' AS la_vung,
               ST_X(ST_Centroid(geom)) AS lon, ST_Y(ST_Centroid(geom)) AS lat
        FROM hits
        ORDER BY name, length(t) DESC, d ASC
        """,
        (grams, lon, lat, lon, lat),
    ) or []


def tim_theo_pham_vi(kw, moc, lon, lat, limit, *, trong_vung, ban_kinh):
    """Tìm với phạm vi do người gọi quyết — dùng bởi agent nhiều bước.

    Tách khỏi _tim để agent điều khiển được phạm vi qua từng vòng, thay vì phạm
    vi bị chôn trong hằng số.
    """
    return _chay_tim(_norm(kw), moc, lon, lat, limit,
                     trong_vung=trong_vung, ban_kinh=ban_kinh)


def _tim(kw, anchor, lon, lat, limit):
    """Một lượt tìm của đường TẤT ĐỊNH (không LLM).

    Phạm vi suy thẳng từ hình dạng mốc: mốc là vùng thì tìm trong ranh giới, mốc
    là điểm thì bán kính quanh nó. Bản cũ ép mọi trường hợp về "3km quanh TÂM
    mốc" — tỉnh Hà Tĩnh cạnh 77km, tâm rơi vào vùng núi, nên trong tỉnh có 101
    quán cà phê mà truy vấn trả 0.
    """
    trong_vung = bool(anchor and anchor["la_vung"])
    return _chay_tim(kw, anchor, lon, lat, limit,
                     trong_vung=trong_vung,
                     ban_kinh=None if trong_vung else ban_kinh_quanh_diem(anchor))


def _chay_tim(kw, moc, lon, lat, limit, *, trong_vung, ban_kinh):
    """Truy vấn thật. Phạm vi do người gọi quyết, hàm này không tự đặt hằng số."""
    if moc:
        # Tham chiếu mốc bằng id, không đẩy WKT qua kết nối: đa giác một tỉnh dài
        # 91.636 ký tự và một câu hỏi có thể chạy hàm này nhiều lượt.
        bang = "boundaries" if moc["kind"] == "boundary" else "poi"
        moc_sql = f"(SELECT geom FROM {bang} WHERE id = %s)"
        moc_params = (moc["id"],)
    else:
        moc_sql = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
        moc_params = (lon, lat)

    def dieu_kien(bi_danh):
        if trong_vung:
            return f"ST_Intersects({bi_danh}.geom, ref.g)", ()
        return (f"ST_DWithin({bi_danh}.geom::geography, ref.g::geography, %s)",
                (float(ban_kinh or RADIUS_QUANH_TOI_M),))

    loc_poi, p_poi = dieu_kien("p")
    loc_acc, p_acc = dieu_kien("a")

    rows = execute_query(
        f"""
        -- `g` là hình dạng thật của mốc, dùng để LỌC.
        -- `tam` chỉ dùng đo khoảng cách hiển thị và xếp thứ tự.
        WITH ref AS (SELECT {moc_sql} AS g),
        cand AS (
            SELECT p.id, 'poi' AS type, p.name, p.amenity AS category, p.geom
            FROM poi p, ref
            WHERE (norm_txt(p.name) %% norm_txt(%s)
                   OR norm_txt(coalesce(p.amenity,'')) %% norm_txt(%s))
              AND {loc_poi}
            UNION ALL
            SELECT a.id, 'accommodation', a.name, a.tourism, a.geom
            FROM accommodation a, ref
            WHERE (norm_txt(a.name) %% norm_txt(%s)
                   OR norm_txt(coalesce(a.tourism,'')) %% norm_txt(%s))
              AND {loc_acc}
        ),
        tam AS (SELECT ST_Centroid(g) AS p FROM ref)
        -- id + type để frontend mở được trang chi tiết; thiếu hai cột này thì kết
        -- quả hỏi đáp chỉ là chấm trên bản đồ, bấm vào không đi đâu được.
        SELECT id, type, name, category,
               ST_X(geom) AS lon, ST_Y(geom) AS lat,
               -- geom GeoJSON cho thứ không phải Point (ranh giới, toà nhà).
               ST_AsGeoJSON(geom)::json AS geom,
               round(ST_Distance(geom::geography,
                                 (SELECT p FROM tam)::geography)) AS met
        FROM cand
        -- Sắp THUẦN theo khoảng cách tới tâm mốc.
        --
        -- Không đưa độ khớp vào thứ tự: mệnh đề WHERE đã lọc bằng ngưỡng
        -- similarity rồi, nên mọi dòng còn lại đều khớp đủ tốt — xếp thêm theo độ
        -- khớp chỉ đẩy quán xa lên trước quán gần. Hỏi "quán cà phê gần đây" từng
        -- trả về thứ tự 2157m, 2312m, 1761m, 825m vì lý do đó.
        --
        -- Cũng không có "điểm đánh giá": cột rating toàn 4.0 (xem README §4).
        ORDER BY ST_Distance(geom::geography, (SELECT p FROM tam)::geography) ASC
        LIMIT %s
        """,
        moc_params + (kw, kw) + p_poi + (kw, kw) + p_acc + (limit,),
    )
    return rows or []


def search(question: str, lon: float, lat: float, limit: int = DEFAULT_LIMIT):
    """Câu hỏi tiếng Việt -> danh sách địa điểm, xếp theo khoảng cách."""
    what, where = split_question(question)
    # Chỉ dò mốc trong VẾ SAU giới từ. Dò cả câu thì "quán bún đậu" bị nhận là
    # mốc (CSDL có POI tên đúng vậy) và từ khoá tìm kiếm mất sạch.
    anchor = find_anchor(where, lon, lat) if where else None
    kw = " ".join(w for w in what.split() if w not in STOPWORDS and len(w) >= 2)
    logger.info("Cần tìm: %r | Ở đâu: %r -> mốc %s",
                kw, where, anchor["name"] if anchor else None)

    if not kw:
        return {"results": [], "anchor": None, "keywords": "",
                "error": "Không xác định được cần tìm loại địa điểm nào."}

    rows = _tim(kw, anchor, lon, lat, limit)

    # Câu hỏi hay kèm từ mô tả không phải loại địa điểm — "view đẹp", "ngon",
    # "giá rẻ", "sang trọng". Khớp mờ cả cụm "quan ca phe view dep" với tên quán
    # cho điểm rất thấp nên gần như không ra gì. Rút ngắn dần từ khoá cho tới khi
    # có kết quả, thay vì liệt kê sẵn các từ mô tả — danh sách đó là vô hạn.
    if len(rows) < 3 and len(kw.split()) > 1:
        for gram in _ngrams(kw)[:MAX_RETRY_GRAM]:
            if gram == kw:
                continue
            thu = _tim(gram, anchor, lon, lat, limit)
            if len(thu) > len(rows):
                logger.info("Rút gọn từ khoá %r -> %r (%d kết quả)",
                            kw, gram, len(thu))
                rows, kw = thu, gram
            if len(rows) >= DU_KET_QUA:
                break

    return {
        "results": rows,
        "anchor": ({"kind": anchor["kind"], "name": anchor["name"],
                    "lon": anchor["lon"], "lat": anchor["lat"]}
                   if anchor else None),
        "keywords": kw,
    }
