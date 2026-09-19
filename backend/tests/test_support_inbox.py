"""Các ghi hỗ trợ phải commit trong cùng transaction."""

from contextlib import contextmanager
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from app.support import routes


class FakeTransaction:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))
        return next(self.responses)


@contextmanager
def use_transaction(tx):
    yield tx


class SupportInboxTransactionTests(IsolatedAsyncioTestCase):
    async def test_create_conversation_inserts_conversation_and_message_together(self):
        tx = FakeTransaction([
            [{"id": 71, "user_id": 12, "operator_id": 4, "subject": "Đổi ngày"}],
            [{"id": 91, "conversation_id": 71, "sender_role": "customer", "body": "Tôi cần đổi ngày"}],
        ])
        full = {"id": 71, "user_id": 12, "operator_id": 4, "subject": "Đổi ngày"}

        with patch.object(routes, "_row", return_value={"id": 4}), \
             patch.object(routes, "_conversation", return_value=full), \
             patch.object(routes, "_auto_reply_if_enabled", new=AsyncMock(return_value=None)), \
             patch.object(routes, "transaction", return_value=use_transaction(tx)):
            result = await routes.create_conversation(
                routes.ConversationCreate(subject="Đổi ngày", message="Tôi cần đổi ngày"),
                {"id": 12, "role": "user"},
            )

        self.assertEqual(result["conversation"], full)
        self.assertEqual(result["message"]["conversation_id"], 71)
        self.assertEqual(len(tx.calls), 2)
        self.assertIn("support_conversations", tx.calls[0][0])
        self.assertIn("support_messages", tx.calls[1][0])

    async def test_send_message_writes_message_and_status_together(self):
        tx = FakeTransaction([
            [{"id": 92, "conversation_id": 71, "sender_role": "customer", "body": "Nhờ kiểm tra"}],
            None,
        ])
        conversation = {"id": 71, "user_id": 12, "operator_id": 4, "operator_user_id": 20}

        with patch.object(routes, "_conversation", return_value=conversation), \
             patch.object(routes, "_auto_reply_if_enabled", new=AsyncMock(return_value=None)), \
             patch.object(routes, "transaction", return_value=use_transaction(tx)):
            result = await routes.send_message(
                71,
                routes.MessageCreate(body="Nhờ kiểm tra"),
                {"id": 12, "role": "user"},
            )

        self.assertEqual(result["message"]["id"], 92)
        self.assertEqual(len(tx.calls), 2)
        self.assertIn("support_messages", tx.calls[0][0])
        self.assertIn("UPDATE support_conversations", tx.calls[1][0])

    async def test_close_conversation_commits_returning_update(self):
        updated = {"id": 71, "status": "CLOSED"}
        tx = FakeTransaction([[updated]])
        conversation = {"id": 71, "user_id": 12, "operator_id": 4}

        with patch.object(routes, "_conversation", return_value=conversation), \
             patch.object(routes, "transaction", return_value=use_transaction(tx)):
            result = await routes.update_conversation(
                71,
                routes.ConversationUpdate(status="CLOSED"),
                {"id": 20, "role": "operator", "operator_id": 4},
            )

        self.assertEqual(result["conversation"], updated)
        self.assertEqual(len(tx.calls), 1)
        self.assertIn("UPDATE support_conversations", tx.calls[0][0])


class TourSearchToolTests(TestCase):
    @patch.object(routes, "query_llm", return_value='{"query":"Đà Nẵng","departure_month":10}')
    def test_ai_selects_validated_tool_arguments(self, _llm):
        tool_input = routes._select_tour_search_input("Tôi muốn đi Đà Nẵng tháng 10")

        self.assertEqual(tool_input.query, "Đà Nẵng")
        self.assertEqual(tool_input.departure_month, 10)

    @patch.object(routes, "execute_query", return_value=[])
    def test_tour_tool_receives_ai_selected_arguments(self, execute):
        tool_input = routes.TourSearchToolInput(query="Đà Nẵng", departure_month=10)

        routes._search_tours_for_ai(tool_input)

        self.assertEqual(execute.call_args.args[1], (10, 10, "%Đà Nẵng%"))
