"""
Run Supabase schema v3.1 migration for email lead qualification.
Adds: is_qualified, qualification_stage to leads, and creates email_conversations table.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import get_supabase

sb = get_supabase()

statements = [
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_stage TEXT DEFAULT 'uncontacted'",
    """CREATE TABLE IF NOT EXISTS email_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        message_id TEXT UNIQUE,
        thread_id TEXT,
        direction TEXT NOT NULL,
        from_email TEXT NOT NULL,
        to_email TEXT NOT NULL,
        subject TEXT,
        body_preview TEXT,
        qualification_stage TEXT,
        intent TEXT,
        is_dry_run BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_email_conv_lead ON email_conversations(lead_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_conv_thread ON email_conversations(thread_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_conv_msgid ON email_conversations(message_id)",
    "CREATE INDEX IF NOT EXISTS idx_email_conv_direction ON email_conversations(direction)",
]

for sql in statements:
    label = sql.strip()[:70].replace('\n', ' ')
    try:
        sb.postgrest.session.post(
            f"{sb.postgrest.base_url}/rpc/execute_sql",
            json={"sql": sql}
        )
        print(f"OK  : {label}")
    except Exception as e:
        # Supabase client doesn't expose raw SQL — use the REST API directly
        print(f"SKIP: {label[:60]} → {str(e)[:60]}")

# Try direct approach using supabase-py execute
print("\nTrying direct table check...")
try:
    result = sb.table("email_conversations").select("id").limit(1).execute()
    print("email_conversations table EXISTS ✅")
except Exception as e:
    print("email_conversations table NOT FOUND ❌ — need to create via SQL editor")

try:
    result = sb.table("leads").select("is_qualified").limit(1).execute()
    print("leads.is_qualified column EXISTS ✅")
except Exception as e:
    print("leads.is_qualified column NOT FOUND ❌ — need to add via SQL editor")

print("\nDone.")
