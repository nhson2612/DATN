import os

import requests

DEFAULT_PROVIDER = "groq"

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:7b"

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "qwen/qwen3.6-27b"


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


def _query_ollama(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=90):
    payload = {
        "model": os.getenv("OLLAMA_MODEL", OLLAMA_MODEL),
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system_prompt:
        payload["system"] = system_prompt
    if json_mode:
        payload["format"] = "json"

    response = requests.post(
        os.getenv("OLLAMA_URL", OLLAMA_URL),
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json().get("response", "").strip()


def _query_groq(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=90):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("missing GROQ_API_KEY")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": os.getenv("GROQ_MODEL", GROQ_MODEL),
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(
        os.getenv("GROQ_URL", GROQ_URL),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    return _extract_groq_content(response.json())


def query_llm(prompt, system_prompt=None, *, json_mode=False, temperature=0, timeout=90):
    provider = os.getenv("LLM_PROVIDER", DEFAULT_PROVIDER).lower()
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
