-- v3.4 — Email triage audit log + founder allow/deny decisions
CREATE TABLE IF NOT EXISTS email_triage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    reply_to TEXT,
    subject TEXT,
    body_preview TEXT,
    intent TEXT,                     -- BUY | SELL (for review items awaiting a decision)
    decision TEXT NOT NULL,          -- drop | lead | review | reply
    category TEXT,                   -- lead_buy | marketing | automated | ...
    layer TEXT,                      -- 0 | 1 | 2 | thread
    score INT,
    confidence NUMERIC,
    reason TEXT,
    lead_id UUID,
    resolution TEXT,                 -- ok | no (founder answer for review items)
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_triage_created ON email_triage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_triage_sender ON email_triage(sender_email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_triage_message ON email_triage(message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sender_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern TEXT NOT NULL UNIQUE,    -- full address or domain
    rule TEXT NOT NULL CHECK (rule IN ('allow', 'deny')),
    source TEXT DEFAULT 'founder',
    created_at TIMESTAMPTZ DEFAULT now()
);
