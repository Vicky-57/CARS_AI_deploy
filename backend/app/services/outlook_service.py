"""
app/services/outlook_service.py
────────────────────────────────────────────────────────────────────────
Microsoft Outlook 365 Integration Service

Two modes:
  1. iCal (ICS) Feed — Instant, zero-auth private calendar URL.
     Maxim pastes his private Outlook ICS URL in Settings.
  2. IMAP/SMTP  — Polls info@car-agents.de (Strato) via standard IMAP.

Responsibilities:
  - poll_outlook_inbound_emails()  → Reads new inbound emails, creates leads
  - get_todays_schedule()          → Returns today's events from Outlook ICS feed
  - check_calendar_conflict()      → Checks if a proposed time conflicts w/ 30-min buffer
────────────────────────────────────────────────────────────────────────
"""
import imaplib
import email as email_lib
import logging
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from config import settings
from database import get_supabase

logger = logging.getLogger("outlook_service")


# ─── Calendar: ICS Feed Reader ───────────────────────────────────────────────

def _parse_ics_events(ics_content: str) -> List[Dict]:
    """Parse an .ICS feed and return a list of event dicts for today."""
    events = []
    today = datetime.now(timezone.utc).date()

    current = {}
    in_event = False

    for line in ics_content.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            in_event = True
            current = {}
        elif line == "END:VEVENT" and in_event:
            in_event = False
            dtstart = current.get("dtstart", "")
            if dtstart:
                try:
                    dt_clean = dtstart.replace("Z", "").split("T")[0].replace("-", "")
                    event_date = datetime.strptime(dt_clean[:8], "%Y%m%d").date()
                    if event_date == today:
                        time_part = dtstart.split("T")[1][:4] if "T" in dtstart else ""
                        human_time = f"{time_part[:2]}:{time_part[2:]}" if len(time_part) >= 4 else "All Day"
                        events.append({
                            "subject": current.get("summary", "No Subject"),
                            "time": human_time,
                            "location": current.get("location", ""),
                            "dtstart": dtstart,
                        })
                except Exception:
                    pass
        elif in_event:
            if line.startswith("SUMMARY:"):
                current["summary"] = line[8:].replace("\\,", ",").replace("\\;", ";")
            elif line.startswith("DTSTART"):
                current["dtstart"] = line.split(":", 1)[-1]
            elif line.startswith("LOCATION:"):
                current["location"] = line[9:].replace("\\,", ",").replace("\\;", ";")

    events.sort(key=lambda e: e.get("dtstart", ""))
    return events


def _parse_ics_all_events(ics_content: str) -> List[Dict]:
    """Parse all events from an .ICS feed into standard event dicts for Calendar.jsx."""
    events = []
    current = {}
    in_event = False

    for line in ics_content.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            in_event = True
            current = {}
        elif line == "END:VEVENT" and in_event:
            in_event = False
            dtstart_raw = current.get("dtstart", "")
            dtend_raw = current.get("dtend", "")
            summary = current.get("summary", "Outlook Event")
            location = current.get("location", "")
            uid = current.get("uid", f"evt_{len(events)}")

            if dtstart_raw:
                try:
                    val_s = dtstart_raw.split(":")[-1].replace("Z", "")
                    if "T" in val_s:
                        ds, ts = val_s.split("T")
                        dt_start = datetime(int(ds[:4]), int(ds[4:6]), int(ds[6:8]), int(ts[:2]), int(ts[2:4]))
                    else:
                        dt_start = datetime(int(val_s[:4]), int(val_s[4:6]), int(val_s[6:8]), 0, 0)
                    
                    if dtend_raw:
                        val_e = dtend_raw.split(":")[-1].replace("Z", "")
                        if "T" in val_e:
                            de, te = val_e.split("T")
                            dt_end = datetime(int(de[:4]), int(de[4:6]), int(de[6:8]), int(te[:2]), int(te[2:4]))
                        else:
                            dt_end = datetime(int(val_e[:4]), int(val_e[4:6]), int(val_e[6:8]), 23, 59)
                    else:
                        dt_end = dt_start + timedelta(hours=1)

                    events.append({
                        "id": f"outlook_{uid[:30]}",
                        "title": summary,
                        "start_time": dt_start.isoformat() + "Z",
                        "end_time": dt_end.isoformat() + "Z",
                        "location_address": location,
                        "location_type": "OFFLINE_ONSITE" if location else "ONLINE",
                        "source": "outlook",
                        "client_name": None,
                        "notes": "Synced from Microsoft Outlook Calendar"
                    })
                except Exception:
                    pass
        elif in_event:
            if line.startswith("SUMMARY:"):
                current["summary"] = line[8:].replace("\\,", ",").replace("\\;", ";")
            elif line.startswith("DTSTART"):
                current["dtstart"] = line.split(":", 1)[-1]
            elif line.startswith("DTEND"):
                current["dtend"] = line.split(":", 1)[-1]
            elif line.startswith("LOCATION:"):
                current["location"] = line[9:].replace("\\,", ",").replace("\\;", ";")
            elif line.startswith("UID:"):
                current["uid"] = line[4:]

    return events


async def get_todays_schedule() -> List[Dict]:
    """
    Fetch today's events merged from BOTH:
    1. Microsoft Outlook ICS feed
    2. Supabase DB 'meetings' table
    """
    events = []
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Fetch from Outlook ICS
    ics_url = getattr(settings, "OUTLOOK_ICS_URL", None)
    if ics_url:
        try:
            req = urllib.request.Request(ics_url, headers={"User-Agent": "CAR-AGENTS/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                ics_content = r.read().decode("utf-8", errors="ignore")
            events.extend(_parse_ics_events(ics_content))
        except Exception as e:
            logger.error(f"ICS fetch error: {e}")

    # 2. Fetch from Supabase DB meetings table
    try:
        sb = get_supabase()
        db_meetings = sb.table("meetings").select("*").execute().data or []
        for m in db_meetings:
            start_iso = m.get("start_time", "")
            if start_iso and start_iso.startswith(today_str):
                time_str = start_iso.split("T")[1][:5] if "T" in start_iso else "All Day"
                title = m.get("title") or m.get("subject") or "Client Meeting"
                if m.get("client_name"):
                    title += f" (w/ {m.get('client_name')})"
                events.append({
                    "subject": title,
                    "time": time_str,
                    "location": m.get("location_address") or m.get("location") or "",
                    "dtstart": start_iso,
                    "source": "database"
                })
    except Exception as db_err:
        logger.warning(f"DB meetings fetch error for schedule: {db_err}")

    # Sort all events by time
    events.sort(key=lambda e: (e.get("time", ""), e.get("dtstart", "")))
    return events


async def get_outlook_events(time_min: str = None, time_max: str = None) -> Dict:
    """Fetch and parse Outlook ICS events for portal calendar display."""
    ics_url = getattr(settings, "OUTLOOK_ICS_URL", None)
    if not ics_url:
        return {"connected": False, "events": []}

    try:
        req = urllib.request.Request(ics_url, headers={"User-Agent": "CAR-AGENTS/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            ics_content = r.read().decode("utf-8", errors="ignore")
        events = _parse_ics_all_events(ics_content)

        # Filter by time_min and time_max if provided
        if time_min or time_max:
            filtered = []
            for evt in events:
                evt_start = evt["start_time"]
                if time_min and evt_start < time_min:
                    continue
                if time_max and evt_start > time_max:
                    continue
                filtered.append(evt)
            events = filtered

        return {"connected": True, "events": events}
    except Exception as e:
        logger.error(f"Outlook events fetch error: {e}")
        return {"connected": False, "events": []}


async def check_calendar_conflict(
    proposed_dt: datetime,
    duration_minutes: int = 60,
    travel_buffer_minutes: int = 30
) -> Dict:
    """
    Check if a proposed meeting time conflicts with any Outlook events.
    Adds a configurable travel buffer for offsite/onsite viewings.
    Returns: {"conflict": bool, "reason": str, "blocking_events": list}
    """
    events = await get_todays_schedule()
    buffered_start = proposed_dt - timedelta(minutes=travel_buffer_minutes)
    buffered_end = proposed_dt + timedelta(minutes=duration_minutes + travel_buffer_minutes)

    blocking = []
    for evt in events:
        try:
            ds = evt.get("dtstart", "")
            dt_clean = ds.replace("Z", "").split("T")
            if len(dt_clean) >= 2:
                event_dt = datetime.strptime(dt_clean[0] + dt_clean[1][:6], "%Y%m%d%H%M%S")
            else:
                continue
            event_end = event_dt + timedelta(hours=1)
            if not (event_end <= buffered_start or event_dt >= buffered_end):
                blocking.append(evt)
        except Exception:
            continue

    return {
        "conflict": len(blocking) > 0,
        "proposed_time": proposed_dt.strftime("%Y-%m-%d %H:%M"),
        "travel_buffer_minutes": travel_buffer_minutes,
        "blocking_events": blocking,
        "reason": f"{len(blocking)} overlapping appointment(s) found (incl. {travel_buffer_minutes}-min travel buffer)." if blocking else "No conflicts found."
    }


# ─── Email: IMAP Lead Poller ─────────────────────────────────────────────────

async def poll_outlook_inbound_emails() -> List[Dict]:
    """
    Polls the Strato IMAP inbox (info@car-agents.de) for new unread emails.
    Auto-creates leads in Supabase for new inquiries.
    Replaces the old Gmail-based polling workflow.
    """
    imap_host = getattr(settings, "IMAP_HOST", "mail.strato.de")
    imap_port = int(getattr(settings, "IMAP_PORT", 993))
    imap_user = getattr(settings, "IMAP_USER", "info@car-agents.de")
    imap_pass = getattr(settings, "IMAP_PASSWORD", "")

    if not imap_pass:
        logger.warning("IMAP_PASSWORD not configured. Skipping email poll.")
        return []

    created_leads = []

    try:
        with imaplib.IMAP4_SSL(imap_host, imap_port) as mail:
            mail.login(imap_user, imap_pass)
            mail.select("INBOX")
            _, msg_ids = mail.search(None, "UNSEEN")
            ids = msg_ids[0].split()[-20:]  # Process up to 20 new emails

            for msg_id in ids:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                raw = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw)

                sender = msg.get("From", "")
                subject = msg.get("Subject", "")
                body = ""

                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            try:
                                body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                            except Exception:
                                pass
                            break
                else:
                    try:
                        body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                    except Exception:
                        pass

                # Basic intent detection
                body_lower = body.lower()
                subject_lower = subject.lower()
                intent = "SELL_INTENT" if any(w in body_lower + subject_lower for w in ["verkaufen", "verkauf", "sell", "anbieten"]) else "BUY_INTENT"
                pipeline = "SELL" if intent == "SELL_INTENT" else "BUY"

                # Extract sender name & email
                sender_email = sender.split("<")[-1].replace(">", "").strip() if "<" in sender else sender
                sender_name = sender.split("<")[0].strip().strip('"') if "<" in sender else sender_email

                # Create lead in Supabase
                try:
                    sb = get_supabase()
                    lead_data = {
                        "name": sender_name or sender_email,
                        "email": sender_email,
                        "intent": intent,
                        "channel": "OUTLOOK_EMAIL",
                        "status": "NEW",
                        "notes": f"Subject: {subject}\n\n{body[:500]}",
                    }
                    sb.table("leads").insert(lead_data).execute()
                    created_leads.append(lead_data)
                    logger.info(f"New lead created from Outlook email: {sender_name}")
                except Exception as db_err:
                    logger.error(f"Lead creation error for email from {sender}: {db_err}")

                # Mark as read
                mail.store(msg_id, "+FLAGS", "\\Seen")

    except Exception as e:
        logger.error(f"IMAP poll error: {e}")

    if created_leads:
        logger.info(f"Outlook email poll: {len(created_leads)} new lead(s) created.")

    return created_leads
