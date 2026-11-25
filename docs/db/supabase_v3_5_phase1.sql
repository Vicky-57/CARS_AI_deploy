-- CAR-AGENTS SCHEMA v3.5 — Phase 1 AI-Assisted Lead Qualification & B2B Deals
-- 1. Extend email_triage to hold full Phase 1 inquiry analysis, parameters, missing fields, and draft reply
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS extracted_params JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS missing_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS draft_subject TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS draft_reply TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS draft_status TEXT DEFAULT 'pending'; -- pending | sent | none | discarded
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';      -- HIGH | NORMAL | LOW
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS priority_reason TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS payment_deadline TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS multi_requests JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN DEFAULT FALSE;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS email_date TIMESTAMPTZ;

-- 2. Dedicated B2B Cooperation & Service Offers table (manual deal management)
CREATE TABLE IF NOT EXISTS b2b_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triage_id UUID,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    b2b_type TEXT DEFAULT 'general_offer', -- cooperation | general_offer | advertising
    subject TEXT,
    offer_summary TEXT,
    status TEXT DEFAULT 'NEW',             -- NEW | CONTACTED | IN_DISCUSSION | ACTIVE_PARTNER | ARCHIVED
    deal_value NUMERIC,
    follow_up_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_deals_status ON b2b_deals(status);
CREATE INDEX IF NOT EXISTS idx_b2b_deals_created ON b2b_deals(created_at DESC);

ALTER TABLE public.email_triage DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sender_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_deals DISABLE ROW LEVEL SECURITY;
