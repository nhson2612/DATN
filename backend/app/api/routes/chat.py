"""Endpoint trợ lý du lịch: câu hỏi tiếng Việt -> địa điểm + câu trả lời.

Luồng: tìm kiếm trên dữ liệu (search_service) -> LLM diễn giải kết quả.

LLM KHÔNG sinh truy vấn. Trước đây endpoint này gọi ir_agent, nơi LLM phải chọn
bảng/cột/giá trị/toán tử trước khi nhìn thấy dữ liệu — nó đoán, và mọi thứ ngoài
danh sách trong prompt đều hỏng: "quán karaoke" ra 0 kết quả, "quán bún đậu" ra
20 nhà hàng bất kỳ, "khách sạn gần biển Mỹ Khê" bịa ra giá trị tourism="beach"
không hề tồn tại. Xem app/services/search_service.py.
"""

from fastapi import APIRouter, HTTPException, Request

from app.core.logging import get_logger, log_duration
from app.schemas.requests import ChatRequest
from app.services import geo_ip_service, search_agent

router = APIRouter(prefix="/api", tags=["chat"])
logger = get_logger(__name__)


def _khoang_cach(met):
    return f"{met:.0f} m" if met < 1000 else f"{met / 1000:.1f} km"


def _tom_tat(results, anchor, trong_vung=False):
    """Sinh câu trả lời bằng code, KHÔNG gọi LLM.

    Trước đây bước này gọi LLM để diễn giải danh sách. Đo thực tế: tìm kiếm hết
    270 ms, LLM diễn giải hết 67.400 ms — chiếm 99,6% thời gian phản hồi, và
    frontend đã timeout trước đó nên người dùng chỉ thấy "Không thể kết nối đến
    máy chủ backend" dù backend vẫn trả 200.

    Danh sách đã có sẵn tên, loại và khoảng cách; LLM không thêm thông tin nào
    mà chỉ diễn đạt lại. Sinh bằng code thì kết quả tức thì và không bao giờ bịa.
    """
    if not anchor:
        dau = "quanh vị trí của bạn"
    else:
        # "trong Tỉnh Hà Tĩnh" khác hẳn "gần Tỉnh Hà Tĩnh": cái sau nghe như
        # các địa điểm nằm ngoài tỉnh, cạnh ranh giới.
        dau = f"{'trong' if trong_vung else 'gần'} {anchor['name']}"
    dong = [
        f"{i}. {r['name']} — cách {_khoang_cach(r['met'])}"
        for i, r in enumerate(results[:5], 1)
    ]
    them = f"\n\n(còn {len(results) - 5} địa điểm khác trên bản đồ)" if len(results) > 5 else ""
    return f"Tìm thấy {len(results)} địa điểm {dau}:\n\n" + "\n".join(dong) + them


@router.post("/chat")
def chat(request: ChatRequest, raw_req: Request):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    lon, lat = request.user_lon, request.user_lat
    if lon is None or lat is None:
        lon, lat = geo_ip_service.coords_from_ip(geo_ip_service.get_client_ip(raw_req))

    logger.info("Câu hỏi: %r (vị trí %.4f, %.4f)", question[:120], lon, lat)

    with log_duration(logger, "Tìm kiếm địa điểm"):
        res = search_agent.search(question, lon, lat,
                                  resolved_admin=request.resolved_admin)

    # Địa danh nhập nhằng: hỏi lại thay vì đoán bừa rồi trả kết quả sai tỉnh.
    if res.get("hoi_lai"):
        logger.info("Hỏi lại người dùng: %s", res["hoi_lai"])
        return {"success": True, "results": [], "anchor": None,
                "explanation": res["hoi_lai"],
                "candidates": res.get("candidates", []),
                "che_do": res.get("che_do")}

    results = res["results"]
    anchor = res.get("anchor")
    n = len(results)
    logger.info(
        "Tìm được %d địa điểm — cần tìm %r, mốc %s",
        n, res.get("keywords"), anchor["name"] if anchor else "(vị trí người dùng)",
        extra={"ctx_rows": n, "ctx_keywords": res.get("keywords"),
               "ctx_anchor": anchor["name"] if anchor else None},
    )

    if not n:
        # Rỗng là thất bại im lặng nếu chỉ trả 200 — nâng lên WARNING kèm đủ
        # thông tin để lần: từ khoá nào, mốc nào, bán kính bao nhiêu.
        logger.warning(
            "Không có kết quả — từ khoá %r, mốc %s",
            res.get("keywords"), anchor["name"] if anchor else None,
        )
        return {
            "success": True,
            "results": [],
            "anchor": anchor,
            "explanation": res.get("error") or (
                f"Không tìm thấy địa điểm nào phù hợp"
                + (f" gần {anchor['name']}" if anchor else " quanh vị trí của bạn")
                + "."
            ),
        }

    from app.services import photo_service
    photo_service.ensure_places_photos(results)
    explanation = _tom_tat(results, anchor, res.get("trong_vung", False))

    return {
        "success": True,
        "results": results,
        "anchor": anchor,
        "keywords": res.get("keywords"),
        "explanation": explanation,
        # Cho frontend và luận văn thấy agent đã đi qua những bước nào.
        "che_do": res.get("che_do"),
        "cac_buoc": res.get("cac_buoc"),
    }
