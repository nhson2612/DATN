-- AI trả lời tự động cho tới khi operator nhận hội thoại.
-- Chạy migration này trên DB đã có migration 009.

BEGIN;

ALTER TABLE support_conversations
    ADD COLUMN IF NOT EXISTS ai_auto_reply BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS human_joined_at TIMESTAMPTZ;

ALTER TABLE support_messages
    ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE support_messages
    DROP CONSTRAINT IF EXISTS support_messages_sender_role_check;

ALTER TABLE support_messages
    ADD CONSTRAINT support_messages_sender_role_check
    CHECK (sender_role IN ('customer', 'operator', 'assistant'));

COMMIT;
