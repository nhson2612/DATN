CREATE TABLE IF NOT EXISTS support_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operator_id BIGINT NOT NULL REFERENCES operators(id),
    subject VARCHAR(160) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PENDING','CLOSED')),
    ai_auto_reply BOOLEAN NOT NULL DEFAULT TRUE,
    human_joined_at TIMESTAMPTZ,
    last_operator_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_conversations_operator_updated_idx ON support_conversations(operator_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS support_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    sender_id BIGINT REFERENCES users(id),
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('customer','operator','assistant')),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_messages_conversation_idx ON support_messages(conversation_id, created_at, id);
