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
from app.core.config import reload_settings
from app.llm import adapter as llm_adapter


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self.data


class LLMAdapterTest(unittest.TestCase):
    def test_groq_adapter_uses_chat_completions_payload(self):
        data = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": '{"target": null}',
                    }
                }
            ]
        }

        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "groq",
                "GROQ_API_KEY": "test-key",
                "GROQ_URL": "https://api.groq.com/openai/v1/chat/completions",
                "GROQ_MODEL": "qwen/qwen3.6-27b",
            },
            clear=False,
        ):
            reload_settings()
            with patch("app.llm.adapter.requests.post", return_value=FakeResponse(data)) as post:
                result = llm_adapter.query_llm("Hoi?", "System", json_mode=True)

        self.assertEqual(result, '{"target": null}')
        self.assertEqual(post.call_args.args[0], "https://api.groq.com/openai/v1/chat/completions")
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"]["model"], "qwen/qwen3.6-27b")
        self.assertEqual(
            kwargs["json"]["messages"],
            [
                {"role": "system", "content": "System"},
                {"role": "user", "content": "Hoi?"},
            ],
        )
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})

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
        query.assert_called_once_with("Hoi?", "System", json_mode=True, temperature=0, timeout=120)

        with patch("app.agent_legacy.query_llm", return_value="SELECT 1") as query:
            self.assertEqual(agent_legacy.query_ollama("Generate SQL", "System"), "SELECT 1")
        query.assert_called_once_with("Generate SQL", "System", timeout=90)


if __name__ == "__main__":
    unittest.main()
