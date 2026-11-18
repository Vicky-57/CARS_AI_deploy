r"""
backend/cleanup_spam_leads.py
────────────────────────────────────────────────────────────────────────
SAFE SUPABASE-ONLY CLEANUP SCRIPT:
Finds and cleans spam/newsletter/notification leads in Supabase database.
NOTE: Operates EXCLUSIVELY on our Supabase DB. NEVER touches client Strato
IMAP/SMTP or external email accounts.

Usage:
    cd "d:\CARS AI"
    python backend/cleanup_spam_leads.py           # audit only → saves CSV
    python backend/cleanup_spam_leads.py --flag    # mark spam as status=SPAM
    python backend/cleanup_spam_leads.py --delete  # permanently delete spam from DB
────────────────────────────────────────────────────────────────────────
"""
import sys
import os
import csv
import json
import argparse

# Force UTF-8 on Windows stdout/stderr
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

# ── Supabase config (DB ONLY - NEVER TOUCHES STRATO) ──────────────────────────
SUPABASE_URL = "https://wvzulyxzuntjnzdykstt.supabase.co"
SUPABASE_KEY = "sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}


def supabase_get(table: str, select: str = "*", filters: dict = None, limit: int = 2000) -> list:
    params = {"select": select, "limit": limit, "order": "created_at.desc"}
    if filters:
        params.update(filters)
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def supabase_patch(table: str, row_id: str, payload: dict):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**HEADERS, "Prefer": "return=minimal"},
        params={"id": f"eq.{row_id}"},
        json=payload
    )
    r.raise_for_status()


def supabase_delete(table: str, row_id: str):
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=HEADERS,
        params={"id": f"eq.{row_id}"}
    )
    r.raise_for_status()


# ── Spam detection patterns ────────────────────────────────────────────────────
SPAM_DOMAINS = {
    "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "xing.com", "youtube.com", "tiktok.com", "paypal.com", "klarna.com",
    "stripe.com", "mollie.com", "dhl.de", "dhl.com", "dpd.de", "hermes.de",
    "fedex.com", "ups.com", "gls-group.eu", "deutschepost.de",
    "booking.com", "airbnb.com", "expedia.com", "google.com",
    "googlealerts.com", "accounts.google.com", "github.com",
    "notifications.github.com", "slack.com", "notion.so", "atlassian.com",
    "mailchimp.com", "sendgrid.net", "constantcontact.com",
    "hubspot.com", "salesforce.com", "amazon.com", "amazon.de",
    "ebay.de", "ebay.com", "noreply.de", "no-reply.de",
    "finanzcheckpro.de", "finanzcheck.de", "strato.com", "strato.de",
    "trit.io", "quality.strato.de", "check24.de", "verivox.de",
    "ionos.de", "1und1.de", "telekom.de", "vodafone.de",
}

SPAM_NAME_PATTERNS = {
    "linkedin", "facebook", "instagram", "twitter", "xing",
    "newsletter", "noreply", "no-reply", "do-not-reply",
    "notification", "automated", "mailer-daemon",
    "dhl", "dpd", "hermes", "fedex", "ups",
    "paypal", "klarna", "stripe", "booking.com", "airbnb",
    "google alerts", "strato service", "strato", "finanzcheck",
    "trit.io", "support@", "kundenservice", "customer service",
}

SPAM_KEYWORDS = {
    "newsletter", "unsubscribe", "abmelden", "tracking", "paket", "sendung",
    "kontoauszug", "lastschrift", "rechnung", "invoice", "billing",
    "rabatt", "% off", "promo", "gutschein", "coupon",
    "linkedin", "facebook", "instagram", "xing",
    "delivery failed", "mailer-daemon", "bounce",
    "password reset", "passwort", "verifizierung", "verify", "aktivieren",
    "dhl", "dpd", "hermes", "kundenservice", "umfrage", "survey",
    "agb", "partnerprogramm", "vermittler-account", "<html", "<style",
}

AUTO_EMAIL_PATTERNS = ["noreply", "no-reply", "mailer-daemon", "bounce", "donotreply", "support@", "service@"]


def is_spam(lead: dict) -> tuple:
    """Returns (True, reason) or (False, '')."""
    email = (lead.get("email") or "").lower().strip()
    name = (lead.get("name") or "").lower().strip()
    notes = (lead.get("notes") or "").lower()
    msg = (lead.get("message") or "").lower()
    combined_text = f"{notes} {msg}"

    # 1. Blocked domain
    if "@" in email:
        domain = email.split("@")[-1]
        if domain in SPAM_DOMAINS:
            return True, f"Blocked domain: {domain}"

    # 2. Auto email address patterns
    for pattern in AUTO_EMAIL_PATTERNS:
        if pattern in email:
            return True, f"Auto email address pattern: '{pattern}'"

    # 3. Spam name patterns
    for pattern in SPAM_NAME_PATTERNS:
        if pattern in name:
            return True, f"Spam name pattern: '{pattern}'"

    # 4. Raw HTML dump in notes or message
    if "<html" in combined_text or "<!doctype" in combined_text or "<style>" in combined_text or "<table" in combined_text:
        return True, "Contains raw HTML email template"

    # 5. Multiple spam keywords
    found_kws = [kw for kw in SPAM_KEYWORDS if kw in combined_text]
    if len(found_kws) >= 2:
        return True, f"Spam keywords: {found_kws[:4]}"

    # 6. Very short name from email channel with no car details
    channel = (lead.get("channel") or "").lower()
    has_car = bool(lead.get("manufacturer") or lead.get("model"))
    if channel in ("strato_email", "email") and len(name) < 3 and not has_car:
        return True, f"Too-short name '{name}' with no vehicle data"

    return False, ""


def run_audit(delete_confirmed: bool = False, flag_confirmed: bool = False):
    print("🔍  Connecting to Supabase REST API (DB ONLY)...")

    try:
        leads = supabase_get(
            "leads",
            select="id,name,email,phone,channel,status,intent,message,notes,manufacturer,model,created_at",
            limit=2000
        )
    except Exception as e:
        print(f"❌  Failed to fetch leads from Supabase: {e}")
        sys.exit(1)

    print(f"   Total leads fetched from DB: {len(leads)}")

    spam_leads = []
    clean_leads = []

    for lead in leads:
        flagged, reason = is_spam(lead)
        if flagged:
            spam_leads.append({
                "id":         lead.get("id", ""),
                "name":       lead.get("name", ""),
                "email":      lead.get("email", ""),
                "channel":    lead.get("channel", ""),
                "created_at": (lead.get("created_at") or "")[:10],
                "status":     lead.get("status", ""),
                "intent":     lead.get("intent", ""),
                "reason":     reason,
            })
        else:
            clean_leads.append(lead)

    print(f"\n📊  DB Audit Results:")
    print(f"   ✅  Legitimate leads : {len(clean_leads)}")
    print(f"   🚨  Spam / auto-emails: {len(spam_leads)}")
    print(f"   📋  Total DB records : {len(leads)}\n")

    # Save CSV report
    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spam_leads_audit.csv")
    if spam_leads:
        with open(report_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["id", "name", "email", "channel", "created_at", "status", "intent", "reason"])
            writer.writeheader()
            writer.writerows(spam_leads)
        print(f"📄  Audit CSV report saved → {report_path}")

        print("\nIdentified spam/newsletter records in Supabase:")
        for s in spam_leads:
            print(f"   • [{s['reason']}]  {s['name']} <{s['email']}>  ({s['created_at']})")

    # Domain breakdown
    domain_counts = {}
    for s in spam_leads:
        email = s.get("email") or ""
        domain = email.split("@")[-1] if "@" in email else "unknown"
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
    if domain_counts:
        print("\n📊  Breakdown by sender domain:")
        for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1]):
            print(f"   {count:3d}×  {domain}")

    if not spam_leads:
        print("✅  No spam leads found in DB!")
        return

    # ── Actions ──────────────────────────────────────────────────────────────
    if flag_confirmed:
        print(f"\n🏷️   Flagging {len(spam_leads)} leads in Supabase as status=SPAM...")
        ok = err = 0
        for s in spam_leads:
            try:
                supabase_patch("leads", s["id"], {
                    "status": "SPAM",
                    "notes": f"[AUTO-FLAGGED: {s['reason']}]"
                })
                ok += 1
            except Exception as e:
                print(f"   ⚠️  Could not flag {s['id']}: {e}")
                err += 1
        print(f"   ✅  Flagged {ok} leads as SPAM in Supabase  ({err} errors)")
        print(f"   ℹ️   These are now marked SPAM in DB without altering Strato.\n")

    elif delete_confirmed:
        print(f"\n🗑️   Deleting {len(spam_leads)} spam leads from Supabase DB...")
        ok = err = 0
        for s in spam_leads:
            try:
                supabase_delete("leads", s["id"])
                ok += 1
            except Exception as e:
                print(f"   ⚠️  Could not delete {s['id']}: {e}")
                err += 1
        print(f"   ✅  Deleted {ok} spam leads from Supabase DB  ({err} errors)\n")

    else:
        print(f"\n💡  Options to execute:")
        print(f"   python backend/cleanup_spam_leads.py --flag    ← mark as SPAM (safe, reversible)")
        print(f"   python backend/cleanup_spam_leads.py --delete  ← permanently delete from Supabase DB\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CAR-AGENTS Safe DB Spam Lead Audit & Cleanup")
    parser.add_argument("--delete", action="store_true", help="Permanently delete all detected spam leads from Supabase DB")
    parser.add_argument("--flag",   action="store_true", help="Flag detected spam leads in Supabase DB with status=SPAM")
    args = parser.parse_args()

    if args.delete:
        confirm = input("⚠️  PERMANENT DELETE FROM SUPABASE DB — type DELETE to confirm: ")
        if confirm.strip() != "DELETE":
            print("Aborted.")
            sys.exit(0)

    run_audit(delete_confirmed=args.delete, flag_confirmed=args.flag)
