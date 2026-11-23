"""Read-only check: is the Strato email poller producing rows? Usage: python backend/scripts/email_sync_check.py"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from database import get_supabase  # noqa: E402

sb = get_supabase()

conv = sb.table("email_conversations").select("direction,from_email,subject,qualification_stage,created_at") \
    .order("created_at", desc=True).limit(40).execute().data or []
print(f"email_conversations (latest {len(conv)}):")
for c in conv[:12]:
    print(f"  {str(c.get('created_at'))[:16]} {c.get('direction'):8} {c.get('qualification_stage')!s:12} {c.get('from_email')!s:35} {str(c.get('subject'))[:50]}")
print("  directions:", dict(Counter(c.get("direction") for c in conv)))

leads = sb.table("leads").select("name,email,status,qualification_stage,created_at").eq("channel", "STRATO_EMAIL") \
    .order("created_at", desc=True).limit(200).execute().data or []
print(f"\nSTRATO_EMAIL leads: {len(leads)}")
print("  stages:", dict(Counter(l.get("qualification_stage") for l in leads)))
for l in leads[:15]:
    print(f"  {str(l.get('created_at'))[:10]} {l.get('qualification_stage')!s:12} {l.get('email')!s:38} {str(l.get('name'))[:25]}")
