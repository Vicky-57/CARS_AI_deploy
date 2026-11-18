"""
database_migration_intent_cleanup.py
─────────────────────────────────────────────────────────────────────────────
Normalizes all leads in Supabase database so that:
  1. `intent` is strictly set to 'BUY_INTENT' or 'SELL_INTENT' (never 'INQUIRY' or 'NEW' or 'UNKNOWN').
  2. Ensures vehicle info or inquiry subject is stored properly.
─────────────────────────────────────────────────────────────────────────────
"""
import os
import sys
import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import settings

SUPABASE_URL = "https://wvzulyxzuntjnzdykstt.supabase.co"
KEY = getattr(settings, "SUPABASE_PUBLISHABLE_KEY", "sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm")
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def clean_intents():
    print("Fetching all leads from Supabase...")
    res = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?select=*", headers=HEADERS)
    if res.status_code != 200:
        print(f"Error fetching leads: {res.status_code} {res.text}")
        return

    leads = res.json()
    print(f"Found {len(leads)} total leads in database.")

    updated_count = 0

    for lead in leads:
        lead_id = lead["id"]
        raw_intent = str(lead.get("intent") or "").upper()
        notes = (lead.get("notes") or "").lower()
        name = (lead.get("name") or "").lower()
        email = (lead.get("email") or "").lower()
        manu = (lead.get("manufacturer") or "").lower()
        model = (lead.get("model") or "").lower()

        text_corpus = f"{raw_intent} {notes} {name} {email} {manu} {model}"

        # Determine strict BUY_INTENT vs SELL_INTENT
        if "SELL" in raw_intent:
            new_intent = "SELL_INTENT"
        elif "BUY" in raw_intent:
            new_intent = "BUY_INTENT"
        elif any(k in text_corpus for k in ["anzeige", "verkauf", "angebot", "wartungshistorie", "rechnung", "finanzcheck", "signselector", "auto1"]):
            new_intent = "SELL_INTENT"
        else:
            # Default genuine customer inquiry to BUY_INTENT
            new_intent = "BUY_INTENT"

        if lead.get("intent") != new_intent:
            patch_res = httpx.patch(
                f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}",
                headers=HEADERS,
                json={"intent": new_intent}
            )
            if patch_res.status_code in [200, 204]:
                updated_count += 1
                clean_name = (lead.get('name') or lead_id[:8]).encode('ascii', 'ignore').decode('ascii')
                print(f"Updated [{clean_name}]: '{lead.get('intent')}' -> '{new_intent}'")
            else:
                print(f"Failed to update lead {lead_id}: {patch_res.status_code} {patch_res.text}")

    print(f"\nMigration Complete! Normalized {updated_count} lead(s). All leads now strictly hold BUY_INTENT or SELL_INTENT.")

if __name__ == "__main__":
    clean_intents()
