"""
Audit & delete non-genuine STRATO_EMAIL leads and their junk email_conversations.
Usage:
  python backend/scripts/cleanup_junk_email_leads.py            # dry-run report only
  python backend/scripts/cleanup_junk_email_leads.py --apply    # delete junk rows from Supabase
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from database import get_supabase  # noqa: E402
from app.services.email_triage_service import triage  # noqa: E402


async def main(apply_delete: bool):
    sb = get_supabase()
    leads = (
        sb.table("leads")
        .select("id,name,email,status,qualification_stage,notes,created_at")
        .eq("channel", "STRATO_EMAIL")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
        or []
    )
    projects = sb.table("projects").select("*").execute().data or []
    protected_lead_ids = {p.get("lead_id") for p in projects if p.get("lead_id")}
    protected_emails = {(p.get("client_email") or "").lower().strip() for p in projects if p.get("client_email")}

    keep = []
    remove = []

    for l in leads:
        em = (l.get("email") or "").strip()
        notes = l.get("notes") or ""
        subj = ""
        body = notes
        if notes.startswith("Subject:"):
            first, _, rest = notes.partition("\n")
            subj = first.replace("Subject:", "").strip()
            body = rest.strip()

        if l["id"] in protected_lead_ids or em.lower() in protected_emails:
            keep.append((l, "linked to active project"))
            continue

        res = await triage(
            {
                "sender_email": em,
                "sender_name": l.get("name") or "",
                "subject": subj or (l.get("name") or ""),
                "body": body or (l.get("name") or "") * 3,
                "headers": {},
                "in_thread": False,
                "own_address": "info@car-agents.de",
            },
            use_ai=True,
        )
        if res["decision"] in ("lead", "review", "reply"):
            keep.append((l, f"{res['decision']} ({res['category']}: {res['reason']})"))
        else:
            remove.append((l, f"L{res['layer']} {res['category']}: {res['reason']}"))

    print(f"Total STRATO_EMAIL leads audited: {len(leads)}")
    print(f"  KEEP  : {len(keep)}")
    for l, why in keep:
        print(f"    + {str(l.get('created_at'))[:10]} | {l.get('email')!s:38} | {str(l.get('name'))[:24]:24} | {why}")
    print(f"\n  DELETE: {len(remove)}")
    for l, why in remove:
        print(f"    - {str(l.get('created_at'))[:10]} | {l.get('email')!s:38} | {str(l.get('name'))[:24]:24} | {why}")

    if apply_delete and remove:
        ids = [l["id"] for l, _ in remove]
        junk_emails = [l.get("email") for l, _ in remove if l.get("email")]
        try:
            sb.table("email_conversations").delete().in_("lead_id", ids).execute()
        except Exception as e:
            print("email_conversations delete by lead_id warning:", e)
        try:
            sb.table("email_conversations").delete().in_("from_email", junk_emails).execute()
            sb.table("email_conversations").delete().in_("to_email", junk_emails).execute()
        except Exception as e:
            print("email_conversations delete by email warning:", e)
        try:
            sb.table("communications").delete().in_("lead_id", ids).execute()
        except Exception as e:
            print("communications delete warning:", e)
        sb.table("leads").delete().in_("id", ids).execute()
        print(f"\nDeleted {len(ids)} junk STRATO_EMAIL leads and their conversation rows.")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
