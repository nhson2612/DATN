"""Dịch vụ tìm kiếm và giải đáp du lịch thông qua Tavily Search API."""

import requests

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class TavilyError(Exception):
    """Lỗi chung từ Tavily provider."""


class TavilyConfigurationError(TavilyError):
    """Thiếu API key hoặc key không hợp lệ."""


class TavilyTransientError(TavilyError):
    """Lỗi mạng hoặc timeout khi gọi Tavily."""


def search_tavily(
    query: str,
    include_answer: bool = True,
    max_results: int = 5,
    search_depth: str = "basic",
    post=requests.post,
) -> dict:
    """Tìm kiếm web và sinh câu trả lời trực tiếp qua Tavily API.

    Returns:
        {
            "answer": str,
            "results": [{"title": str, "url": str, "content": str}],
            "query": str,
        }
    """
    key = (settings.tavily_api_key or "").strip()
    if not key:
        raise TavilyConfigurationError("TAVILY_API_KEY chưa được cấu hình.")

    query = str(query or "").strip()
    if not query:
        return {"answer": "", "results": [], "query": ""}

    payload = {
        "api_key": key,
        "query": query,
        "search_depth": search_depth,
        "include_answer": "advanced" if include_answer else False,
        "max_results": min(max(max_results, 1), 10),
    }

    try:
        response = post(
            settings.tavily_url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=settings.tavily_timeout,
        )
    except requests.RequestException as exc:
        raise TavilyTransientError("Không thể kết nối đến Tavily Search API.") from exc

    if response.status_code in (401, 403):
        raise TavilyConfigurationError("Tavily API key không hợp lệ.")
    if response.status_code == 429 or response.status_code >= 500:
        raise TavilyTransientError(f"Tavily HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError as exc:
        raise TavilyTransientError("Tavily trả về dữ liệu không hợp lệ (không phải JSON).") from exc

    answer = str(data.get("answer") or "").strip()
    results = []
    for item in data.get("results") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or "").strip()
        content = str(item.get("content") or "").strip()
        if title and url:
            results.append({
                "title": title,
                "url": url,
                "content": content,
            })

    return {
        "answer": answer,
        "results": results,
        "query": query,
    }
