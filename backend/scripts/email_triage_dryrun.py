"""
Dry-run the email triage over stored inbound mails (NO replies, NO writes).
  python backend/scripts/email_triage_dryrun.py          # rules only (Layers 0-1)
  python backend/scripts/email_triage_dryrun.py --ai     # + Claude Haiku (Layer 2)
"""
import asyncio
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from database import get_supabase  # noqa: E402
from app.services.email_triage_service import triage  # noqa: E402


async def main(use_ai: bool):
    sb = get_supabase()
    rows = sb.table("email_conversations").select("from_email,subject,body_preview,created_at") \
        .eq("direction", "inbound").order("created_at", desc=True).limit(200).execute().data or []
    seen = set()
    mails = []
    for r in rows:  # one row per sender+subject
        key = (r.get("from_email"), r.get("subject"))
        if key in seen:
            continue
        seen.add(key)
        mails.append({
            "sender_email": r.get("from_email") or "", "subject": r.get("subject") or "",
            "body": r.get("body_preview") or "", "headers": {}, "in_thread": False,
            "own_address": "info@car-agents.de",
        })
    print(f"Triaging {len(mails)} distinct inbound mails (AI={'on' if use_ai else 'off'})\n")
    tally = Counter()
    for m in mails:
        res = await triage(m, use_ai=use_ai)
        tally[res["decision"]] += 1
        conf = f"{res['confidence']:.2f}" if res["confidence"] is not None else " -  "
        print(f"{res['decision']:7} L{res['layer']!s:<2} s={res['score']:+d} c={conf} {res['category']:17} "
              f"{m['sender_email'][:34]:34} | {m['subject'][:42]:42} | {res['reason'][:60]}")
    print("\nSummary:", dict(tally))


if __name__ == "__main__":
    asyncio.run(main("--ai" in sys.argv))
