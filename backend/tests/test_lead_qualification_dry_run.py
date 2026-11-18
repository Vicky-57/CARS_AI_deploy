"""
test_lead_qualification_dry_run.py
─────────────────────────────────────────────────────────────────────────────
Dry-Run Testing Script for Lead Qualification
Simulates qualifying actual imported email leads in Supabase:
  - Advances stage: 'uncontacted' -> 'q1_sent' -> 'q2_sent' -> 'qualified'
  - Generates email reply drafts into ./dry_run_emails/ (ZERO emails sent to clients)
  - Updates Supabase lead qualification_stage & is_qualified status
  - Fires Telegram alerts with interactive [ ⚡ Convert to Project ] buttons
─────────────────────────────────────────────────────────────────────────────
"""
import os
import sys
import asyncio
from datetime import datetime, timezone
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

DRAFT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dry_run_emails")
os.makedirs(DRAFT_DIR, exist_ok=True)

async def send_telegram_alert(lead_name, lead_email, vehicle, stage, intent):
    """Sends Telegram alert with 1-click Convert button"""
    bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    chat_id = getattr(settings, "TELEGRAM_CHAT_ID", "")
    if not bot_token or not chat_id:
        print("  [Telegram] BOT_TOKEN or CHAT_ID not set. Skipping Telegram notification.")
        return

    text = (
        f"<b>Lead Qualifiziert! (Dry-Run Test)</b>\n\n"
        f"<b>Name:</b> {lead_name}\n"
        f"<b>E-Mail:</b> {lead_email}\n"
        f"<b>Fahrzeug:</b> {vehicle or 'N/A'}\n"
        f"<b>Intent:</b> {intent}\n"
        f"<b>Stage:</b> {stage}\n\n"
        f"<i>Lead ist nun fully qualified! Klicke unten um direkt ein Projekt zu erstellen.</i>"
    )

    inline_btns = {
        "inline_keyboard": [
            [
                {"text": "Convert to Project", "callback_data": f"/convert {lead_name}"},
                {"text": "View Leads", "callback_data": "/leads"}
            ]
        ]
    }

    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "reply_markup": inline_btns
                }
            )
            print("  [Telegram] Alert notification sent with 1-click Convert button!")
        except Exception as e:
            print(f"  [Telegram] Notification failed: {e}")

async def run_dry_run_qualification():
    print("Fetching leads for dry-run qualification test...")
    res = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc&limit=10", headers=HEADERS)
    if res.status_code != 200:
        print(f"Failed to fetch leads: {res.status_code} {res.text}")
        return

    leads = res.json()
    print(f"Found {len(leads)} leads for testing.")

    qual_target = None
    for l in leads:
        if l.get("channel") == "STRATO_EMAIL" and not l.get("is_qualified"):
            qual_target = l
            break

    if not qual_target:
        qual_target = leads[0] if leads else None

    if not qual_target:
        print("No eligible lead found for test.")
        return

    lead_id = qual_target["id"]
    name = (qual_target.get("name") or "Kunde").encode('ascii', 'ignore').decode('ascii')
    email = qual_target.get("email") or "client@example.com"
    intent = qual_target.get("intent", "BUY_INTENT")
    vehicle = f"{qual_target.get('manufacturer') or ''} {qual_target.get('model') or ''}".strip() or "Audi A6"

    print(f"\n=======================================================")
    print(f"STARTING DRY-RUN QUALIFICATION TEST FOR LEAD:")
    print(f"  * Name: {name}")
    print(f"  * Email: {email}")
    print(f"  * Vehicle: {vehicle}")
    print(f"  * Current Intent: {intent}")
    print(f"=======================================================\n")

    # Step 1: Q1 Intent & Vehicle Confirmation
    print("--- Step 1: Generating Q1 Reply Draft (Intent Confirmation) ---")
    q1_draft = (
        f"Hallo {name},\n\n"
        f"vielen Dank fuer Ihre Anfrage bezueglich {vehicle}.\n"
        f"Wir haben Ihre Nachricht erhalten. Koennen Sie uns kurz bestaetigen, ob Sie das Fahrzeug kaufen oder Ihr altes Fahrzeug in Zahlung geben moechten?\n\n"
        f"Beste Gruesse,\nIhr CAR-AGENTS Team\ninfo@car-agents.de"
    )
    safe_name = name.replace(' ', '_').replace('/', '_')
    draft_file_1 = os.path.join(DRAFT_DIR, f"draft_{safe_name}_Q1.txt")
    with open(draft_file_1, "w", encoding="utf-8") as f:
        f.write(q1_draft)
    print(f"  Saved Q1 Draft to: {draft_file_1}")

    httpx.patch(
        f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}",
        headers=HEADERS,
        json={"qualification_stage": "q1_sent"}
    )
    print("  Supabase qualification_stage updated -> 'q1_sent'\n")

    # Step 2: Q2 Budget & Timeline Details
    print("--- Step 2: Simulating Client Reply & Generating Q2 Reply Draft ---")
    q2_draft = (
        f"Hallo {name},\n\n"
        f"vielen Dank fuer die Rueckmeldung! Was ist Ihr gewuenschtes Budget und bis wann moechten Sie das Projekt umsetzen?\n\n"
        f"Beste Gruesse,\nIhr CAR-AGENTS Team"
    )
    draft_file_2 = os.path.join(DRAFT_DIR, f"draft_{safe_name}_Q2.txt")
    with open(draft_file_2, "w", encoding="utf-8") as f:
        f.write(q2_draft)
    print(f"  Saved Q2 Draft to: {draft_file_2}")

    httpx.patch(
        f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}",
        headers=HEADERS,
        json={"qualification_stage": "q2_sent"}
    )
    print("  Supabase qualification_stage updated -> 'q2_sent'\n")

    # Step 3: Final Qualification & Telegram Alert
    print("--- Step 3: Qualifying Lead & Triggering Telegram Notification ---")
    httpx.patch(
        f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}",
        headers=HEADERS,
        json={
            "qualification_stage": "qualified",
            "is_qualified": True,
            "status": "QUALIFIED"
        }
    )
    print("  Supabase lead updated -> qualification_stage='qualified', is_qualified=True")

    await send_telegram_alert(name, email, vehicle, "qualified", intent)

    print(f"\n=======================================================")
    print(f"DRY-RUN QUALIFICATION TEST SUCCESSFUL!")
    print(f"  * Draft emails saved in: {DRAFT_DIR}")
    print(f"  * Lead is now fully qualified in Supabase DB!")
    print(f"=======================================================")

if __name__ == "__main__":
    asyncio.run(run_dry_run_qualification())
