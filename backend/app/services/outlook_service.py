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
import os
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


# ─── Email: Lead Qualification Engine ────────────────────────────────────────

# Activation cutoff: Only process emails received AFTER this date
ACTIVATION_DATE = datetime(2026, 8, 31, 0, 0, 0, tzinfo=timezone.utc)

# Dry run mode: read emails and log replies but NEVER actually send SMTP
DRY_RUN = os.environ.get("DRY_RUN", "true").lower() == "true"

# Max auto-replies per hour (rate limit to avoid Strato spam flags)
_REPLY_TIMESTAMPS: List[datetime] = []
MAX_REPLIES_PER_HOUR = 10

# ── Intent keyword sets ────────────────────────────────────────────────────────
_BUY_KEYWORDS = {
    "kaufen", "kauf", "suche", "gesucht", "ankauf", "beschaffung",
    "ich suche", "wir suchen", "auto kaufen", "fahrzeug kaufen",
    "preisvorstellung", "buy", "purchase", "looking for", "want to buy",
    "interested in buying", "budget", "angebot erhalten"
}
_SELL_KEYWORDS = {
    "verkaufen", "verkauf", "verkaufe", "anbieten", "angebot",
    "vermittlung", "ich biete", "ich verkaufe", "mein auto",
    "fahrzeug verkaufen", "sell", "selling", "want to sell",
    "my car", "mein fahrzeug", "loswerden", "zum verkauf"
}
_INQUIRY_KEYWORDS = {
    "anfrage", "information", "beratung", "interesse", "interessiert",
    "was kostet", "wie funktioniert", "inquiry", "question", "info"
}

# ─── Comprehensive spam/automated email ignore list ───────────────────────────
_IGNORE_KEYWORDS = {
    # System / automated
    "rechnung", "zahlungsaufforderung", "newsletter", "unsubscribe",
    "bewerbung", "jobangebot", "noreply", "no-reply", "do-not-reply",
    "automated", "automatisch", "out of office", "abwesenheit",
    "mailer-daemon", "delivery failed", "spam", "invoice",
    "auto-reply", "autoreply", "automatic reply", "auto response",
    "bounce", "undeliverable", "mail delivery",
    # Social media notifications
    "linkedin", "xing", "facebook", "instagram", "twitter", "tiktok",
    "youtube", "whatsapp notification", "telegram notification",
    "neue verbindung", "hat ihr profil", "jemand hat", "network update",
    "hat eine anfrage", "hat kommentiert", "hat reagiert",
    "someone viewed", "new connection", "mentioned you",
    # Logistics / delivery
    "dhl", "dpd", "hermes", "fedex", "ups", "gls", "post ag",
    "sendungsverfolgung", "tracking", "paket", "sendung", "lieferung",
    "liefertermin", "zugestellt", "abholbereit", "versandt",
    "your order", "your shipment", "shipment confirmation",
    "delivery notification", "package",
    # Financial / banking
    "kontoauszug", "lastschrift", "überweisung", "kontobewegung",
    "paypal", "klarna", "stripe", "mollie", "sepa", "iban",
    "kreditkarte", "abbuchung", "gutschrift", "mahnungen",
    "payment received", "transaction", "billing", "statement",
    # Booking / travel
    "buchung", "reservierung", "booking.com", "airbnb", "check-in",
    "hotel", "flug", "reise", "urlaub", "mietwagen",
    "reservation confirmed", "booking confirmation",
    # Marketing / promotional
    "rabatt", "% rabatt", "% off", "promo", "coupon", "gutschein",
    "sonderangebot", "sale", "black friday", "cyber monday",
    "exklusiv für sie", "nur heute", "jetzt sparen", "limited offer",
    "special offer", "flash sale", "angebote der woche",
    # Subscriptions / SaaS
    "your subscription", "ihre bestellung", "abo", "abonnement",
    "trial expires", "free trial", "upgrade your plan",
    # Notifications / confirmations (non-car)
    "bestätigung", "verifizierung", "verify your", "confirm your email",
    "passwort zurücksetzen", "password reset", "sicherheitscode",
    "two-factor", "2fa", "einmalpasswort",
    # Google / platform alerts
    "google alerts", "google play", "google store", "app store",
    "github", "jira", "confluence", "slack notification",
    # Job / HR
    "stellenangebot", "jobanfrage", "karriere", "recruiting",
    "headhunter", "personalvermittlung", "job offer", "apply now",
    # Real estate (not car-related)
    "immobilien", "wohnung", "miete", "haus kaufen",
}

# ─── Known automated-only sender domains to always skip ──────────────────────
_BLOCKED_SENDER_DOMAINS = {
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

# ── German qualification email templates ──────────────────────────────────────
_Q1_TEMPLATE = """Sehr geehrte/r {name},

vielen Dank für Ihre Nachricht bei CAR-AGENTS!

Damit wir Ihnen optimal helfen können, eine kurze Frage:

Suchen Sie ein Fahrzeug zum **Kauf**, oder möchten Sie Ihr Fahrzeug **verkaufen**?

Mit freundlichen Grüßen,
CAR-AGENTS Team
info@car-agents.de | www.car-agents.de"""

_Q2_BUY_TEMPLATE = """Vielen Dank für Ihre Rückmeldung!

Um das passende Fahrzeug für Sie zu finden, benötige ich noch ein paar Details:

- **Welche Marke und welches Modell** bevorzugen Sie?
- **Wie hoch ist Ihr Budget** (in €)?

Mit freundlichen Grüßen,
CAR-AGENTS Team"""

_Q2_SELL_TEMPLATE = """Vielen Dank für Ihre Rückmeldung!

Um Ihr Fahrzeug optimal zu vermitteln, benötige ich noch folgende Informationen:

- **Um welches Fahrzeug handelt es sich?** (Marke, Modell, Baujahr, Kilometerstand)
- **Was ist Ihre Preisvorstellung** (in €)?

Mit freundlichen Grüßen,
CAR-AGENTS Team"""

_Q3_TEMPLATE = """Vielen Dank für die Informationen!

Eine letzte Frage: **Bis wann planen Sie den Kauf/Verkauf?**
(z. B. sofort, innerhalb von 1 Monat, in 2–3 Monaten)

Unser Team meldet sich dann persönlich bei Ihnen, um den nächsten Schritt zu besprechen.

Mit freundlichen Grüßen,
CAR-AGENTS Team
info@car-agents.de | www.car-agents.de"""


def _check_rate_limit() -> bool:
    """Returns True if we are within the allowed reply rate (10/hour)."""
    global _REPLY_TIMESTAMPS
    now = datetime.now(timezone.utc)
    _REPLY_TIMESTAMPS = [t for t in _REPLY_TIMESTAMPS if (now - t).total_seconds() < 3600]
    if len(_REPLY_TIMESTAMPS) >= MAX_REPLIES_PER_HOUR:
        logger.warning(f"Rate limit reached: {MAX_REPLIES_PER_HOUR} replies/hour. Skipping.")
        return False
    return True


def _decode_header(raw_value) -> str:
    """
    Safely decode an email header value (Subject, From, etc.).
    Handles RFC2047 encoded-words (=?UTF-8?Q?...?= or =?iso-8859-1?B?...?=).
    Returns a plain Unicode string.
    """
    import email.header
    if raw_value is None:
        return ""
    try:
        parts = email.header.decode_header(str(raw_value))
        decoded = []
        for part, enc in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(enc or "utf-8", errors="ignore"))
            else:
                decoded.append(str(part))
        return " ".join(decoded).strip()
    except Exception:
        return str(raw_value)


def _detect_intent_keywords(subject: str, body: str) -> Optional[str]:
    """
    Layer 1: Fast keyword matching. Returns 'BUY', 'SELL', 'INQUIRY', or None.
    None means the email is irrelevant and should be ignored.
    """
    # Ensure we always work with plain strings
    combined = (str(subject) + " " + str(body)).lower()

    # Hard ignore first
    if any(kw in combined for kw in _IGNORE_KEYWORDS):
        return None

    if any(kw in combined for kw in _SELL_KEYWORDS):
        return "SELL"
    if any(kw in combined for kw in _BUY_KEYWORDS):
        return "BUY"
    if any(kw in combined for kw in _INQUIRY_KEYWORDS):
        return "INQUIRY"
    return None


def _parse_email_date(msg) -> Optional[datetime]:
    """Parse email Date header to a timezone-aware datetime."""
    import email.utils
    date_str = msg.get("Date", "")
    if not date_str:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(date_str)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def _strip_html(html_str: str) -> str:
    """Strip HTML tags and decode HTML entities to plain text."""
    import html
    import re
    # Replace common block-level tags with newlines
    html_str = re.sub(r'<br\s*/?>', '\n', html_str, flags=re.IGNORECASE)
    html_str = re.sub(r'</(p|div|tr|li|h[1-6])>', '\n', html_str, flags=re.IGNORECASE)
    # Remove all remaining tags
    html_str = re.sub(r'<[^>]+>', '', html_str)
    # Decode HTML entities (e.g., &amp; &nbsp; &uuml; etc.)
    html_str = html.unescape(html_str)
    # Collapse multiple blank lines
    html_str = re.sub(r'\n{3,}', '\n\n', html_str)
    return html_str.strip()


def _decode_part(part) -> str:
    """Decode an email part with proper charset detection (handles UTF-8, latin-1, etc.)."""
    raw = part.get_payload(decode=True)
    if not raw:
        return ""
    charset = part.get_content_charset() or "utf-8"
    # Normalise common charset aliases
    charset = charset.lower().replace("windows-1252", "cp1252")
    try:
        return raw.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        # Fallback chain: try utf-8 → latin-1
        for fallback in ("utf-8", "latin-1"):
            try:
                return raw.decode(fallback, errors="replace")
            except Exception:
                continue
    return raw.decode("utf-8", errors="ignore")


def _extract_body(msg) -> str:
    """
    Extract readable plain text body from email message.
    Priority: text/plain → strip(text/html) → fallback to raw payload.
    Handles charset detection for German umlauts (latin-1 / iso-8859-1).
    """
    plain_body = ""
    html_body = ""

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and not plain_body:
                plain_body = _decode_part(part)
            elif ct == "text/html" and not html_body:
                html_body = _decode_part(part)
    else:
        ct = msg.get_content_type()
        if ct == "text/html":
            html_body = _decode_part(msg)
        else:
            plain_body = _decode_part(msg)

    if plain_body.strip():
        return plain_body.strip()
    if html_body.strip():
        return _strip_html(html_body).strip()
    return ""


def _send_or_log_reply(
    to_email: str,
    sender_name: str,
    subject: str,
    body_template: str,
    in_reply_to: str,
    references: str,
    stage: str,
    lead_id: Optional[str],
    intent: str,
) -> bool:
    """
    Send reply via SMTP or log it locally (DRY_RUN=true).
    Always records the outbound message in email_conversations.
    Returns True on success.
    """
    import smtplib
    import os
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import uuid

    smtp_host = getattr(settings, "SMTP_HOST", "smtp.strato.de")
    smtp_port = int(getattr(settings, "SMTP_PORT", 465))
    smtp_user = getattr(settings, "SMTP_USER", "info@car-agents.de")
    smtp_pass = getattr(settings, "SMTP_PASSWORD", "")

    body_text = body_template.format(name=sender_name or "Interessent/in")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Re: {subject}" if not subject.startswith("Re:") else subject
    msg["From"] = f"CAR-AGENTS Team <{smtp_user}>"
    msg["To"] = to_email
    msg["In-Reply-To"] = in_reply_to
    msg["References"] = references
    msg["Message-ID"] = f"<car-agents-{uuid.uuid4().hex}@car-agents.de>"
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    out_message_id = msg["Message-ID"]
    is_dry_run_flag = DRY_RUN

    if DRY_RUN:
        # Log to local file — zero SMTP calls
        dry_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "dry_run_emails")
        os.makedirs(dry_dir, exist_ok=True)
        fname = os.path.join(dry_dir, f"{stage}_{to_email.replace('@','_')}_{uuid.uuid4().hex[:6]}.txt")
        with open(fname, "w", encoding="utf-8") as f:
            f.write(f"[DRY RUN — NOT SENT]\n")
            f.write(f"To: {to_email}\n")
            f.write(f"Subject: {msg['Subject']}\n")
            f.write(f"Stage: {stage}\n")
            f.write(f"Intent: {intent}\n")
            f.write(f"In-Reply-To: {in_reply_to}\n\n")
            f.write(body_text)
        logger.info(f"[DRY RUN] Reply saved to: {fname}")
    else:
        # Real send
        if not smtp_pass:
            logger.warning("SMTP_PASSWORD not set. Cannot send reply.")
            return False
        if not _check_rate_limit():
            return False
        try:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())
            _REPLY_TIMESTAMPS.append(datetime.now(timezone.utc))
            logger.info(f"Reply sent to {to_email} (stage={stage})")
        except Exception as e:
            logger.error(f"SMTP send failed for {to_email}: {e}")
            return False

    # Record outbound in email_conversations & communications tables
    try:
        sb = get_supabase()
        sb.table("email_conversations").insert({
            "lead_id": lead_id,
            "message_id": out_message_id,
            "thread_id": in_reply_to,
            "direction": "outbound",
            "from_email": smtp_user,
            "to_email": to_email,
            "subject": msg["Subject"],
            "body_preview": body_text[:2000],
            "qualification_stage": stage,
            "intent": intent,
            "is_dry_run": is_dry_run_flag,
        }).execute()

        sb.table("communications").insert({
            "lead_id": lead_id,
            "channel": "STRATO_EMAIL",
            "sender_name": "CAR-AGENTS Team",
            "sender_contact": smtp_user,
            "subject": msg["Subject"],
            "body": body_text,
            "is_inbound": False,
            "intent": intent,
            "ai_summary": f"Automated Reply (Stage: {stage})",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Could not save outbound email record: {e}")

    return True


async def poll_outlook_inbound_emails() -> List[Dict]:
    """
    Polls the Strato IMAP inbox (info@car-agents.de) for new emails.

    Safety guarantees:
    - ONLY marks emails as Seen. Zero deletions. Zero archiving. Zero expunge.
    - Skips all emails before ACTIVATION_DATE (2026-08-31).
    - Skips emails already recorded in email_conversations (deduplication).
    - In DRY_RUN mode: reads and logs, never sends SMTP.

    Qualification flow (German, conversational):
    - New genuine inquiry → create lead → send Q1 (intent confirm)
    - Reply to Q1 → send Q2 (budget/vehicle details)
    - Reply to Q2 → send Q3 (timeline)
    - Reply to Q3 → mark lead is_qualified=True → Telegram alert
    """
    import os
    imap_host = getattr(settings, "IMAP_HOST", "imap.strato.de")
    imap_port = int(getattr(settings, "IMAP_PORT", 993))
    imap_user = getattr(settings, "IMAP_USER", "info@car-agents.de")
    imap_pass = getattr(settings, "IMAP_PASSWORD", "")

    if not imap_pass:
        logger.warning("IMAP_PASSWORD not configured. Skipping email poll.")
        return []

    mode = "DRY_RUN" if DRY_RUN else "LIVE"
    logger.info(f"Email poll starting [mode={mode}, cutoff={ACTIVATION_DATE.date()}]")

    sb = get_supabase()
    processed = []

    try:
        with imaplib.IMAP4_SSL(imap_host, imap_port) as mail:
            mail.login(imap_user, imap_pass)
            mail.select("INBOX")
            _, msg_ids = mail.search(None, "UNSEEN")
            all_ids = msg_ids[0].split() if msg_ids[0] else []

            logger.info(f"Found {len(all_ids)} unread emails in inbox")

            for msg_id in all_ids[-30:]:  # Process at most 30 per run
                try:
                    _, msg_data = mail.fetch(msg_id, "(RFC822)")
                    raw = msg_data[0][1]
                    msg = email_lib.message_from_bytes(raw)

                    # ── 1. Date cutoff check ──────────────────────────────────
                    email_date = _parse_email_date(msg)
                    if email_date and email_date < ACTIVATION_DATE:
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        continue  # Skip old emails silently

                    # ── 2. Extract metadata ───────────────────────────────────
                    message_id = _decode_header(msg.get("Message-ID", "")).strip()
                    in_reply_to = _decode_header(msg.get("In-Reply-To", "")).strip()
                    references = _decode_header(msg.get("References", "")).strip()
                    sender_raw = _decode_header(msg.get("From", ""))
                    subject = _decode_header(msg.get("Subject", ""))
                    body = _extract_body(msg)

                    sender_email = sender_raw.split("<")[-1].replace(">", "").strip() if "<" in sender_raw else sender_raw.strip()
                    sender_name = sender_raw.split("<")[0].strip().strip('"') if "<" in sender_raw else sender_email

                    # Skip our own outbound emails if they land in inbox
                    if sender_email.lower() == imap_user.lower():
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        continue

                    # ── 2b. Header-based spam detection ──────────────────────
                    # Check industry-standard newsletter/bulk headers
                    list_unsub = msg.get("List-Unsubscribe", "")
                    precedence = msg.get("Precedence", "").lower()
                    auto_submitted = msg.get("Auto-Submitted", "").lower()
                    x_mailer = msg.get("X-Mailer", "").lower()
                    x_bulk = msg.get("X-Bulk-Unsubscribe", "")

                    is_bulk = (
                        bool(list_unsub) or  # newsletters always have this
                        precedence in ("bulk", "list", "junk") or
                        (auto_submitted and auto_submitted != "no") or
                        bool(x_bulk) or
                        any(m in x_mailer for m in ("mailchimp", "sendinblue", "hubspot",
                                                     "klaviyo", "constantcontact", "brevo"))
                    )
                    if is_bulk:
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        logger.debug(f"Skipped bulk/newsletter email from {sender_email} (header check)")
                        continue

                    # Check blocked sender domains
                    sender_domain = sender_email.split("@")[-1].lower() if "@" in sender_email else ""
                    if sender_domain in _BLOCKED_SENDER_DOMAINS:
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        logger.debug(f"Skipped blocked domain: {sender_domain}")
                        continue

                    # Skip very short bodies (automated pings / delivery receipts)
                    if body and len(body.strip()) < 30:
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        logger.debug(f"Skipped too-short body email from {sender_email}")
                        continue

                    # ── 3. Deduplication check ────────────────────────────────
                    if message_id:
                        existing = sb.table("email_conversations").select("id").eq("message_id", message_id).execute()
                        if existing.data:
                            mail.store(msg_id, "+FLAGS", "\\Seen")
                            continue

                    # ── 4. Thread detection — is this a reply to a Q we sent? ─
                    thread_lead = None
                    current_stage = None
                    if in_reply_to:
                        prior = sb.table("email_conversations") \
                            .select("lead_id, qualification_stage") \
                            .eq("message_id", in_reply_to) \
                            .eq("direction", "outbound") \
                            .execute()
                        if prior.data:
                            thread_lead = prior.data[0].get("lead_id")
                            current_stage = prior.data[0].get("qualification_stage")

                    # ── 5. Intent detection (Layer 1: keywords) ───────────────
                    intent = _detect_intent_keywords(subject, body)
                    if intent is None and current_stage is None:
                        # Not a car inquiry and not part of our thread → ignore
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        logger.debug(f"Ignored non-car email from {sender_email}")
                        continue

                    # If it's a thread reply (already talking to us), keep intent from lead
                    if intent is None and thread_lead:
                        lead_rec = sb.table("leads").select("intent").eq("id", thread_lead).execute()
                        if lead_rec.data:
                            raw_intent = lead_rec.data[0].get("intent", "INQUIRY")
                            intent = raw_intent.replace("_INTENT", "")

                    if not intent or intent == "INQUIRY":
                        intent = "BUY"

                    strict_intent_str = "SELL_INTENT" if intent == "SELL" else "BUY_INTENT"

                    # ── 6. Record inbound email ───────────────────────────────
                    pipeline = "SELL" if intent == "SELL" else "BUY"

                    # Create or find lead
                    lead_id = thread_lead
                    if not lead_id:
                        # Check if lead exists for this email address
                        existing_lead = sb.table("leads").select("id, qualification_stage") \
                            .eq("email", sender_email).execute()
                        if existing_lead.data:
                            lead_id = existing_lead.data[0]["id"]
                            current_stage = existing_lead.data[0].get("qualification_stage", "uncontacted")
                        else:
                            new_lead = sb.table("leads").insert({
                                "name": sender_name or sender_email,
                                "email": sender_email,
                                "intent": strict_intent_str,
                                "channel": "STRATO_EMAIL",
                                "status": "NEW",
                                "qualification_stage": "uncontacted",
                                "is_qualified": False,
                                "notes": f"Subject: {subject}\n\n{body[:500]}",
                            }).execute()
                            if new_lead.data:
                                lead_id = new_lead.data[0]["id"]
                                logger.info(f"New lead created: {sender_name} <{sender_email}>")
                                # Send Telegram alert for new email lead with inline action buttons
                                try:
                                    from app.services.telegram_service import send_telegram_message
                                    lead_disp_name = sender_name or sender_email
                                    inline_btns = {
                                        "inline_keyboard": [
                                            [
                                                {"text": "⚡ Convert to Project", "callback_data": f"/convert {lead_disp_name}"},
                                                {"text": "📋 View Leads", "callback_data": "/leads"}
                                            ]
                                        ]
                                    }
                                    await send_telegram_message(
                                        f"📩 <b>Neue E-Mail-Anfrage eingetroffen!</b>\n\n"
                                        f"👤 <b>Name:</b> {_h(lead_disp_name)}\n"
                                        f"📧 <b>E-Mail:</b> {_h(sender_email)}\n"
                                        f"📌 <b>Intent:</b> {_h(intent)}\n"
                                        f"📝 <b>Betreff:</b> {_h(subject)}\n\n"
                                        f"💡 <i>Tippe ⚡ Convert to Project um direkt ein Projekt zu erstellen.</i>",
                                        parse_mode="HTML",
                                        reply_markup=inline_btns
                                    )
                                except Exception as te:
                                    logger.warning(f"Telegram new lead alert failed: {te}")

                    # Save inbound email record in email_conversations & communications
                    try:
                        sb.table("email_conversations").insert({
                            "lead_id": lead_id,
                            "message_id": message_id or f"<no-id-{msg_id.decode()}>",
                            "thread_id": in_reply_to or None,
                            "direction": "inbound",
                            "from_email": sender_email,
                            "to_email": imap_user,
                            "subject": subject,
                            "body_preview": body[:2000],
                            "qualification_stage": current_stage or "uncontacted",
                            "intent": intent,
                            "is_dry_run": False,
                        }).execute()

                        sb.table("communications").insert({
                            "lead_id": lead_id,
                            "channel": "STRATO_EMAIL",
                            "sender_name": sender_name or sender_email,
                            "sender_contact": sender_email,
                            "subject": subject,
                            "body": body,
                            "is_inbound": True,
                            "intent": intent,
                            "ai_summary": f"Stage: {current_stage or 'uncontacted'}",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }).execute()
                    except Exception as e:
                        logger.warning(f"Could not save inbound record: {e}")

                    # ── 7. Conversation state machine ─────────────────────────
                    ref_chain = f"{references} {message_id}".strip()

                    if not current_stage or current_stage == "uncontacted":
                        # Q1: Intent confirmation
                        ok = _send_or_log_reply(
                            to_email=sender_email,
                            sender_name=sender_name,
                            subject=subject,
                            body_template=_Q1_TEMPLATE,
                            in_reply_to=message_id,
                            references=ref_chain,
                            stage="q1_sent",
                            lead_id=lead_id,
                            intent=intent,
                        )
                        if ok and lead_id:
                            sb.table("leads").update({"qualification_stage": "q1_sent"}).eq("id", lead_id).execute()

                    elif current_stage == "q1_sent":
                        # Q2: Budget/vehicle details
                        template = _Q2_SELL_TEMPLATE if intent == "SELL" else _Q2_BUY_TEMPLATE
                        ok = _send_or_log_reply(
                            to_email=sender_email,
                            sender_name=sender_name,
                            subject=subject,
                            body_template=template,
                            in_reply_to=message_id,
                            references=ref_chain,
                            stage="q2_sent",
                            lead_id=lead_id,
                            intent=intent,
                        )
                        if ok and lead_id:
                            # Update lead notes with Q1 reply
                            sb.table("leads").update({
                                "qualification_stage": "q2_sent",
                                "notes": f"Q1 reply: {body[:300]}",
                            }).eq("id", lead_id).execute()

                    elif current_stage == "q2_sent":
                        # Q3: Timeline
                        ok = _send_or_log_reply(
                            to_email=sender_email,
                            sender_name=sender_name,
                            subject=subject,
                            body_template=_Q3_TEMPLATE,
                            in_reply_to=message_id,
                            references=ref_chain,
                            stage="q3_sent",
                            lead_id=lead_id,
                            intent=intent,
                        )
                        if ok and lead_id:
                            sb.table("leads").update({
                                "qualification_stage": "q3_sent",
                                "notes": f"Q2 reply: {body[:300]}",
                            }).eq("id", lead_id).execute()

                    elif current_stage == "q3_sent":
                        # Lead is fully qualified!
                        if lead_id:
                            sb.table("leads").update({
                                "is_qualified": True,
                                "qualification_stage": "qualified",
                                "status": "QUALIFIED",
                                "notes": f"Q3 reply (timeline): {body[:300]}",
                            }).eq("id", lead_id).execute()
                            logger.info(f"Lead QUALIFIED: {sender_name} <{sender_email}> ({intent})")
                            # Telegram alert with 1-click Convert button
                            try:
                                from app.services.telegram_service import send_telegram_message
                                qual_disp_name = sender_name or sender_email
                                inline_btns = {
                                    "inline_keyboard": [
                                        [
                                            {"text": "⚡ Convert to Project", "callback_data": f"/convert {qual_disp_name}"},
                                            {"text": "🌟 All Qualified Leads", "callback_data": "/qualified"}
                                        ]
                                    ]
                                }
                                await send_telegram_message(
                                    f"🌟 <b>Neuer qualifizierter Lead!</b>\n\n"
                                    f"👤 <b>Name:</b> {_h(qual_disp_name)}\n"
                                    f"📧 <b>E-Mail:</b> {_h(sender_email)}\n"
                                    f"📌 <b>Intent:</b> {_h(intent)}\n"
                                    f"📅 <b>Zeitplan / Details:</b> {_h(body[:200])}\n\n"
                                    f"✅ Lead ist vollständig qualifiziert & bereit für Konvertierung.",
                                    parse_mode="HTML",
                                    reply_markup=inline_btns
                                )
                            except Exception as te:
                                logger.warning(f"Telegram alert failed: {te}")

                        processed.append({"email": sender_email, "stage": "qualified"})

                    # ── 8. Mark as read (ONLY safe operation) ─────────────────
                    mail.store(msg_id, "+FLAGS", "\\Seen")
                    processed.append({"email": sender_email, "stage": current_stage or "q1_sent"})

                except Exception as inner_e:
                    logger.error(f"Error processing message {msg_id}: {inner_e}")
                    continue

    except Exception as e:
        logger.error(f"IMAP poll error: {e}")

    logger.info(f"Email poll complete [{mode}]: {len(processed)} email(s) processed")
    return processed


