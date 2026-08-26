"""Giữ lại để tương thích: mã cũ và test import `app.llm_adapter`.

Nguồn thật là app/llm/adapter.py.
"""

from app.llm.adapter import (  # noqa: F401
    DEFAULT_PROVIDER,
    GROQ_MODEL,
    GROQ_URL,
    OLLAMA_MODEL,
    OLLAMA_URL,
    _extract_groq_content,
    _query_groq,
    _query_ollama,
    query_llm,
)
