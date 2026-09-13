"""Tìm kiếm địa điểm & giải đáp thông tin du lịch thông minh (kết hợp Serper Places + Tavily AI)."""

import re
from app.core.config import settings
from app.core.logging import get_logger
from app.shared.places import serper as serper_service
from app.shared.search import tavily as tavily_service

logger = get_logger(__name__)

# Các mẫu nhận diện câu hỏi thông tin, chi phí, giờ mở cửa, kinh nghiệm du lịch
QA_PATTERNS = [
    r"(?i)\b(giá|vé|chi phí|bao nhiêu|bao nhiu|hết bao tiền|tiền vé|phí tham quan|phí vào)\b",
    r"(?i)\b(mấy giờ|mở cửa|đóng cửa|khi nào|thời gian mở|giờ giấc)\b",
    r"(?i)\b(kinh nghiệm|review|lưu ý|hướng dẫn|thế nào|như thế nào|ra sao|có nên|tại sao|vì sao)\b",
    r"(?i)\b(mặc gì|ăn gì|chơi gì|mua gì|lịch trình)\b",
    r"\?$",
]


def _is_qa_query(question: str) -> bool:
    """Kiểm tra câu hỏi có mang tính chất hỏi đáp thông tin (QA) hay không."""
    q = str(question or "").strip()
    return any(re.search(pattern, q) for pattern in QA_PATTERNS)


def _clean_place_name(question: str) -> str:
    """Tách tên địa danh ra khỏi câu hỏi để tra cứu POI trên bản đồ."""
    text = question.strip().rstrip("?.,!")
    text = re.sub(
        r"(?i)^(cho tôi hỏi|cho hỏi|hỏi|vé vào|giá vé|chi phí|kinh nghiệm đi|kinh nghiệm tham quan|thời gian mở cửa|giờ mở cửa|thông tin về)\s+",
        "",
        text,
    )
    text = re.sub(
        r"(?i)\s+(mở cửa lúc mấy giờ|đóng cửa lúc mấy giờ|mở cửa khi nào|mấy giờ mở cửa|mấy giờ đóng cửa|giá bao nhiêu|bao nhiêu tiền|bao nhiêu|như thế nào|thế nào|ra sao|có đẹp không|ở đâu)$",
        "",
        text,
    )
    return text.strip()


def search(
    question: str,
    lon: float | None = None,
    lat: float | None = None,
    limit: int = 20,
    resolved_admin: str | None = None,
):
    """Tìm kiếm thông tin & địa điểm du lịch linh hoạt.

    - Nếu là câu hỏi QA (giá vé, giờ mở cửa, kinh nghiệm):
      Gửi truy vấn sang Tavily để lấy câu trả lời chính xác, kèm nguồn tham khảo.
      Đồng thời tra cứu POI liên quan trên Serper để cắm mốc lên bản đồ và thêm vào chuyến đi.
    - Nếu là câu hỏi tìm kiếm địa điểm (quán ăn, khách sạn, danh lam):
      Ưu tiên Serper Places để lấy danh sách POI chuẩn PostGIS/Google Maps.
      Nếu Serper Places không có kết quả -> Dùng Tavily làm giải pháp dự phòng (fallback).
    """
    raw_question = str(question or "").strip()
    if not raw_question:
        return {
            "results": [],
            "anchor": None,
            "keywords": "",
            "answer": None,
            "sources": [],
            "trong_vung": False,
            "che_do": "empty",
            "cac_buoc": [],
            "error": "Câu hỏi rỗng.",
        }

    provider_question = raw_question
    if resolved_admin and resolved_admin.casefold() not in provider_question.casefold():
        provider_question = f"{provider_question}, {resolved_admin}"

    is_qa = _is_qa_query(raw_question)
    has_tavily = bool(settings.tavily_api_key)

    # -------------------------------------------------------------
    # TRƯỜNG HỢP 1: Câu hỏi QA (giá vé, giờ giấc, kinh nghiệm, thông tin)
    # -------------------------------------------------------------
    if is_qa and has_tavily:
        tavily_answer = None
        tavily_sources = []
        try:
            tav_res = tavily_service.search_tavily(
                provider_question,
                include_answer=True,
                max_results=4,
                search_depth="advanced",
            )
            tavily_answer = tav_res.get("answer")
            tavily_sources = tav_res.get("results") or []
        except Exception as exc:
            logger.warning("Tavily QA search lỗi: %s", exc)

        # Trích xuất tên địa danh để tìm POI hiển thị bản đồ
        place_name = _clean_place_name(raw_question)
        poi_rows = []
        if place_name and len(place_name) >= 3:
            try:
                poi_query = f"{place_name}, {resolved_admin}" if resolved_admin else place_name
                poi_rows = serper_service.search_places(poi_query, lat, lon, limit=4)
            except Exception as exc:
                logger.debug("Serper companion search lỗi: %s", exc)

        if tavily_answer:
            return {
                "results": poi_rows,
                "anchor": None,
                "keywords": raw_question,
                "answer": tavily_answer,
                "sources": tavily_sources,
                "trong_vung": False,
                "che_do": "tavily_qa",
                "cac_buoc": [
                    {"provider": "tavily_qa", "has_answer": True},
                    {"provider": "serper_companion", "so_dong": len(poi_rows)},
                ],
                "error": None,
            }

    # -------------------------------------------------------------
    # TRƯỜNG HỢP 2: Tìm kiếm địa điểm POI thông thường (Serper Places)
    # -------------------------------------------------------------
    rows = []
    try:
        rows = serper_service.search_places(provider_question, lat, lon, limit)
    except (serper_service.SerperConfigurationError,
            serper_service.SerperTransientError) as exc:
        logger.warning("Serper Places search lỗi: %s", exc)
        rows = []

    # Nếu tìm thấy địa điểm -> Trả kết quả chuẩn
    if rows:
        return {
            "results": rows,
            "anchor": None,
            "keywords": raw_question,
            "answer": None,
            "sources": [],
            "trong_vung": False,
            "che_do": "serper",
            "cac_buoc": [{"provider": "serper_places", "so_dong": len(rows)}],
            "error": None,
        }

    # -------------------------------------------------------------
    # TRƯỜNG HỢP 3: Serper không tìm thấy địa điểm -> Fallback sang Tavily
    # -------------------------------------------------------------
    if has_tavily:
        try:
            tav_res = tavily_service.search_tavily(
                provider_question,
                include_answer=True,
                max_results=4,
                search_depth="basic",
            )
            ans = tav_res.get("answer")
            if ans:
                return {
                    "results": [],
                    "anchor": None,
                    "keywords": raw_question,
                    "answer": ans,
                    "sources": tav_res.get("results") or [],
                    "trong_vung": False,
                    "che_do": "tavily_fallback",
                    "cac_buoc": [
                        {"provider": "serper_places", "so_dong": 0},
                        {"provider": "tavily_fallback", "has_answer": True},
                    ],
                    "error": None,
                }
        except Exception as exc:
            logger.warning("Tavily fallback search lỗi: %s", exc)

    return {
        "results": [],
        "anchor": None,
        "keywords": raw_question,
        "answer": None,
        "sources": [],
        "trong_vung": False,
        "che_do": "serper",
        "cac_buoc": [{"provider": "serper_places", "so_dong": 0}],
        "error": "Không tìm thấy địa điểm hoặc thông tin phù hợp.",
    }
