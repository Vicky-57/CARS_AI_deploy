-- ====================================================================
-- CAR-AGENTS SUPABASE DATABASE SCHEMA v3.0 (DUAL BROKERAGE PIPELINES)
-- ====================================================================

-- 1. ENUMS FOR PIPELINES & STATUSES
DO $$ BEGIN
  CREATE TYPE project_type_enum AS ENUM ('BUY', 'SELL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE project_status_enum AS ENUM ('LEAD', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE expense_type_enum AS ENUM ('OIL_CHANGE', 'PAYMENT_SLIP', 'TUEV_INSPECTION', 'DETAILING', 'TRANSPORT', 'ADMIN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE location_type_enum AS ENUM ('OFFLINE_ONSITE', 'ONLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. PROJECTS TABLE (Dual Buy Side & Sell Side Brokerage Projects)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    project_type project_type_enum NOT NULL DEFAULT 'SELL',
    current_stage TEXT NOT NULL DEFAULT 'Onboarding & Lead Capture',
    status project_status_enum NOT NULL DEFAULT 'ACTIVE',
    target_vehicle TEXT, -- e.g. "BMW 320i Sedan" or "Porsche 911 GT3"
    vin TEXT,
    target_price NUMERIC(12, 2) DEFAULT 0.00,
    agreed_sale_price NUMERIC(12, 2) DEFAULT 0.00,
    purchase_price NUMERIC(12, 2) DEFAULT 0.00,
    hourly_rate NUMERIC(8, 2) DEFAULT 20.00, -- Default €20/hr, editable per project
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUB-PROJECT MILESTONES TABLE (Sequential Steps Tracking)
CREATE TABLE IF NOT EXISTS subprojects_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROJECT EXPENSES TABLE (Receipts, Payment Slips, Service Costs)
CREATE TABLE IF NOT EXISTS project_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    expense_type expense_type_enum NOT NULL DEFAULT 'OTHER',
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    receipt_url TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROJECT LABOR TIME TRACKING TABLE
CREATE TABLE IF NOT EXISTS project_labor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    hours_spent NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    activity_description TEXT NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEETINGS & CALENDAR TABLE (Conflict Prevention & Bookings)
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location_type location_type_enum DEFAULT 'OFFLINE_ONSITE',
    location_address TEXT,
    google_event_id TEXT,
    outlook_event_id TEXT,
    is_conflict BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LEADS TABLE (Inbound Contacts)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    channel TEXT DEFAULT 'MANUAL',
    intent TEXT DEFAULT 'UNKNOWN',
    status TEXT DEFAULT 'NEW',
    message TEXT,
    manufacturer TEXT,
    model TEXT,
    vin TEXT,
    license_plate TEXT,
    initial_registration TEXT,
    mileage TEXT,
    power_ps TEXT,
    displacement_ccm TEXT,
    tuev_until TEXT,
    price_limit NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. COMMUNICATIONS_LOG TABLE (Unified Inbox Timeline)
CREATE TABLE IF NOT EXISTS communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    channel TEXT,
    sender_name TEXT,
    sender_contact TEXT,
    subject TEXT,
    body TEXT,
    is_inbound BOOLEAN DEFAULT TRUE,
    intent TEXT,
    ai_summary TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PROJECT MILESTONES TABLE (Sequential Steps Tracking, used by API)
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. GOOGLE CALENDAR AUTH TABLE (Private — stores Maxim's OAuth token)
CREATE TABLE IF NOT EXISTS google_auth (
    id TEXT PRIMARY KEY,
    refresh_token TEXT,
    access_token TEXT,
    token_expiry TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ROLE PRIVILEGES (required — without these, anon/service_role get "permission denied")
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 12. CLIENT FORM SESSIONS (public customer-facing Buy/Sell staged forms)
CREATE TABLE IF NOT EXISTS client_form_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    pipeline TEXT NOT NULL DEFAULT 'sell',           -- 'buy' | 'sell'
    form_link_token TEXT UNIQUE,                     -- short public token for /form/sell?token=...
    stage INT NOT NULL DEFAULT 1,                    -- 1..3 (which form step/section the client is on)
    shared_core JSONB DEFAULT '{}'::jsonb,           -- data entered ONCE & reused across templates
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    status TEXT NOT NULL DEFAULT 'draft',            -- 'draft' | 'completed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. CLIENT FORM SUBMISSIONS (per-template stage field data)
CREATE TABLE IF NOT EXISTS client_form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES client_form_sessions(id) ON DELETE CASCADE,
    stage INT NOT NULL,                              -- 1..3
    template_type TEXT NOT NULL,                     -- 'sell_b2c' | 'buy_passiv' | 'kaufvertrag' | 'handover'
    field_data JSONB DEFAULT '{}'::jsonb,            -- canonical-key values for that template
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, stage, template_type)
);

-- 14. DOCUMENTS (rendered/approved/saved PDFs per template)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES client_form_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    pipeline TEXT,
    template_type TEXT NOT NULL,                     -- 'sell_b2c' | 'buy_passiv' | 'kaufvertrag' | 'handover'
    client_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft',            -- 'draft' | 'approved' | 'saved'
    file_path TEXT,                                  -- absolute path of rendered temp PDF
    drive_url TEXT,
    drive_file_id TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, template_type)
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_leads_channel ON leads(channel);
CREATE INDEX IF NOT EXISTS idx_leads_intent ON leads(intent);
CREATE INDEX IF NOT EXISTS idx_communications_lead ON communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_labor_project ON project_labor(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(start_time);
