-- WhatsApp readiness migration (run once in the Supabase SQL editor)
-- Safe to re-run.

-- 1. Conversation state for the fixed question flow (survives server restarts)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    phone      TEXT PRIMARY KEY,
    state      JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_sessions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON whatsapp_sessions TO anon, authenticated, service_role;

-- 2. Lead quality label (Hot / Warm / Cold) + frontend qualification fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_label TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS label_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_answers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS founder_alerted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_stage TEXT DEFAULT 'uncontacted';

-- 3. Fast lookup of a customer by phone number
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
