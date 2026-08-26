"""Adapter gọi LLM. Mọi endpoint, model, timeout lấy từ core.config."""

import requests

from app.core.config import settings

# Giữ tên cũ để mã hiện có còn import được, nhưng giá trị đến từ cấu hình.
DEFAULT_PROVIDER = settings.llm_provider
OLLAMA_URL = settings.ollama_url
OLLAMA_MODEL = settings.ollama_model
GROQ_URL = settings.groq_url
GROQ_MODEL = settings.groq_model


def _extract_groq_content(data):
    message = data.get("choices", [{}])[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts).strip()
    return str(content).strip()


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


def _query_groq(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=None):
    api_key = settings.groq_api_key
    if not api_key:
        raise RuntimeError("missing GROQ_API_KEY")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(
        settings.groq_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return _extract_groq_content(response.json())


def query_llm(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=None):
    if timeout is None:
        timeout = settings.llm_timeout
    provider = settings.llm_provider.lower()
    try:
        if provider == "ollama":
            return _query_ollama(
                prompt,
                system_prompt,
                json_mode=json_mode,
                temperature=temperature,
                timeout=timeout,
            )
        if provider == "groq":
            return _query_groq(
                prompt,
                system_prompt,
                json_mode=json_mode,
                temperature=temperature,
                timeout=timeout,
            )
        raise ValueError(f"unsupported LLM_PROVIDER: {provider}")
    except Exception as e:
        print(f"LLM adapter error ({provider}): {e}")
        return ""
