"""
backend/cleanup_spam_leads.py
────────────────────────────────────────────────────────────────────────
One-time audit script: finds and reports spam/newsletter leads in Supabase.

Outputs a CSV report of suspected spam leads for manual review.
Does NOT auto-delete anything — you review first, then decide.

Usage:
    cd backend
    python cleanup_spam_leads.py

After reviewing spam_leads_audit.csv, you can:
  1. Delete confirmed spam: python cleanup_spam_leads.py --delete
  2. Or flag them: python cleanup_spam_leads.py --flag
────────────────────────────────────────────────────────────────────────
"""
import sys
import os
import csv
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_supabase

# ── Spam detection patterns (mirrors outlook_service.py) ─────────────────────
SPAM_SENDER_DOMAINS = {
    "linkedin.com", "facebook.com", "instagram.com", "twitter.com",
    "x.com", "xing.com", "youtube.com", "tiktok.com",
    "paypal.com", "klarna.com", "stripe.com", "mollie.com",
    "dhl.de", "dhl.com", "dpd.de", "hermes.de", "fedex.com", "ups.com",
    "gls-group.eu", "deutschepost.de",
    "booking.com", "airbnb.com", "expedia.com",
    "google.com", "googlealerts.com", "accounts.google.com",
    "github.com", "notifications.github.com",
    "slack.com", "notion.so", "atlassian.com",
    "mailchimp.com", "sendgrid.net", "constantcontact.com",
    "hubspot.com", "salesforce.com",
    "amazon.com", "amazon.de", "ebay.de", "ebay.com",
    "noreply.de", "no-reply.de",
}

SPAM_NAME_PATTERNS = {
    "linkedin", "facebook", "instagram", "twitter", "xing",
    "newsletter", "noreply", "no-reply", "do-not-reply",
    "notification", "automated", "mailer-daemon",
    "dhl", "dpd", "hermes", "fedex", "ups",
    "paypal", "klarna", "stripe",
    "booking.com", "airbnb",
    "google alerts",
}

SPAM_NOTE_KEYWORDS = {
    "newsletter", "unsubscribe", "tracking", "paket", "sendung",
    "kontoauszug", "lastschrift", "rechnung", "invoice", "billing",
    "rabatt", "% off", "promo", "gutschein", "coupon",
    "linkedin", "facebook", "instagram", "xing",
    "delivery failed", "mailer-daemon", "bounce",
    "password reset", "passwort", "verifizierung", "verify",
    "dhl", "dpd", "hermes",
}


def is_spam_lead(lead: dict) -> tuple[bool, str]:
    """Returns (is_spam, reason)."""
    email = (lead.get("email") or "").lower()
    name = (lead.get("name") or "").lower()
    notes = (lead.get("notes") or "").lower()
    source = (lead.get("source") or "").lower()

    # Check sender domain
    if "@" in email:
        domain = email.split("@")[-1]
        if domain in SPAM_SENDER_DOMAINS:
            return True, f"Blocked domain: {domain}"

    # Check name patterns
    for pattern in SPAM_NAME_PATTERNS:
        if pattern in name:
            return True, f"Spam name pattern: '{pattern}'"

    # Check notes for spam keywords
    spam_kws_found = [kw for kw in SPAM_NOTE_KEYWORDS if kw in notes]
    if len(spam_kws_found) >= 2:
        return True, f"Spam keywords in notes: {', '.join(spam_kws_found[:3])}"

    # Suspiciously short names from email source
    if source in ("strato_imap", "email") and len(name) < 3:
        return True, "Very short name from email source"

    # noreply / automated email addresses
    if any(p in email for p in ("noreply", "no-reply", "donotreply", "mailer-daemon", "bounce")):
        return True, f"Automated email address: {email}"

    return False, ""


def run_audit(delete_confirmed: bool = False, flag_confirmed: bool = False):
    sb = get_supabase()
    
    print("🔍 Fetching all leads from Supabase...")
    result = sb.table("leads").select("*").order("created_at", desc=True).execute()
    leads = result.data or []
    print(f"   Total leads: {len(leads)}")

    spam_leads = []
    clean_leads = []

    for lead in leads:
        is_spam, reason = is_spam_lead(lead)
        if is_spam:
            spam_leads.append({**lead, "_spam_reason": reason})
        else:
            clean_leads.append(lead)

    print(f"\n📊 Audit Results:")
    print(f"   ✅ Clean leads:  {len(clean_leads)}")
    print(f"   🚨 Spam leads:   {len(spam_leads)}")
    print(f"   📋 Total:        {len(leads)}")

    # Write CSV report
    report_path = os.path.join(os.path.dirname(__file__), "spam_leads_audit.csv")
    with open(report_path, "w", newline="", encoding="utf-8") as f:
        if spam_leads:
            fieldnames = ["id", "name", "email", "source", "created_at", "status", "intent", "_spam_reason"]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(spam_leads)
    
    print(f"\n📄 Spam leads report saved to: {report_path}")
    print(f"   → Review this file, then run with --delete or --flag to take action.\n")

    if delete_confirmed and spam_leads:
        print(f"🗑️  Deleting {len(spam_leads)} spam leads...")
        spam_ids = [l["id"] for l in spam_leads]
        for spam_id in spam_ids:
            try:
                sb.table("leads").delete().eq("id", spam_id).execute()
            except Exception as e:
                print(f"   Warning: could not delete {spam_id}: {e}")
        print(f"   ✅ Deleted {len(spam_ids)} spam leads.")

    elif flag_confirmed and spam_leads:
        print(f"🏷️  Flagging {len(spam_leads)} spam leads with status='SPAM'...")
        for lead in spam_leads:
            try:
                sb.table("leads").update({"status": "SPAM", "notes": (lead.get("notes") or "") + f"\n[AUTO-FLAGGED: {lead['_spam_reason']}]"}).eq("id", lead["id"]).execute()
            except Exception as e:
                print(f"   Warning: could not flag {lead['id']}: {e}")
        print(f"   ✅ Flagged {len(spam_leads)} leads as SPAM.")

    # Summary of spam by domain
    domain_counts = {}
    for lead in spam_leads:
        email = lead.get("email") or ""
        domain = email.split("@")[-1] if "@" in email else "unknown"
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
    
    if domain_counts:
        print("📊 Spam breakdown by sender domain:")
        for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1])[:15]:
            print(f"   {count:3d}x  {domain}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CAR-AGENTS Spam Lead Audit & Cleanup")
    parser.add_argument("--delete", action="store_true", help="Auto-delete all detected spam leads (irreversible!)")
    parser.add_argument("--flag", action="store_true", help="Flag detected spam leads with status=SPAM (reversible)")
    args = parser.parse_args()

    if args.delete:
        confirm = input("⚠️  This will PERMANENTLY DELETE spam leads. Type 'DELETE' to confirm: ")
        if confirm != "DELETE":
            print("Aborted.")
            sys.exit(0)

    run_audit(delete_confirmed=args.delete, flag_confirmed=args.flag)
