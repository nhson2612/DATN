"""
Tầng LLM: câu hỏi tiếng Việt -> IR (JSON) -> SQL.

Khác với app/agent.py (LLM sinh thẳng SQL), ở đây LLM chỉ điền một cấu trúc
JSON có từ vựng đóng. Việc này dễ hơn nhiều với model nhỏ, và mọi lỗi cú pháp
hay lỗi hệ toạ độ đều bị loại bỏ ở tầng biên dịch.
"""

import json
import unicodedata

from app.db import execute_query
from app.ir import compile_ir, IRError, TABLES
from app.core.config import settings
from app.llm_adapter import query_llm

# Không dùng f-string: prompt chứa đầy JSON mẫu, mọi { } sẽ thành placeholder.
IR_SYSTEM_PROMPT = """Bạn là trợ lý chuyển câu hỏi du lịch __SCOPE__ thành một đối tượng JSON đại diện (IR).
Chỉ trả về JSON, không giải thích, không markdown.

CẤU TRÚC JSON:
{
  "target": "poi" hoặc "accommodation",
  "select": ["name"],                             // KHÔNG dùng khi hỏi đếm số lượng
  "aggregate": "count",                           // CHỈ dùng khi hỏi 'bao nhiêu', 'số lượng', 'đếm'
  "where": [                                      // Chứa tất cả bộ lọc điều kiện.
                                                  // MỖI dòng dưới đây là TUỲ CHỌN — chỉ đưa vào
                                                  // khi câu hỏi thực sự yêu cầu điều đó.
    {"op": "eq",  "col": "<amenity|tourism>", "value": "<giá trị tra từ BẢNG MAPPING>"},
    {"op": "neq", "col": "<cột>", "value": "<giá trị>"},
    {"op": "gte", "col": "<rating|stars>",    "value": <số lấy từ câu hỏi>},
    {"op": "gt",  "col": "<cột số>", "value": <số>},   // > ; còn có "lt" (<), "lte" (<=)
    {"op": "in",  "col": "<cột>", "value": ["<giá trị 1>", "<giá trị 2>"]},
    {"op": "name_like", "value": "<chuỗi con trong TÊN quán/địa điểm>"},
    {"op": "tag", "key": "<khoá OSM>", "value": "<giá trị>"},  // xem BẢNG KHOÁ TAG
    {"op": "in_admin", "name": "<tên phường/quận LẤY NGUYÊN TỪ CÂU HỎI>"},
    {"op": "within_distance", "meters": <số lấy từ câu hỏi>,
                              "ref": {"table": "poi", "name": "<tên địa điểm LẤY NGUYÊN TỪ CÂU HỎI>"}},
    {"op": "near_point", "lon": <kinh độ>, "lat": <vĩ độ>, "meters": <số>}
  ],
  "nearest_to": {"lon": <kinh độ trong câu hỏi>, "lat": <vĩ độ trong câu hỏi>},
  "limit": <số>                                   // BỎ TRƯỜNG NÀY nếu câu hỏi không nêu số lượng
                                                  // cụ thể; chỉ đặt 1 khi hỏi 'gần nhất'.
}

LƯU Ý QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG bịa giá trị. Mọi "name" (trong "in_admin", trong "ref") và mọi số
   ("meters", "lon", "lat", giá trị so sánh) BẮT BUỘC phải xuất hiện ngay trong câu hỏi.
   Các tên và số trong phần CẤU TRÚC và VÍ DỤ chỉ là minh hoạ — KHÔNG được sao chép chúng
   vào câu trả lời. Câu hỏi không nhắc tên địa điểm nào thì KHÔNG được thêm "within_distance".
2. Chọn "target" theo LOẠI địa điểm: chỗ ăn/uống/tham quan (cafe, nhà hàng, bar, chợ, bảo tàng,
   điểm ngắm cảnh) -> "poi". Chỗ NGỦ QUA ĐÊM (khách sạn, nhà nghỉ, hostel, homestay, resort)
   -> "accommodation". Bảng "accommodation" KHÔNG có nhà hàng hay quán cà phê.
3. KHÔNG tự ý thêm trường "nearest_to" nếu câu hỏi không chứa từ "gần nhất" hoặc một cặp tọa độ số thực.
4. Nếu câu hỏi yêu cầu đếm ("Có bao nhiêu..."), bạn BẮT BUỘC phải dùng "aggregate": "count" và BỎ TRƯỜNG "select".
5. Với các câu hỏi lọc địa giới (ví dụ: ở Phường Sơn Trà, ở Sơn Trà, tại Ngũ Hành Sơn), bạn BẮT BUỘC dùng op "in_admin".
6. Chỉ sử dụng các cột thực tế: rating, stars, price_level, amenity, tourism.
   * BẢNG TRÀ CỨU GIÁ TRỊ (MAPPING):
     (nhóm dưới đây LUÔN đi với target: "poi" — cột "amenity" CHỈ tồn tại ở bảng poi)
     - "quán cà phê", "quán cafe", "tiệm cà phê", "cửa hàng cafe" -> target "poi", "amenity": "cafe"
     - "nhà hàng", "quán ăn", "tiệm ăn" -> target "poi", "amenity": "restaurant"
     - "quán bar", "quán rượu", "bar" -> target "poi", "amenity": "bar"
     - "cửa hàng đồ ăn nhanh", "quán ăn nhanh", "tiệm ăn nhanh", "quán fast food" -> target "poi", "amenity": "fast_food"
     - "chợ", "trung tâm thương mại", "khu mua sắm" -> target "poi", "amenity": "marketplace"
     - "bến phà", "bến tàu", "bến tàu thủy" -> target "poi", "amenity": "ferry_terminal"
     - "nhà văn hóa", "trung tâm cộng đồng", "nhà sinh hoạt cộng đồng" -> target "poi", "amenity": "community_centre"
     - "khách sạn", "hotel" -> "tourism": "hotel" (target: "accommodation")
     - "nhà khách", "guest house" -> "tourism": "guest_house" (target: "accommodation")
     - "nhà trọ", "hostel" -> "tourism": "hostel" (target: "accommodation")
     - "nhà nghỉ", "motel" -> "tourism": "motel" (target: "accommodation")
   * BẢNG KHOÁ TAG (dùng với {"op": "tag"}): mọi thuộc tính KHÔNG phải loại địa điểm
     đều nằm trong "tags". BẢNG MAPPING ở trên chỉ có LOẠI địa điểm, nên phần nào của
     câu hỏi không tra được ở đó thì tra ở đây:
     - MÓN ĂN / ĐỒ UỐNG (hải sản, món Hàn, lẩu, pizza...) -> key "cuisine"
     - TÊN ĐƯỜNG / ĐỊA CHỈ ("đường Trần Phú", "102 Lê Lai") -> key "addr:street" (BỎ số nhà)
     - GIỜ MỞ CỬA -> key "opening_hours"; SỐ ĐIỆN THOẠI -> key "phone"
     - THƯƠNG HIỆU ("Highlands", "Circle K") -> key "brand"
7. Với các câu hỏi nằm ngoài phạm vi dữ liệu hoặc không thể trả lời được (ví dụ: thời tiết, giá vé cáp treo, tình trạng đông đúc, thời gian thực), bạn BẮT BUỘC trả về cấu trúc: {"target": null, "reason": "Không có dữ liệu trong DB để trả lời câu hỏi này."}
8. Tuyệt đối KHÔNG tự ý thêm bộ lọc tên (ví dụ: {"op": "eq", "col": "name", "value": "..."}) nếu câu hỏi chỉ hỏi "tên là gì?" mà không chỉ đích danh một địa điểm cụ thể. Chỉ lọc theo tên khi câu hỏi chỉ định một địa danh cụ thể (ví dụ: "chùa Linh Ứng", "Cầu Rồng").

VÍ DỤ
Hỏi: Có bao nhiêu tiệm ăn ở Phường Hải Châu?
{"target": "poi", "aggregate": "count", "where": [{"op": "eq", "col": "amenity", "value": "restaurant"}, {"op": "in_admin", "name": "Phường Hải Châu"}]}

Hỏi: Nơi lưu trú có đánh giá từ 4.0 trở lên nằm gần nhất với tọa độ 108.2206 16.0638 tên là gì?
{"target": "accommodation", "select": ["name"], "where": [{"op": "gte", "col": "rating", "value": 4.0}], "nearest_to": {"lon": 108.2206, "lat": 16.0638}, "limit": 1}

Hỏi: Thời tiết ở Đà Nẵng ngày mai như thế nào?
{"target": null, "reason": "Không có thông tin thời tiết trong cơ sở dữ liệu."}
"""

# Phạm vi lấy từ cấu hình: prompt cũ hardcode "Đà Nẵng" nên khi DATABASE_URL
# trỏ sang gis_vietnam, LLM coi mọi địa danh ngoài Đà Nẵng là ngoài phạm vi
# và trả về {"target": null} thay vì sinh IR.
IR_SYSTEM_PROMPT = IR_SYSTEM_PROMPT.replace("__SCOPE__", settings.db_scope)


def _norm(text):
    """Bo dau, ha chu thuong — de so khop ten trong cau hoi khong phu thuoc dau."""
    text = str(text).lower().replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def prune_ungrounded(ir, question):
    """Bo cac dieu kien co ten rieng khong he xuat hien trong cau hoi.

    Model nho hay tu them "within_distance" tro toi mot dia diem khong nam trong
    cau hoi — copy tu vi du trong prompt, hoac bia han. SQL sinh ra van chay
    nhung tra ve 0 dong, tuc that bai im lang. Nhac trong prompt khong du.

    Chon PRUNE thay vi nem IRError: thu nghiem cho thay qwen2.5:1.5b lap lai
    dung loi do ca 3 luot retry, khien ca cau truy van fail cung — te hon la tra
    ve ket qua rong. Mot dieu kien tro toi dia diem khong co trong cau hoi thi
    chac chan khong thuoc y dinh nguoi dung, nen bo di la dung. Moi lan bo deu
    duoc ghi vao debug, khong bo im lang.

    Quy tac: it nhat mot nua so tu (dai >= 2 ky tu) cua ten phai xuat hien trong
    cau hoi. Nho vay "bai bien My Khe" -> "My Khe Beach" van duoc giu, con
    "hotel" hay "Non Nuoc Beach" trong cau hoi khong nhac gi thi bi bo.

    Tra ve danh sach mo ta cac dieu kien da bo (rong neu khong bo gi).
    """
    # IR sai hinh dang (list/str/int/None) khong xu ly o day: tra ve ngay de
    # compile_ir nem IRError nhu truoc, roi vong lap retry re-prompt model.
    # Neu khong, ir.get() nem AttributeError va thoat ca question_to_sql -> 500.
    if not isinstance(ir, dict):
        return []

    q = _norm(question)

    def grounded(name):
        tokens = [t for t in _norm(name).split() if len(t) >= 2]
        if not tokens:
            return False
        return sum(1 for t in tokens if t in q) * 2 >= len(tokens)

    def ungrounded_reason(cond):
        op = cond.get("op")
        if op == "within_distance":
            name = (cond.get("ref") or {}).get("name", "")
            if not grounded(name):
                return f"bo 'within_distance' -> '{name}' (cau hoi khong nhac den)"
        elif op == "in_admin":
            name = cond.get("name", "")
            if not grounded(name):
                return f"bo 'in_admin' -> '{name}' (cau hoi khong nhac den)"
        return None

    dropped = []
    for key in ("where", "filters", "spatial"):
        conds = ir.get(key)
        if not conds:
            continue
        if not isinstance(conds, list):
            continue
        kept = []
        for cond in conds:
            if not isinstance(cond, dict):
                kept.append(cond)      # de compile_ir bao loi dung cho
                continue
            reason = ungrounded_reason(cond)
            if reason:
                dropped.append(reason)
            else:
                kept.append(cond)
        ir[key] = kept
    return dropped


class AdminAmbiguityError(IRError):
    """Tên địa giới khớp nhiều đơn vị — cần NGƯỜI DÙNG chọn, không phải LLM đoán.

    Tách khỏi IRError thường vì cách xử lý ngược nhau: IRError thì feed lại cho
    LLM tự sửa, còn ở đây LLM không có thêm thông tin nào để sửa — nó chỉ đoán
    lại, hết 3 lượt retry rồi trả kết quả sai một cách im lặng. Thông tin thiếu
    nằm ở phía người dùng, nên phải hỏi họ.
    """

    def __init__(self, message, name, candidates):
        super().__init__(message)
        self.name = name
        self.candidates = candidates


def check_admin_ambiguity(ir):
    """Từ chối khi tên đơn vị hành chính vẫn còn nhập nhằng — đừng đoán.

    compile_ir đã ưu tiên khớp CHÍNH XÁC (xem in_admin trong ir.py), nên phần
    lớn trường hợp đã được xử lý đúng. Nhưng nếu người dùng gõ thiếu ("Hội An"
    thay vì "Phường Hội An") thì không có dòng nào khớp chính xác và cả 3 ứng
    viên đều ngang nhau — compiler vẫn phải chọn một cái, tức lại đoán.

    Ở đây chặn trước khi biên dịch và trả IRError kèm danh sách ứng viên, để
    vòng self-repair đưa thông báo về cho LLM. Thất bại có tiếng thay vì một
    con số trông hợp lý mà sai.

    Hàm này cần truy vấn DB nên KHÔNG nằm trong ir.py — compiler được giữ
    thuần, không phụ thuộc kết nối.
    """
    conditions = []
    for key in ("where", "filters", "spatial"):
        conditions.extend(ir.get(key) or [])

    for cond in conditions:
        if not isinstance(cond, dict) or cond.get("op") != "in_admin":
            continue
        name = cond.get("name") or ""
        if not name:
            continue
        # 94 dòng nên seq scan là miễn phí. Ở quy mô toàn quốc cần index biểu
        # thức trên unaccent(lower(name)).
        rows = execute_query(
            """
            SELECT name,
                   unaccent(lower(name)) = unaccent(lower(%s)) AS exact_hit
            FROM boundaries
            WHERE unaccent(lower(name)) LIKE unaccent(lower(%s))
            ORDER BY length(name)
            """,
            (name, f"%{name}%"),
        ) or []

        exact = [r["name"] for r in rows if r["exact_hit"]]
        if len(exact) > 1:
            raise AdminAmbiguityError(
                f"Có {len(exact)} đơn vị hành chính tên đúng '{name}'. "
                f"Cần nêu rõ quận/huyện hoặc tỉnh.",
                name, exact,
            )
        if exact:
            continue                       # khớp chính xác duy nhất -> ổn
        if len(rows) > 1:
            names = [r["name"] for r in rows]
            ds = ", ".join(f"'{n}'" for n in names[:5])
            raise AdminAmbiguityError(
                f"Tên '{name}' khớp {len(rows)} đơn vị hành chính ({ds}). "
                f"Hãy dùng đúng tên đầy đủ của một trong số đó.",
                name, names,
            )
        # 0 hoặc 1 ứng viên: để compile_ir chạy. Không khớp gì thì trả kết quả
        # rỗng — trung thực hơn là fail cứng, và model nhỏ lặp lại lỗi cả 3 lượt
        # retry nên raise ở đây chỉ đổi "rỗng" thành "vỡ".


def query_ollama_json(prompt, system_prompt):
    """Gọi LLM ở chế độ ép định dạng JSON qua adapter."""
    return query_llm(prompt, system_prompt, json_mode=True, temperature=0,
                     timeout=settings.llm_timeout_sql)


def question_to_sql(question, max_attempts=3):
    """
    Trả về dict:
      {"success": bool, "ir": ..., "sql": ..., "params": ..., "debug": [...]}
    Vòng lặp sửa lỗi ở đây chỉ chạy khi IR sai cấu trúc — SQL sinh ra
    từ IR hợp lệ thì luôn chạy được, nên không cần retry vì lỗi cú pháp.
    """
    debug = []
    llm_calls = 0
    prompt = f"Hỏi: {question}"

    for attempt in range(max_attempts):
        raw = query_ollama_json(prompt, IR_SYSTEM_PROMPT)
        llm_calls += 1
        if not raw:
            debug.append({"attempt": attempt + 1, "error": "LLM không trả về gì"})
            break

        try:
            ir = json.loads(raw)
        except ValueError as e:
            debug.append({"attempt": attempt + 1, "raw": raw, "error": f"JSON hỏng: {e}"})
            prompt = f"Hỏi: {question}\n\nLần trước bạn trả về JSON hỏng. Chỉ trả về JSON hợp lệ."
            continue

        pruned = prune_ungrounded(ir, question)

        try:
            check_admin_ambiguity(ir)
            sql, params = compile_ir(ir)
        except AdminAmbiguityError as e:
            # KHONG retry: LLM khong biet nguoi dung muon don vi nao, retry chi
            # de no doan lai roi tra ket qua sai im lang. Thoat ngay de tang tren
            # hoi nguoi dung.
            debug.append({"attempt": attempt + 1, "ir": ir, "error": str(e),
                          "ambiguous": {"name": e.name, "candidates": e.candidates}})
            return {
                "success": False,
                "needs_clarification": True,
                "question": question,
                "ambiguous_name": e.name,
                "candidates": e.candidates,
                "error": str(e),
                "llm_calls": llm_calls,
                "debug": debug,
            }
        except IRError as e:
            debug.append({"attempt": attempt + 1, "ir": ir, "error": str(e)})
            # Phản hồi lỗi cụ thể cho LLM — đây là điểm khác biệt so với
            # sinh SQL trực tiếp: thông báo lỗi ngắn, rõ, và luôn đúng trọng tâm.
            prompt = (
                f"Hỏi: {question}\n\n"
                f"JSON lần trước bị lỗi: {e}\n"
                f"Hãy sửa lại và chỉ trả về JSON."
            )
            continue

        entry = {"attempt": attempt + 1, "ir": ir, "status": "ok"}
        if pruned:
            entry["pruned"] = pruned
        debug.append(entry)
        return {"success": True, "ir": ir, "sql": sql, "params": params,
                "llm_calls": llm_calls, "debug": debug}

    # Dua ly do CU THE ra ngoai. Truoc day chi tra cau chung chung, nen khi
    # check_admin_ambiguity chan vi "co 13 don vi ten 'Xa Tan Thanh'" thi nguoi
    # dung khong he biet phai neu ro tinh/huyen — thong tin duy nhat giup ho sua
    # cau hoi lai nam trong debug, khong ai thay.
    last_error = ""
    for entry in reversed(debug):
        if entry.get("error"):
            last_error = str(entry["error"])
            break

    message = "Không tạo được truy vấn hợp lệ từ câu hỏi."
    if last_error:
        message = f"{message} {last_error}"

    return {
        "success": False,
        "error": message,
        "llm_calls": llm_calls,
        "debug": debug,
    }


def answer(question):
    """Chạy trọn: câu hỏi -> IR -> SQL -> kết quả."""
    res = question_to_sql(question)
    if not res["success"]:
        return res

    rows = execute_query(res["sql"], res["params"])
    for row in rows or []:
        if isinstance(row.get("geom"), str):
            try:
                row["geom"] = json.loads(row["geom"])
            except ValueError:
                pass

    res["results"] = rows or []
    return res


def query_ollama(prompt, system_prompt=None):
    return query_llm(prompt, system_prompt, timeout=settings.llm_timeout_explain)


def generate_explanation(vietnamese_question, sql, results):
    if not results:
        return "Không tìm thấy dữ liệu nào phù hợp với yêu cầu của bạn."
        
    # Standardize results to a compact JSON string to save LLM context
    # Limit number of records sent to prevent context overflow
    truncated_results = results[:20]
    
    prompt = f"""Dựa vào kết quả truy vấn cơ sở dữ liệu dưới đây, hãy viết một câu trả lời tự nhiên bằng tiếng Việt cho câu hỏi: "{vietnamese_question}"

CÂU LỆNH SQL ĐÃ CHẠY:
{sql}

KẾT QUẢ TRUY VẤN (JSON):
{truncated_results}

Yêu cầu:
- Trả lời ngắn gọn, lịch sự, tập trung vào thông tin người dùng hỏi.
- Nếu là danh sách địa điểm, hãy liệt kê rõ tên và các thông tin liên quan (như số sao, loại hình, địa chỉ) từ kết quả.
- Nếu là đường đi (pgRouting), hãy chỉ dẫn rõ các tên đường cần đi qua.
"""
    explanation = query_ollama(prompt)
    return explanation
