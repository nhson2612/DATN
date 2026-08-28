import os
import sys

# core.config bat buoc co JWT_SECRET; dat gia tri test truoc khi import app.*
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unittest-only")
import types
import unittest
from unittest.mock import patch

if "requests" not in sys.modules:
    sys.modules["requests"] = types.SimpleNamespace(post=lambda *args, **kwargs: None)

if "psycopg_pool" not in sys.modules:
    fake_psycopg_pool = types.ModuleType("psycopg_pool")

    class DummyPool:
        def __init__(self, *args, **kwargs):
            pass

    fake_psycopg_pool.ConnectionPool = DummyPool
    sys.modules["psycopg_pool"] = fake_psycopg_pool

from app import agent_legacy, ir_agent
from app.core.config import reload_settings, settings
from app.llm import adapter as llm_adapter


class FakeResponse:
    """Giả response của requests. Phải có status_code: adapter kiểm
    `status_code >= 400` để lấy body lỗi trước khi raise_for_status()."""

    def __init__(self, data, status_code=200):
        self.data = data
        self.status_code = status_code
        self.text = ""

    def raise_for_status(self):
        return None

    def json(self):
        return self.data


class LLMAdapterTest(unittest.TestCase):
    def test_deepseek_adapter_uses_payload(self):
        data = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": '{"target": null}'
                    }
                }
            ]
        }

        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "deepseek",
                "DEEPSEEK_API_KEY": "test-key",
                "DEEPSEEK_URL": "https://api.deepseek.com/chat/completions",
                "DEEPSEEK_MODEL": "deepseek-v4-pro",
            },
            clear=False,
        ):
            reload_settings()
            with patch("app.llm.adapter.requests.post", return_value=FakeResponse(data)) as post:
                result = llm_adapter.query_llm("Hoi?", "System", json_mode=True)

        self.assertEqual(result, '{"target": null}')
        self.assertEqual(
            post.call_args.args[0],
            "https://api.deepseek.com/chat/completions"
        )
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"]["model"], "deepseek-v4-pro")
        self.assertEqual(
            kwargs["json"]["messages"],
            [
                {"role": "system", "content": "System"},
                {"role": "user", "content": "Hoi?\n\nChỉ trả về đối tượng JSON hợp lệ."},
            ],
        )
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})
        self.assertEqual(kwargs["json"]["thinking"], {"type": "enabled"})
        self.assertEqual(kwargs["json"]["reasoning_effort"], "high")

    def test_ollama_adapter_keeps_legacy_payload(self):
        data = {"response": "SELECT 1"}

        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "ollama",
                "OLLAMA_URL": "http://localhost:11434/api/generate",
                "OLLAMA_MODEL": "qwen2.5:7b",
            },
            clear=False,
        ):
            reload_settings()
            with patch("app.llm.adapter.requests.post", return_value=FakeResponse(data)) as post:
                result = llm_adapter.query_llm("Generate SQL", "System")

        self.assertEqual(result, "SELECT 1")
        self.assertEqual(post.call_args.args[0], "http://localhost:11434/api/generate")
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["json"]["model"], "qwen2.5:7b")
        self.assertEqual(kwargs["json"]["prompt"], "Generate SQL")
        self.assertEqual(kwargs["json"]["system"], "System")
        self.assertFalse(kwargs["json"]["stream"])

    def test_agents_delegate_to_adapter(self):
        with patch("app.ir_agent.query_llm", return_value='{"target": null}') as query:
            self.assertEqual(ir_agent.query_ollama_json("Hoi?", "System"), '{"target": null}')
        # Timeout đọc từ cấu hình, không hardcode: 120s không đủ cho qwen2.5:7b
        # trên máy 4 GB VRAM (đo được 236s cho một lần sinh JSON).
        query.assert_called_once_with(
            "Hoi?", "System", json_mode=True, temperature=0,
            timeout=settings.llm_timeout_sql,
        )

        with patch("app.agent_legacy.query_llm", return_value="SELECT 1") as query:
            self.assertEqual(agent_legacy.query_ollama("Generate SQL", "System"), "SELECT 1")
        query.assert_called_once_with(
            "Generate SQL", "System", timeout=settings.llm_timeout_explain
        )


if __name__ == "__main__":
    unittest.main()
