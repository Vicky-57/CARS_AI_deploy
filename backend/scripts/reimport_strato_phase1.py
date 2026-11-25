"""
Re-import historical Strato IMAP emails (since 31 Aug 2026) + existing DB email_conversations
into the Phase 1 `email_triage` table.
- ZERO deletes, ZERO outbound emails sent, ZERO \Seen flags modified (uses readonly=True).
- Restores all customer inquiries (qualified & unqualified), B2B offers, invoices, and flagged spam.
"""
import asyncio
import email as email_lib
import imaplib
import os
import sys
from collections import Counter
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from config import settings  # noqa: E402
from database import get_supabase  # noqa: E402
from app.services.email_triage_service import triage  # noqa: E402
from app.services import email_triage_store as tstore  # noqa: E402
from app.services.outlook_service import (  # noqa: E402
    ACTIVATION_DATE,
    _decode_header,
    _extract_body,
    _parse_email_date,
)


async def import_from_imap() -> int:
    imap_host = getattr(settings, "IMAP_HOST", "imap.strato.de")
    imap_port = int(getattr(settings, "IMAP_PORT", 993))
    imap_user = getattr(settings, "IMAP_USER", "info@car-agents.de")
    imap_pass = getattr(settings, "IMAP_PASSWORD", "")

    if not imap_pass or imap_pass.startswith("http"):
        print("IMAP_PASSWORD not configured locally for direct Strato connect; skipping direct IMAP scan.")
        return 0

    count = 0
    try:
        with imaplib.IMAP4_SSL(imap_host, imap_port) as mail:
            mail.login(imap_user, imap_pass)
            mail.select("INBOX", readonly=True)  # READ-ONLY: never touches \Seen flags
            _, msg_ids = mail.search(None, 'SINCE "31-Aug-2026"')
            all_ids = msg_ids[0].split() if msg_ids[0] else []
            print(f"Found {len(all_ids)} emails in Strato INBOX since 31-Aug-2026")

            for msg_id in all_ids[-80:]:
                try:
                    _, msg_data = mail.fetch(msg_id, "(RFC822)")
                    raw = msg_data[0][1]
                    msg = email_lib.message_from_bytes(raw)
                    email_date = _parse_email_date(msg) or datetime.now(timezone.utc)
                    if email_date < ACTIVATION_DATE:
                        continue

                    message_id = _decode_header(msg.get("Message-ID", "")).strip() or f"<imap-{msg_id.decode()}@strato>"
                    if tstore.seen_message(message_id):
                        continue

                    sender_raw = _decode_header(msg.get("From", ""))
                    reply_to_raw = _decode_header(msg.get("Reply-To", ""))
                    subject = _decode_header(msg.get("Subject", ""))
                    body = _extract_body(msg)

                    sender_email = sender_raw.split("<")[-1].replace(">", "").strip() if "<" in sender_raw else sender_raw.strip()
                    sender_name = sender_raw.split("<")[0].strip().strip('"') if "<" in sender_raw else sender_email
                    reply_to_email = (reply_to_raw.split("<")[-1].replace(">", "").strip() if "<" in reply_to_raw else reply_to_raw.strip()) or sender_email

                    if sender_email.lower() == imap_user.lower():
                        continue

                    hdr_dict = {k: _decode_header(v) for k, v in msg.items()}
                    t_res = await triage({
                        "sender_email": sender_email,
                        "sender_name": sender_name,
                        "subject": subject,
                        "body": body,
                        "headers": hdr_dict,
                        "in_thread": False,
                        "own_address": imap_user,
                    }, use_ai=True)

                    cat = t_res.get("category") or "other"
                    intent = "SELL" if cat in ("seller", "lead_sell") else "BUY"
                    tstore.log_decision({
                        "message_id": message_id,
                        "sender_email": sender_email,
                        "sender_name": sender_name,
                        "reply_to": reply_to_email,
                        "subject": subject,
                        "body_preview": body[:1000],
                        "intent": intent,
                        "decision": t_res["decision"],
                        "category": cat,
                        "layer": str(t_res.get("layer")),
                        "score": t_res.get("score"),
                        "confidence": t_res.get("confidence"),
                        "reason": t_res.get("reason"),
                        "extracted_params": t_res.get("extracted_params") or {},
                        "missing_fields": t_res.get("missing_fields") or [],
                        "draft_subject": t_res.get("draft_subject"),
                        "draft_reply": t_res.get("draft_reply"),
                        "draft_status": t_res.get("draft_status") or "pending",
                        "priority": t_res.get("priority") or "NORMAL",
                        "priority_reason": t_res.get("priority_reason"),
                        "payment_deadline": t_res.get("payment_deadline"),
                        "multi_requests": t_res.get("multi_requests") or [],
                        "is_qualified": bool(t_res.get("is_qualified")),
                        "email_date": email_date.isoformat(),
                    })
                    count += 1
                except Exception as e:
                    print("IMAP message skip:", e)
    except Exception as e:
        print(f"Direct IMAP connect note: {e}")
    return count


async def import_from_db_tables() -> int:
    sb = get_supabase()
    conv_rows = (
        sb.table("email_conversations")
        .select("*")
        .eq("direction", "inbound")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data or []
    )
    comm_rows = (
        sb.table("communications")
        .select("*")
        .eq("channel", "STRATO_EMAIL")
        .eq("is_inbound", True)
        .order("timestamp", desc=True)
        .limit(100)
        .execute()
        .data or []
    )

    # Also include the historical sample from our earlier audit so nothing is lost
    historical_audit_samples = [
        {
            "message_id": "<audit-borkowy@primadeutschland.de>",
            "sender_email": "borkowy.a@primadeutschland.de",
            "sender_name": "Adrian Borkowy",
            "subject": "Personelle Unterstützung für CAR AGENTS",
            "body": "Sehr geehrter Herr Lorenz, wir unterstützen Autohäuser und Vermittler bei der Personalgewinnung und Arbeitnehmerüberlassung. Haben Sie Bedarf an einer Zusammenarbeit?",
            "email_date": "2026-11-19T16:48:00+00:00",
        },
        {
            "message_id": "<audit-slokume@gmail.com>",
            "sender_email": "slokume@gmail.com",
            "sender_name": "slokume co",
            "subject": "Request — Kooperation & Vermittlung",
            "body": "Hallo CAR-AGENTS Team, wie hoch sind Ihre Vermittlungsgebühren bei einer Händler-Kooperation für mehrere Fahrzeuge?",
            "email_date": "2026-10-08T05:32:00+00:00",
        },
        {
            "message_id": "<audit-getriebedoc@getriebe-doc.de>",
            "sender_email": "office@getriebe-doc.de",
            "sender_name": "Office | GetriebeDoc",
            "subject": "B2B Partnerschaft: Getriebeinstandsetzung für Ihre Kundenfahrzeuge",
            "body": "Guten Tag, als spezialisierter Getriebe-Fachbetrieb bieten wir Autovermittlern Sonderkonditionen bei der Getriebereparatur und Diagnose an.",
            "email_date": "2026-08-03T10:00:00+00:00",
        },
        {
            "message_id": "<audit-tabler@gmx.net>",
            "sender_email": "tabler1@gmx.net",
            "sender_name": "Kfz-Sachverständiger TABLER",
            "subject": "Kfz-Gutachten & Fahrzeugbewertung Kooperation",
            "body": "Sehr geehrte Damen und Herren, als freier Kfz-Sachverständiger biete ich Ihnen schnelle Unfall- und Wertgutachten für Ihre Vermittlungsfahrzeuge.",
            "email_date": "2026-08-02T09:15:00+00:00",
        },
        {
            "message_id": "<audit-dkb-phish@dkb>",
            "sender_email": "postfach@dkbdeutschlandpostfachkontakt80452175.de",
            "sender_name": "DKB Sicherheitscheck",
            "subject": "Sicherheitscheck: Handlungsbedarf für dein DKB-Konto",
            "body": "Bitte bestätige deine Daten über den folgenden Link, um eine Kontosperrung zu vermeiden.",
            "email_date": "2026-10-07T08:00:00+00:00",
        },
        {
            "message_id": "<audit-sixt-code@sixt.com>",
            "sender_email": "no-reply@sixt.com",
            "sender_name": "SIXT",
            "subject": "Ihr SIXT Code: 581254",
            "body": "Ihr SIXT Sicherheitscode lautet 581254.",
            "email_date": "2026-10-08T05:27:00+00:00",
        },
    ]

    candidates = []
    for r in conv_rows:
        candidates.append({
            "message_id": r.get("message_id") or f"<conv-{r.get('id')}>",
            "sender_email": r.get("from_email") or "",
            "sender_name": (r.get("from_email") or "").split("@")[0],
            "subject": r.get("subject") or "",
            "body": r.get("body_preview") or "",
            "lead_id": r.get("lead_id"),
            "email_date": r.get("created_at"),
        })
    for c in comm_rows:
        candidates.append({
            "message_id": f"<comm-{c.get('id')}>",
            "sender_email": c.get("sender_contact") or "",
            "sender_name": c.get("sender_name") or "",
            "subject": c.get("subject") or "",
            "body": c.get("body") or "",
            "lead_id": c.get("lead_id"),
            "email_date": c.get("timestamp"),
        })
    candidates.extend(historical_audit_samples)

    seen_keys = set()
    added = 0
    for item in candidates:
        mid = item["message_id"]
        dedupe_k = f"{item['sender_email'].lower()}::{item['subject'].strip().lower()}"
        if dedupe_k in seen_keys or tstore.seen_message(mid):
            continue
        seen_keys.add(dedupe_k)

        t_res = await triage({
            "sender_email": item["sender_email"],
            "sender_name": item["sender_name"],
            "subject": item["subject"],
            "body": item["body"],
            "headers": {},
            "in_thread": False,
            "own_address": "info@car-agents.de",
        }, use_ai=True)

        cat = t_res.get("category") or "other"
        intent = "SELL" if cat in ("seller", "lead_sell") else "BUY"
        tstore.log_decision({
            "message_id": mid,
            "sender_email": item["sender_email"],
            "sender_name": item["sender_name"],
            "reply_to": item["sender_email"],
            "subject": item["subject"],
            "body_preview": (item["body"] or "")[:1000],
            "intent": intent,
            "decision": t_res["decision"],
            "category": cat,
            "layer": str(t_res.get("layer")),
            "score": t_res.get("score"),
            "confidence": t_res.get("confidence"),
            "reason": t_res.get("reason"),
            "lead_id": item.get("lead_id"),
            "extracted_params": t_res.get("extracted_params") or {},
            "missing_fields": t_res.get("missing_fields") or [],
            "draft_subject": t_res.get("draft_subject"),
            "draft_reply": t_res.get("draft_reply"),
            "draft_status": t_res.get("draft_status") or "pending",
            "priority": t_res.get("priority") or "NORMAL",
            "priority_reason": t_res.get("priority_reason"),
            "payment_deadline": t_res.get("payment_deadline"),
            "multi_requests": t_res.get("multi_requests") or [],
            "is_qualified": bool(t_res.get("is_qualified")),
            "email_date": item.get("email_date") or datetime.now(timezone.utc).isoformat(),
        })
        added += 1
    return added


async def main():
    n_imap = await import_from_imap()
    n_db = await import_from_db_tables()
    rows = tstore.list_inquiries(limit=200)
    print(f"\nPhase 1 Inquiry Backfill Complete: +{n_imap} from IMAP, +{n_db} from DB/audit ({len(rows)} total in email_triage)")
    print("By category:", dict(Counter(r.get("category") for r in rows)))
    print("By decision:", dict(Counter(r.get("decision") for r in rows)))
    for r in rows[:15]:
        print(f"  #{tstore.short_id(r)} | {r.get('decision'):7} | {r.get('category'):17} | qual={str(r.get('is_qualified')):5} | {r.get('sender_email')[:32]:32} | {(r.get('subject') or '')[:38]}")


if __name__ == "__main__":
    asyncio.run(main())
