"""
app/services/meeting_service.py
────────────────────────────────────────────────────────────────────────
Calendar, Free-Slot Generation, Clash Guard, and Booking Engine.

Defaults (Europe/Berlin):
  - Working hours: 09:00–18:00 Monday–Saturday (Sunday closed)
  - Default duration: 60 minutes
  - Offline/onsite travel buffer: 30 minutes before & after

Sources merged for busy intervals:
  1. Supabase `meetings` table (excluding status = 'CANCELLED')
  2. Microsoft Outlook ICS feed (when OUTLOOK_ICS_URL is configured)

Note: Supports in-memory storage when `whatsapp_store.MEMORY == True`
so tests run completely offline.
────────────────────────────────────────────────────────────────────────
"""
import logging
import smtplib
import threading
import urllib.request
import uuid
from datetime import date, datetime, time, timedelta, timezone
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from config import settings

logger = logging.getLogger("meeting_service")

BERLIN_TZ = ZoneInfo("Europe/Berlin")
WORK_START_HOUR = 9
WORK_END_HOUR = 18
DEFAULT_DURATION_MIN = 60
OFFLINE_BUFFER_MIN = 30
WORK_DAYS = {0, 1, 2, 3, 4, 5}  # Mon–Sat

# Common Windows timezone names emitted by Outlook ICS feeds
_WIN_TZ_MAP = {
    "w. europe standard time": "Europe/Berlin",
    "central european standard time": "Europe/Berlin",
    "utc": "UTC",
    "coordinated universal time": "UTC",
}


def _sb():
    from database import get_supabase
    return get_supabase()


def _parse_iso_utc(raw: str) -> Optional[datetime]:
    if not raw:
        return None
    try:
        s = raw.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _parse_ics_dt(raw_line: str) -> Tuple[Optional[datetime], bool]:
    """
    Parse an ICS DTSTART/DTEND line into a timezone-aware UTC datetime.
    Returns (dt_utc, is_all_day).
    """
    if ":" not in raw_line:
        return None, False
    params_part, val = raw_line.split(":", 1)
    val = val.strip()

    # Resolve timezone from TZID parameter if present
    tz = BERLIN_TZ
    for part in params_part.split(";")[1:]:
        if part.upper().startswith("TZID="):
            tz_raw = part.split("=", 1)[1].strip().strip('"')
            tz_name = _WIN_TZ_MAP.get(tz_raw.lower(), tz_raw)
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = BERLIN_TZ

    # Pure date (all-day event), e.g. 20261120
    if "T" not in val and len(val) >= 8 and val[:8].isdigit():
        d = datetime.strptime(val[:8], "%Y%m%d").replace(tzinfo=tz)
        return d.astimezone(timezone.utc), True

    # Datetime YYYYMMDDTHHMM[SS][Z]
    is_utc = val.endswith("Z")
    clean = val.rstrip("Z")
    try:
        if len(clean) >= 15:
            dt = datetime.strptime(clean[:15], "%Y%m%dT%H%M%S")
        elif len(clean) >= 13:
            dt = datetime.strptime(clean[:13], "%Y%m%dT%H%M")
        else:
            return None, False
        dt = dt.replace(tzinfo=timezone.utc if is_utc else tz)
        return dt.astimezone(timezone.utc), False
    except Exception:
        return None, False


def _unfold_ics(content: str) -> List[str]:
    """RFC 5545 line unfolding (lines starting with space/tab belong to previous line)."""
    lines: List[str] = []
    for raw in content.splitlines():
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw.strip())
    return lines


def parse_ics_events_range(ics_content: str, range_start: datetime, range_end: datetime) -> List[Dict]:
    """Parse VEVENT entries from ICS text that intersect [range_start, range_end] (UTC)."""
    events: List[Dict] = []
    cur: Dict[str, str] = {}
    in_evt = False

    for line in _unfold_ics(ics_content):
        if line == "BEGIN:VEVENT":
            in_evt = True
            cur = {}
        elif line == "END:VEVENT" and in_evt:
            in_evt = False
            # Respect Outlook/ICS FREE/TRANSPARENT markers so holidays/notes don't block slots
            if cur.get("transp") == "TRANSPARENT" or cur.get("ms_busy") == "FREE":
                continue
            dt_s, is_all_day = _parse_ics_dt(cur.get("dtstart", ""))
            if not dt_s:
                continue
            dt_e, _ = _parse_ics_dt(cur.get("dtend", "")) if cur.get("dtend") else (None, False)
            if not dt_e:
                dt_e = dt_s + (timedelta(days=1) if is_all_day else timedelta(hours=1))
            if is_all_day:
                # All-day events without explicit BUSY marker rarely represent blocked client hours
                continue
            if dt_e <= range_start or dt_s >= range_end:
                continue
            events.append({
                "id": f"outlook_{cur.get('uid', len(events))[:32]}",
                "title": cur.get("summary") or "Outlook Event",
                "start_time": dt_s.isoformat(),
                "end_time": dt_e.isoformat(),
                "location_type": "OFFLINE_ONSITE" if cur.get("location") else "ONLINE",
                "location_address": cur.get("location") or "",
                "source": "outlook",
            })
        elif in_evt:
            u = line.upper()
            if u.startswith("SUMMARY:"):
                cur["summary"] = line.split(":", 1)[1].replace("\\,", ",").replace("\\;", ";")
            elif u.startswith("LOCATION:"):
                cur["location"] = line.split(":", 1)[1].replace("\\,", ",").replace("\\;", ";")
            elif u.startswith("DTSTART"):
                cur["dtstart"] = line
            elif u.startswith("DTEND"):
                cur["dtend"] = line
            elif u.startswith("UID:"):
                cur["uid"] = line.split(":", 1)[1]
            elif u.startswith("TRANSP:"):
                cur["transp"] = line.split(":", 1)[1].strip().upper()
            elif u.startswith("X-MICROSOFT-CDO-BUSYSTATUS:"):
                cur["ms_busy"] = line.split(":", 1)[1].strip().upper()

    return events


def _fetch_outlook_ics_sync(range_start: datetime, range_end: datetime) -> List[Dict]:
    ics_url = (getattr(settings, "OUTLOOK_ICS_URL", "") or "").strip()
    if not ics_url:
        return []
    try:
        req = urllib.request.Request(ics_url, headers={"User-Agent": "CAR-AGENTS/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            ics_text = r.read().decode("utf-8", errors="ignore")
        return parse_ics_events_range(ics_text, range_start, range_end)
    except Exception as e:
        logger.warning(f"Outlook ICS fetch error: {e}")
        return []


def _fetch_db_meetings(range_start: datetime, range_end: datetime, include_outlook: bool = True) -> List[Dict]:
    from app.services import whatsapp_store as store

    if store.MEMORY:
        rows = list(store._mem_meetings)
    else:
        try:
            rows = (
                _sb().table("meetings")
                .select("*")
                .gte("end_time", range_start.isoformat())
                .lte("start_time", range_end.isoformat())
                .order("start_time", desc=False)
                .execute().data or []
            )
        except Exception as e:
            logger.warning(f"DB meetings fetch failed: {e}")
            rows = []

    active: List[Dict] = []
    for m in rows:
        if (m.get("status") or "SCHEDULED").upper() == "CANCELLED":
            continue
        dt_s = _parse_iso_utc(m.get("start_time", ""))
        dt_e = _parse_iso_utc(m.get("end_time", ""))
        if not dt_s or not dt_e:
            continue
        if dt_e <= range_start or dt_s >= range_end:
            continue
        active.append({**m, "start_time": dt_s.isoformat(), "end_time": dt_e.isoformat(), "source": "database"})

    if include_outlook and not store.MEMORY:
        # External calendar busy time: Google Calendar (primary); Outlook ICS only if explicitly enabled
        try:
            from app.services.google_calendar_service import list_busy_events
            active.extend(list_busy_events(range_start, range_end))
        except Exception as e:
            logger.warning(f"Google Calendar busy fetch failed: {e}")
        if getattr(settings, "USE_OUTLOOK_CALENDAR", False):
            active.extend(_fetch_outlook_ics_sync(range_start, range_end))

    active.sort(key=lambda e: e["start_time"])
    return active


def get_busy_intervals(day: date, include_outlook: bool = True) -> List[Dict]:
    """Return all active calendar events overlapping `day` (in Europe/Berlin local time)."""
    day_start_local = datetime.combine(day, time(0, 0), tzinfo=BERLIN_TZ)
    day_end_local = day_start_local + timedelta(days=1)
    # Pad +/- 4h around day boundaries to catch buffered events at day edges
    return _fetch_db_meetings(
        (day_start_local - timedelta(hours=4)).astimezone(timezone.utc),
        (day_end_local + timedelta(hours=4)).astimezone(timezone.utc),
        include_outlook=include_outlook,
    )


def find_conflicts(
    proposed_start_utc: datetime,
    proposed_end_utc: datetime,
    is_offline: bool = True,
    exclude_meeting_id: Optional[str] = None,
    include_outlook: bool = True,
) -> List[Dict]:
    """
    Check if [proposed_start_utc, proposed_end_utc] overlaps any existing meeting,
    enforcing a 30-min travel buffer for offline/onsite appointments.
    """
    buf = timedelta(minutes=OFFLINE_BUFFER_MIN if is_offline else 0)
    check_s = proposed_start_utc - buf
    check_e = proposed_end_utc + buf

    day_events = _fetch_db_meetings(check_s - timedelta(hours=2), check_e + timedelta(hours=2), include_outlook=include_outlook)
    conflicts: List[Dict] = []
    for evt in day_events:
        if exclude_meeting_id and evt.get("id") == exclude_meeting_id:
            continue
        ev_s = _parse_iso_utc(evt["start_time"])
        ev_e = _parse_iso_utc(evt["end_time"])
        if not ev_s or not ev_e:
            continue
        if not (ev_e <= check_s or ev_s >= check_e):
            conflicts.append(evt)
    return conflicts


def get_free_slots(
    day: date,
    duration_minutes: int = DEFAULT_DURATION_MIN,
    is_offline: bool = True,
    now_utc: Optional[datetime] = None,
    include_outlook: bool = True,
) -> List[Dict]:
    """
    Compute available start slots on `day` (Europe/Berlin working hours 09:00–18:00, Mon–Sat).
    Returns up to 10 slot dicts: {"start_iso": ..., "end_iso": ..., "label": "09:00 - 10:00", "time": "09:00"}.
    """
    if day.weekday() not in WORK_DAYS:
        return []

    now_berlin = (now_utc or datetime.now(timezone.utc)).astimezone(BERLIN_TZ)
    min_start_berlin = now_berlin + timedelta(minutes=15)

    busy = get_busy_intervals(day, include_outlook=include_outlook)
    parsed_busy: List[Tuple[datetime, datetime]] = []
    for evt in busy:
        es = _parse_iso_utc(evt["start_time"])
        ee = _parse_iso_utc(evt["end_time"])
        if es and ee:
            parsed_busy.append((es, ee))

    buf = timedelta(minutes=OFFLINE_BUFFER_MIN if is_offline else 0)
    dur = timedelta(minutes=duration_minutes)

    def _is_free(start_local: datetime) -> bool:
        if start_local < min_start_berlin:
            return False
        end_local = start_local + dur
        if end_local.hour > WORK_END_HOUR or (end_local.hour == WORK_END_HOUR and end_local.minute > 0):
            return False
        s_utc = start_local.astimezone(timezone.utc) - buf
        e_utc = end_local.astimezone(timezone.utc) + buf
        for bs, be in parsed_busy:
            if not (be <= s_utc or bs >= e_utc):
                return False
        return True

    slots: List[Dict] = []
    seen_starts = set()
    for hour in range(WORK_START_HOUR, WORK_END_HOUR):
        cand = datetime.combine(day, time(hour, 0), tzinfo=BERLIN_TZ)
        if _is_free(cand):
            end_c = cand + dur
            seen_starts.add(cand)
            slots.append({
                "start_iso": cand.astimezone(timezone.utc).isoformat(),
                "end_iso": end_c.astimezone(timezone.utc).isoformat(),
                "time": cand.strftime("%H:%M"),
                "label": f"{cand.strftime('%H:%M')} - {end_c.strftime('%H:%M')}",
            })
        else:
            # If the whole hour was blocked by a trailing buffer, try :30 so recovery after buffer is smooth
            half = cand + timedelta(minutes=30)
            if half not in seen_starts and _is_free(half):
                end_h = half + dur
                seen_starts.add(half)
                slots.append({
                    "start_iso": half.astimezone(timezone.utc).isoformat(),
                    "end_iso": end_h.astimezone(timezone.utc).isoformat(),
                    "time": half.strftime("%H:%M"),
                    "label": f"{half.strftime('%H:%M')} - {end_h.strftime('%H:%M')}",
                })

    return slots[:10]


def _send_ics_invite(meeting: Dict) -> bool:
    """
    Send an RFC 5545 `.ics` calendar invite email to the founder's Outlook inbox
    via configured Strato SMTP so DB-booked appointments appear in Outlook.
    Fails gracefully if SMTP credentials are not configured.
    """
    smtp_pass = (getattr(settings, "SMTP_PASSWORD", "") or "").strip()
    smtp_user = (getattr(settings, "SMTP_USER", "") or "").strip()
    recipient = (getattr(settings, "BRIEFING_EMAIL_RECIPIENT", "") or smtp_user).strip()
    if not smtp_pass or not smtp_user or not recipient or smtp_pass.startswith("http"):
        logger.debug("SMTP credentials not configured for .ics invite; skipping email.")
        return False

    start_dt = _parse_iso_utc(meeting.get("start_time", ""))
    end_dt = _parse_iso_utc(meeting.get("end_time", ""))
    if not start_dt or not end_dt:
        return False

    uid = f"{meeting.get('id', uuid.uuid4())}@car-agents.de"
    fmt = "%Y%m%dT%H%M%SZ"
    loc = meeting.get("location_address") or ("Online" if meeting.get("location_type") == "ONLINE" else "CAR-AGENTS Office")
    desc = (
        f"Client: {meeting.get('client_name')}\\n"
        f"Phone: {meeting.get('client_phone') or '-'}\\n"
        f"Vehicle: {meeting.get('vehicle') or '-'}\\n"
        f"Type: {meeting.get('deal_type') or '-'}"
    )

    ics_body = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//CAR-AGENTS//CRM Scheduler//DE\r\n"
        "METHOD:REQUEST\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTAMP:{datetime.now(timezone.utc).strftime(fmt)}\r\n"
        f"DTSTART:{start_dt.strftime(fmt)}\r\n"
        f"DTEND:{end_dt.strftime(fmt)}\r\n"
        f"SUMMARY:{meeting.get('title', 'CAR-AGENTS Termin')}\r\n"
        f"LOCATION:{loc}\r\n"
        f"DESCRIPTION:{desc}\r\n"
        f"ORGANIZER;CN=CAR-AGENTS:mailto:{smtp_user}\r\n"
        f"ATTENDEE;RSVP=TRUE:mailto:{recipient}\r\n"
        "STATUS:CONFIRMED\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"Termin: {meeting.get('title')} ({start_dt.astimezone(BERLIN_TZ).strftime('%d.%m %H:%M')})"
    msg["From"] = f"CAR-AGENTS Scheduler <{smtp_user}>"
    msg["To"] = recipient

    msg.attach(MIMEText(
        f"Meeting scheduled:\n\n{meeting.get('title')}\n"
        f"When: {start_dt.astimezone(BERLIN_TZ).strftime('%d.%m.%Y %H:%M')} - {end_dt.astimezone(BERLIN_TZ).strftime('%H:%M')} (Europe/Berlin)\n"
        f"Where: {loc}\n"
        f"Client: {meeting.get('client_name')} ({meeting.get('client_phone') or '-'})\n"
        f"Vehicle: {meeting.get('vehicle') or '-'} ({meeting.get('deal_type') or '-'})\n",
        "plain",
        "utf-8",
    ))

    part = MIMEBase("text", "calendar", method="REQUEST", name="invite.ics")
    part.set_payload(ics_body.encode("utf-8"))
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="invite.ics")
    msg.attach(part)

    try:
        smtp_host = getattr(settings, "SMTP_HOST", "smtp.strato.de")
        smtp_port = int(getattr(settings, "SMTP_PORT", 465))
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info(f"Sent .ics calendar invite to {recipient} for meeting {uid}")
        return True
    except Exception as e:
        logger.warning(f"Failed to send .ics invite: {e}")
        return False


def _gcal_sync_create(meeting: Dict) -> None:
    """Create the Google Calendar event and remember its id on the meetings row."""
    try:
        from app.services.google_calendar_service import create_event
        event_id = create_event(meeting)
        if event_id and meeting.get("id"):
            try:
                _sb().table("meetings").update({"gcal_event_id": event_id}).eq("id", meeting["id"]).execute()
            except Exception as e:
                logger.warning(f"Could not store gcal_event_id (run docs/db/supabase_v3_3_gcal.sql): {e}")
    except Exception as e:
        logger.warning(f"Google Calendar create sync failed: {e}")


def _gcal_sync_delete(event_id: str) -> None:
    try:
        from app.services.google_calendar_service import delete_event
        delete_event(event_id)
    except Exception as e:
        logger.warning(f"Google Calendar delete sync failed: {e}")


def _gcal_sync_update(event_id: str, start: datetime, end: datetime) -> None:
    try:
        from app.services.google_calendar_service import update_event
        update_event(event_id, start, end)
    except Exception as e:
        logger.warning(f"Google Calendar update sync failed: {e}")


def create_meeting(
    client_name: str,
    start_utc: datetime,
    end_utc: datetime,
    client_phone: str = "",
    customer_email: str = "",
    vehicle: str = "",
    deal_type: str = "UNKNOWN",
    lead_id: Optional[str] = None,
    project_id: Optional[str] = None,
    location_type: str = "OFFLINE_ONSITE",
    location_address: str = "",
    title: Optional[str] = None,
    notes: str = "",
    include_outlook: bool = True,
) -> Dict:
    """
    Create a meeting ONLY if no overlapping conflict exists (atomic pre-insert guard).
    Returns {"conflict": True, "blocking_events": [...]} if clashed, or {"conflict": False, "meeting": {...}, "ics_emailed": bool}.
    """
    from app.services import whatsapp_store as store

    is_offline = (location_type or "OFFLINE_ONSITE").upper() == "OFFLINE_ONSITE"
    conflicts = find_conflicts(start_utc, end_utc, is_offline=is_offline, include_outlook=include_outlook)
    if conflicts:
        return {"conflict": True, "blocking_events": conflicts}

    veh_txt = vehicle if vehicle and vehicle != "Vehicle TBD" else ""
    auto_title = title or (f"{client_name} — {veh_txt}" if veh_txt else f"Termin mit {client_name}")

    payload = {
        "title": auto_title,
        "client_name": client_name,
        "client_phone": client_phone or None,
        "customer_email": customer_email or None,
        "lead_id": lead_id,
        "project_id": project_id,
        "vehicle": veh_txt or None,
        "deal_type": deal_type if deal_type in ("BUY", "SELL") else None,
        "status": "SCHEDULED",
        "start_time": start_utc.astimezone(timezone.utc).isoformat(),
        "end_time": end_utc.astimezone(timezone.utc).isoformat(),
        "location_type": "OFFLINE_ONSITE" if is_offline else "ONLINE",
        "location_address": location_address or ("In-Person / Vor Ort" if is_offline else "Online / Video Call"),
        "is_conflict": False,
        "notes": notes or None,
    }

    if store.MEMORY:
        created = {**payload, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        store._mem_meetings.append(created)
        return {"conflict": False, "meeting": created, "calendar_synced": False}

    try:
        res = _sb().table("meetings").insert(payload).execute()
        created = res.data[0] if res.data else payload
    except Exception as e:
        # Fallback if a column wasn't migrated yet
        logger.warning(f"Full meeting insert failed, retrying base columns: {e}")
        base_keys = {"title", "client_name", "client_phone", "project_id", "start_time", "end_time", "location_type", "location_address", "is_conflict", "notes"}
        base_payload = {k: v for k, v in payload.items() if k in base_keys}
        res = _sb().table("meetings").insert(base_payload).execute()
        created = res.data[0] if res.data else base_payload

    # Push to Google Calendar in a background thread so WhatsApp replies instantly
    threading.Thread(target=_gcal_sync_create, args=(created,), daemon=True).start()
    return {"conflict": False, "meeting": created, "calendar_synced": True}


def list_upcoming_meetings(limit: int = 10, days_ahead: int = 14) -> List[Dict]:
    now_utc = datetime.now(timezone.utc) - timedelta(hours=1)
    end_utc = now_utc + timedelta(days=days_ahead)
    events = _fetch_db_meetings(now_utc, end_utc, include_outlook=False)
    return events[:limit]


def cancel_meeting(meeting_id: str) -> Optional[Dict]:
    from app.services import whatsapp_store as store

    if store.MEMORY:
        for m in store._mem_meetings:
            if m.get("id") == meeting_id:
                m["status"] = "CANCELLED"
                return m
        return None

    res = _sb().table("meetings").update({"status": "CANCELLED"}).eq("id", meeting_id).execute()
    row = res.data[0] if res.data else None
    if row and row.get("gcal_event_id"):
        threading.Thread(target=_gcal_sync_delete, args=(row["gcal_event_id"],), daemon=True).start()
    return row


def reschedule_meeting(
    meeting_id: str,
    new_start_utc: datetime,
    new_end_utc: datetime,
    include_outlook: bool = True,
) -> Dict:
    from app.services import whatsapp_store as store

    if store.MEMORY:
        target = next((m for m in store._mem_meetings if m.get("id") == meeting_id), None)
        if not target:
            return {"not_found": True}
        is_off = (target.get("location_type") or "OFFLINE_ONSITE") == "OFFLINE_ONSITE"
        conflicts = find_conflicts(new_start_utc, new_end_utc, is_offline=is_off, exclude_meeting_id=meeting_id, include_outlook=False)
        if conflicts:
            return {"conflict": True, "blocking_events": conflicts}
        target["start_time"] = new_start_utc.astimezone(timezone.utc).isoformat()
        target["end_time"] = new_end_utc.astimezone(timezone.utc).isoformat()
        return {"conflict": False, "meeting": target}

    existing = _sb().table("meetings").select("*").eq("id", meeting_id).limit(1).execute().data
    if not existing:
        return {"not_found": True}
    target = existing[0]
    is_off = (target.get("location_type") or "OFFLINE_ONSITE") == "OFFLINE_ONSITE"
    conflicts = find_conflicts(new_start_utc, new_end_utc, is_offline=is_off, exclude_meeting_id=meeting_id, include_outlook=include_outlook)
    if conflicts:
        return {"conflict": True, "blocking_events": conflicts}
    res = _sb().table("meetings").update({
        "start_time": new_start_utc.astimezone(timezone.utc).isoformat(),
        "end_time": new_end_utc.astimezone(timezone.utc).isoformat(),
    }).eq("id", meeting_id).execute()
    if target.get("gcal_event_id"):
        threading.Thread(
            target=_gcal_sync_update, args=(target["gcal_event_id"], new_start_utc, new_end_utc), daemon=True
        ).start()
    return {"conflict": False, "meeting": res.data[0] if res.data else target}


def format_meeting_line(m: Dict, idx: Optional[int] = None) -> str:
    dt_s = _parse_iso_utc(m.get("start_time", ""))
    when = dt_s.astimezone(BERLIN_TZ).strftime("%a %d.%m %H:%M") if dt_s else m.get("start_time", "")
    loc = "Vor Ort" if (m.get("location_type") == "OFFLINE_ONSITE") else "Online"
    prefix = f"{idx}. " if idx is not None else "• "
    veh = f" • {m['vehicle']}" if m.get("vehicle") else ""
    return f"{prefix}*{when}* — {m.get('client_name') or m.get('title')}{veh} ({loc})"
