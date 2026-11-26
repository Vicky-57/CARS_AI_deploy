-- CAR-AGENTS SCHEMA v3.6 — Reminders, Bavarian Working Hours, Combined Inquiries & Advertised Vehicle Matching

-- 1. Extend email_triage for §4 Advertised Vehicle matching & §6 Combined Sell+Source dual-inquiry linking
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS linked_inquiry_id UUID;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS parent_contact_key TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS dependency_notes TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS matched_project_id UUID;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS matched_vehicle_title TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS advertised_price TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS buyer_offer_price TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS viewing_requested_time TEXT;
ALTER TABLE email_triage ADD COLUMN IF NOT EXISTS reservation_requested BOOLEAN DEFAULT FALSE;

-- 2. Configurable Working Hours (§10: owner can configure working days & hours; changes apply to new reminders)
CREATE TABLE IF NOT EXISTS crm_working_hours (
    id TEXT PRIMARY KEY DEFAULT 'default',
    work_days JSONB DEFAULT '[0, 1, 2, 3, 4, 5]'::jsonb, -- 0=Mon .. 5=Sat, 6=Sun
    start_hour INT DEFAULT 9,
    end_hour INT DEFAULT 18,
    timezone TEXT DEFAULT 'Europe/Berlin',
    state_holidays TEXT DEFAULT 'BY',                    -- Bavaria (Bayern) public holidays
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO crm_working_hours (id, work_days, start_hour, end_hour, timezone, state_holidays)
VALUES ('default', '[0, 1, 2, 3, 4, 5]'::jsonb, 9, 18, 'Europe/Berlin', 'BY')
ON CONFLICT (id) DO NOTHING;

-- 3. Reminders & Follow-Up Table (§3-§7, §10)
CREATE TABLE IF NOT EXISTS crm_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triage_id UUID,
    lead_id UUID,
    project_id UUID,
    contact_key TEXT,                                    -- prevents duplicate reminders for shared sell+source contact (§6)
    customer_name TEXT,
    customer_contact TEXT,
    category TEXT,
    reminder_type TEXT NOT NULL,                         -- initial_response | awaiting_reply | b2b_followup | custom
    title TEXT NOT NULL,
    notes TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'OPEN',                          -- OPEN | COMPLETED
    notified_individual BOOLEAN DEFAULT FALSE,           -- True once first due WhatsApp alert was sent (§10)
    last_digest_date DATE,                               -- Tracks daily morning overdue overview (§10)
    completed_at TIMESTAMPTZ,
    completed_via TEXT,                                  -- CRM | WHATSAPP
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_status_due ON crm_reminders(status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_contact_key ON crm_reminders(contact_key);

ALTER TABLE public.crm_working_hours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reminders DISABLE ROW LEVEL SECURITY;
