"""Adapter gọi LLM. Mọi endpoint, model, timeout lấy từ core.config."""

import re
import time

import requests

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _human(ms: float) -> str:
    if ms < 1000:
        return f"{ms:.0f}ms"
    if ms < 60_000:
        return f"{ms / 1000:.1f}s"
    return f"{int(ms // 60_000)}m{ms % 60_000 / 1000:.1f}s"

# Giữ tên cũ để mã hiện có còn import được, nhưng giá trị đến từ cấu hình.
DEFAULT_PROVIDER = settings.llm_provider
OLLAMA_URL = settings.ollama_url
OLLAMA_MODEL = settings.ollama_model
DEEPSEEK_URL = settings.deepseek_url
DEEPSEEK_MODEL = settings.deepseek_model

_THINK_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL | re.IGNORECASE)


def _strip_reasoning(text: str) -> str:
    cleaned = _THINK_RE.sub("", text)
    if "<think>" in cleaned:
        cleaned = cleaned.split("<think>", 1)[0]
    return cleaned.strip()


def _query_ollama(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=None):
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system_prompt:
        payload["system"] = system_prompt
    if json_mode:
        payload["format"] = "json"

    response = requests.post(
        settings.ollama_url,
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json().get("response", "").strip()


def _query_deepseek(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=None):
    api_key = settings.deepseek_api_key
    if not api_key:
        raise RuntimeError("missing DEEPSEEK_API_KEY")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": settings.deepseek_model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
        "thinking": {"type": "enabled"},
        "reasoning_effort": "high",
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        # also append helper to user prompt to ensure it responds in JSON
        if not messages[-1]["content"].lower().strip().endswith("json"):
            messages[-1]["content"] += "\n\nChỉ trả về đối tượng JSON hợp lệ."

    response = requests.post(
        settings.deepseek_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    if response.status_code >= 400:
        try:
            detail = response.json().get("error", response.json())
        except ValueError:
            detail = response.text[:500]
        logger.error(
            "DeepSeek trả %d: %s", response.status_code, detail,
            extra={"ctx_status": response.status_code, "ctx_model": settings.deepseek_model},
        )
        response.raise_for_status()
        
    data = response.json()
    try:
        choices = data.get("choices") or [{}]
        message = choices[0].get("message") or {}
        content = message.get("content", "")
        return _strip_reasoning(str(content))
    except (KeyError, IndexError) as e:
        logger.error("Lỗi khi parse response từ DeepSeek: %s", e)
        raise RuntimeError("Malformed response from DeepSeek") from e


def query_llm(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=None):
    if timeout is None:
        timeout = settings.llm_timeout
    provider = settings.llm_provider.lower()
    model = settings.deepseek_model if provider == "deepseek" else settings.ollama_model
    # INFO chứ không DEBUG: đây là chỗ tốn phần lớn thời gian của request, phải
    # thấy được dòng này NGAY khi bắt đầu chờ.
    logger.info(
        "Gọi LLM %s/%s (json=%s, timeout=%ss, prompt %d ký tự)",
        provider, model, json_mode, timeout, len(prompt),
        extra={"ctx_provider": provider, "ctx_model": model},
    )
    t0 = time.perf_counter()
    try:
        if provider == "ollama":
            result = _query_ollama(
                prompt,
                system_prompt,
                json_mode=json_mode,
                temperature=temperature,
                timeout=timeout,
            )
        elif provider == "deepseek":
            result = _query_deepseek(
                prompt,
                system_prompt,
                json_mode=json_mode,
                temperature=temperature,
                timeout=timeout,
            )
        else:
            raise ValueError(f"unsupported LLM_PROVIDER: {provider}")

        ms = (time.perf_counter() - t0) * 1000
        # Cảnh báo nếu sát timeout: 7b không vừa 4 GB VRAM nên đổ sang CPU và
        # thường mất >120s. Thấy dòng này là biết phải tăng LLM_TIMEOUT hoặc
        # đổi model, thay vì đoán.
        level = logger.warning if ms > timeout * 1000 * 0.8 else logger.info
        level(
            "LLM %s/%s trả %d ký tự sau %s",
            provider, model, len(result), _human(ms),
            extra={"ctx_provider": provider, "ctx_model": model,
                   "ctx_duration_ms": round(ms, 1), "ctx_chars": len(result)},
        )
        return result
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        logger.error(
            "LLM %s/%s lỗi sau %.0fms: %s — trả về chuỗi rỗng",
            provider, model, ms, e,
            extra={"ctx_provider": provider, "ctx_model": model,
                   "ctx_duration_ms": round(ms, 1)},
            exc_info=True,
        )
        return ""
