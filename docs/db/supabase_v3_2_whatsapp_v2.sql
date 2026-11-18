-- ====================================================================
-- CAR-AGENTS SCHEMA v3.2 — WhatsApp Assistant v2 (Meetings + Docs + OCR)
-- ====================================================================

-- 1. Extend meetings with lead_id, vehicle, deal_type, status, customer_email
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS vehicle TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS deal_type TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SCHEDULED';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS customer_email TEXT;

UPDATE public.meetings SET status = 'SCHEDULED' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_lead ON public.meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);

-- 2. Extend leads with optional client identity/address columns (from ID-card OCR)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS nationality TEXT;

-- 3. Customer Documents table (Upload Document flow — separate from generated contract `documents`)
CREATE TABLE IF NOT EXISTS public.customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    category TEXT NOT NULL DEFAULT 'other',     -- 'id_card' | 'contract' | 'vehicle_papers' | 'photos' | 'other'
    filename TEXT NOT NULL,
    mime_type TEXT,
    drive_file_id TEXT,
    drive_url TEXT,
    storage_bucket TEXT,
    storage_path TEXT,
    file_url TEXT,
    source TEXT NOT NULL DEFAULT 'WHATSAPP_UPLOAD',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_documents DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.customer_documents TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_cust_docs_lead ON public.customer_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_cust_docs_project ON public.customer_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_cust_docs_phone ON public.customer_documents(customer_phone);

-- 4. Supabase Storage bucket fallback (used if Google Drive OAuth is not connected)
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read customer-documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'customer-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow upload customer-documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'customer-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow update customer-documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'customer-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
