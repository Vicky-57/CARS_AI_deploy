"""
DRY RUN TEST — Strato Email Lead Qualification
Temporarily sets ACTIVATION_DATE to 2026-08-24 to test with last week's emails.
DRY_RUN=true so zero emails are sent. All reply drafts saved to ./dry_run_emails/
"""
import asyncio
import os
import sys

# Force dry run and set test cutoff
os.environ["DRY_RUN"] = "true"
os.environ["IMAP_PASSWORD"] = "https://car-agents.de/"
os.environ["SMTP_PASSWORD"] = "https://car-agents.de/"
os.environ["IMAP_HOST"] = "imap.strato.de"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Patch the activation date for testing (Aug 24 to pick up last week's emails)
import app.services.outlook_service as svc
from datetime import datetime, timezone
svc.ACTIVATION_DATE = datetime(2026, 8, 24, 0, 0, 0, tzinfo=timezone.utc)
svc.DRY_RUN = True

print(f"DRY RUN mode: {svc.DRY_RUN}")
print(f"Activation cutoff: {svc.ACTIVATION_DATE.date()}")
print("Starting email poll...\n")

result = asyncio.run(svc.poll_outlook_inbound_emails())

print(f"\nTotal processed: {len(result)}")
for r in result:
    print(f"  - {r.get('email')} → stage: {r.get('stage')}")

dry_dir = os.path.join(os.path.dirname(__file__), "dry_run_emails")
if os.path.exists(dry_dir):
    files = os.listdir(dry_dir)
    print(f"\nDry run email drafts saved ({len(files)} files):")
    for f in files[:10]:
        print(f"  {f}")
else:
    print("\nNo dry_run_emails folder found (no emails matched criteria)")
