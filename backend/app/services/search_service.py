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
DEFAULT_RADIUS_M = 3000
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

    Trả về (loại, tên, geom_wkb) hoặc None. Đây là chỗ thay cho việc bắt LLM
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
            SELECT 'boundary' AS kind, b.name, b.geom, g.t,
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
            SELECT 'poi', p.name, p.geom, g.t,
                   ST_Distance(p.geom::geography,
                               ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
            FROM poi p JOIN g ON norm_txt(p.name) = g.t
        )
        SELECT kind, name, ST_AsText(geom) AS wkt, t
        FROM hits
        ORDER BY length(t) DESC, d ASC
        LIMIT 1
        """,
        (grams, lon, lat, lon, lat),
    )
    if not rows:
        return None
    r = rows[0]
    logger.info("Mốc vị trí: %s %r (khớp cụm %r)", r["kind"], r["name"], r["t"])
    return r


def _tim(kw, anchor, lon, lat, limit):
    """Chạy một lượt tìm với từ khoá cho trước."""
    """Câu hỏi tiếng Việt -> danh sách địa điểm, xếp theo độ khớp và khoảng cách."""
    # Mốc có thì đo từ mốc, không thì đo từ vị trí người dùng.
    if anchor:
        ref_sql = "ST_GeomFromText(%s, 4326)"
        ref_param = anchor["wkt"]
    else:
        ref_sql = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
        ref_param = None

    center = "ST_Centroid(%s)" % ref_sql
    params = ([ref_param] if ref_param else [lon, lat])

    rows = execute_query(
        f"""
        WITH ref AS (SELECT {center} AS g),
        cand AS (
            SELECT p.name, p.amenity AS category, p.geom,
                   similarity(norm_txt(p.name), norm_txt(%s))            AS s_name,
                   similarity(norm_txt(coalesce(p.amenity,'')), norm_txt(%s)) AS s_cat
            FROM poi p, ref
            WHERE (norm_txt(p.name) %% norm_txt(%s)
                   OR norm_txt(coalesce(p.amenity,'')) %% norm_txt(%s))
              AND ST_DWithin(p.geom::geography, ref.g::geography, %s)
            UNION ALL
            SELECT a.name, a.tourism, a.geom,
                   similarity(norm_txt(a.name), norm_txt(%s)),
                   similarity(norm_txt(coalesce(a.tourism,'')), norm_txt(%s))
            FROM accommodation a, ref
            WHERE (norm_txt(a.name) %% norm_txt(%s)
                   OR norm_txt(coalesce(a.tourism,'')) %% norm_txt(%s))
              AND ST_DWithin(a.geom::geography, ref.g::geography, %s)
        )
        SELECT name, category,
               ST_X(geom) AS lon, ST_Y(geom) AS lat,
               -- Frontend vẽ marker từ item.geom dạng GeoJSON (xem
               -- renderQueryResultsOnMap trong frontend/js/chat.js); chỉ trả
               -- lon/lat rời thì nó bỏ qua và bản đồ trống trơn.
               ST_AsGeoJSON(geom)::json AS geom,
               round(ST_Distance(geom::geography, (SELECT g FROM ref)::geography)) AS met
        FROM cand
        -- Sắp THUẦN theo khoảng cách.
        --
        -- Không đưa độ khớp vào thứ tự: mệnh đề WHERE đã lọc bằng ngưỡng
        -- similarity rồi, nên mọi dòng còn lại đều khớp đủ tốt — xếp thêm theo
        -- độ khớp chỉ đẩy quán xa lên trước quán gần. Hỏi "quán cà phê gần đây"
        -- từng trả về thứ tự 2157m, 2312m, 1761m, 825m vì lý do đó.
        --
        -- Cũng không có "điểm đánh giá" trong công thức: cột rating toàn giá trị
        -- mặc định 4.0 (xem README §4).
        ORDER BY ST_Distance(geom::geography, (SELECT g FROM ref)::geography) ASC
        LIMIT %s
        """,
        tuple(params) + (kw, kw, kw, kw, DEFAULT_RADIUS_M,
                         kw, kw, kw, kw, DEFAULT_RADIUS_M, limit),
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
        "anchor": {"kind": anchor["kind"], "name": anchor["name"]} if anchor else None,
        "keywords": kw,
    }
