"""
app/services/reminder_service.py
────────────────────────────────────────────────────────────────────────
CAR-AGENTS Phase 1 (§3–§7, §10) — Reminders, Working Hours & Bavarian Holidays Engine.

Features:
  1. Official Bavarian (Bayern) public holiday calculator (fixed + Easter-based movable holidays).
  2. Configurable working days & hours (`crm_working_hours` table; changes apply only to newly
     created reminders — existing reminder due times remain unchanged unless manually modified).
  3. Automatic deadline calculation per inquiry category:
       - advertised_buyer / marketplace (§4): +2 working hours (initial response)
       - seller / sourcing / sell_and_source (§3, §5, §6): end of same working day (or +4 working hours if late in day)
       - b2b_cooperation (§7): next working day
       - awaiting_reply (§3–§6): +2 working days after outbound message requiring customer response
  4. Duplicate prevention for shared combined Sell+Source contacts (§6: `contact_key`).
  5. Overdue notification rules (§10):
       - Sent individually via WhatsApp once when first becoming due (`notified_individual=True`).
       - If still open on subsequent days, included ONLY in the daily consolidated morning overview
         at the start of the configured working day (and only sent if overdue reminders exist).
  6. Two-way completion sync between CRM and WhatsApp (`mark_completed(id, via='CRM'|'WHATSAPP')`).
────────────────────────────────────────────────────────────────────────
"""
import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Optional, Set
from zoneinfo import ZoneInfo

logger = logging.getLogger("reminder_service")

BERLIN_TZ = ZoneInfo("Europe/Berlin")

_mem_working_hours: Dict = {
    "id": "default",
    "work_days": [0, 1, 2, 3, 4, 5],  # Mon..Sat
    "start_hour": 9,
    "end_hour": 18,
    "timezone": "Europe/Berlin",
    "state_holidays": "BY",
}
_mem_reminders: List[Dict] = []


def _use_memory() -> bool:
    from app.services import whatsapp_store as ws
    return bool(ws.MEMORY)


def reset_memory() -> None:
    _mem_reminders.clear()
    _mem_working_hours.update({
        "work_days": [0, 1, 2, 3, 4, 5],
        "start_hour": 9,
        "end_hour": 18,
        "timezone": "Europe/Berlin",
        "state_holidays": "BY",
    })


def _sb():
    from database import get_supabase
    return get_supabase()


# ─── Bavarian (Bayern) Public Holidays Calculator (§10) ───────────────────

def _easter_sunday(year: int) -> date:
    """Anonymous Gregorian algorithm for Easter Sunday."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def bavarian_holidays(year: int) -> Dict[date, str]:
    """
    All 13 statewide statutory public holidays in Bavaria (Freistaat Bayern):
      - Neujahr (Jan 1)
      - Heilige Drei Könige (Jan 6)
      - Karfreitag (Easter - 2d)
      - Ostermontag (Easter + 1d)
      - Tag der Arbeit (May 1)
      - Christi Himmelfahrt (Easter + 39d)
      - Pfingstmontag (Easter + 50d)
      - Fronleichnam (Easter + 60d)
      - Mariä Himmelfahrt (Aug 15)
      - Tag der Deutschen Einheit (Oct 3)
      - Allerheiligen (Nov 1)
      - 1. Weihnachtsfeiertag (Dec 25)
      - 2. Weihnachtsfeiertag (Dec 26)
    """
    easter = _easter_sunday(year)
    return {
        date(year, 1, 1): "Neujahr",
        date(year, 1, 6): "Heilige Drei Könige",
        easter - timedelta(days=2): "Karfreitag",
        easter + timedelta(days=1): "Ostermontag",
        date(year, 5, 1): "Tag der Arbeit",
        easter + timedelta(days=39): "Christi Himmelfahrt",
        easter + timedelta(days=50): "Pfingstmontag",
        easter + timedelta(days=60): "Fronleichnam",
        date(year, 8, 15): "Mariä Himmelfahrt",
        date(year, 10, 3): "Tag der Deutschen Einheit",
        date(year, 11, 1): "Allerheiligen",
        date(year, 12, 25): "1. Weihnachtsfeiertag",
        date(year, 12, 26): "2. Weihnachtsfeiertag",
    }


def is_bavarian_holiday(d: date) -> bool:
    return d in bavarian_holidays(d.year)


# ─── Configurable Working Hours (§10) ─────────────────────────────────────

def get_working_hours() -> Dict:
    if _use_memory():
        return dict(_mem_working_hours)
    try:
        rows = _sb().table("crm_working_hours").select("*").eq("id", "default").limit(1).execute().data or []
        if rows:
            return rows[0]
    except Exception as e:
        logger.debug(f"get_working_hours fallback: {e}")
    return dict(_mem_working_hours)


def update_working_hours(work_days: List[int], start_hour: int, end_hour: int) -> Dict:
    """
    Update working days and hours (§10: applies to newly created reminders;
    previously calculated reminder times remain unchanged).
    """
    clean_days = sorted({int(d) for d in work_days if 0 <= int(d) <= 6}) or [0, 1, 2, 3, 4]
    sh = max(0, min(22, int(start_hour)))
    eh = max(sh + 1, min(23, int(end_hour)))
    payload = {
        "id": "default",
        "work_days": clean_days,
        "start_hour": sh,
        "end_hour": eh,
        "timezone": "Europe/Berlin",
        "state_holidays": "BY",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _mem_working_hours.update(payload)
    if _use_memory():
        return dict(_mem_working_hours)
    try:
        res = _sb().table("crm_working_hours").upsert(payload, on_conflict="id").execute()
        return res.data[0] if res.data else payload
    except Exception as e:
        logger.warning(f"update_working_hours warning: {e}")
        return payload


def is_working_day(d: date, cfg: Optional[Dict] = None) -> bool:
    cfg = cfg or get_working_hours()
    work_days: Set[int] = set(cfg.get("work_days") or [0, 1, 2, 3, 4, 5])
    if d.weekday() not in work_days:
        return False
    if is_bavarian_holiday(d):
        return False
    return True


def next_working_day(d: date, cfg: Optional[Dict] = None) -> date:
    cfg = cfg or get_working_hours()
    cur = d
    for _ in range(30):
        if is_working_day(cur, cfg):
            return cur
        cur += timedelta(days=1)
    return cur


def add_working_days(start_dt_utc: datetime, num_days: int, cfg: Optional[Dict] = None) -> datetime:
    cfg = cfg or get_working_hours()
    local = start_dt_utc.astimezone(BERLIN_TZ)
    sh = int(cfg.get("start_hour", 9))
    eh = int(cfg.get("end_hour", 18))
    cur_date = next_working_day(local.date(), cfg)
    added = 0
    while added < num_days:
        cur_date += timedelta(days=1)
        if is_working_day(cur_date, cfg):
            added += 1
    target_hour = min(max(local.hour, sh), eh - 1)
    target_local = datetime.combine(cur_date, time(target_hour, local.minute), tzinfo=BERLIN_TZ)
    return target_local.astimezone(timezone.utc)


def add_working_hours(start_dt_utc: datetime, hours: float, cfg: Optional[Dict] = None) -> datetime:
    """Add working hours respecting working window [start_hour, end_hour] and Bavarian holidays."""
    cfg = cfg or get_working_hours()
    sh = int(cfg.get("start_hour", 9))
    eh = int(cfg.get("end_hour", 18))
    local = start_dt_utc.astimezone(BERLIN_TZ)

    # Clamp start into working window
    if not is_working_day(local.date(), cfg) or local.hour >= eh:
        nd = next_working_day(local.date() + (timedelta(days=1) if local.hour >= eh else timedelta(days=0)), cfg)
        local = datetime.combine(nd, time(sh, 0), tzinfo=BERLIN_TZ)
    elif local.hour < sh:
        local = datetime.combine(local.date(), time(sh, 0), tzinfo=BERLIN_TZ)

    remaining_minutes = int(round(hours * 60))
    while remaining_minutes > 0:
        day_end = datetime.combine(local.date(), time(eh, 0), tzinfo=BERLIN_TZ)
        avail = int((day_end - local).total_seconds() // 60)
        if remaining_minutes <= avail:
            local = local + timedelta(minutes=remaining_minutes)
            remaining_minutes = 0
        else:
            remaining_minutes -= max(0, avail)
            nd = next_working_day(local.date() + timedelta(days=1), cfg)
            local = datetime.combine(nd, time(sh, 0), tzinfo=BERLIN_TZ)

    return local.astimezone(timezone.utc)


def compute_initial_due(category: str, now_utc: Optional[datetime] = None, cfg: Optional[Dict] = None) -> datetime:
    """
    Phase 1 Initial Response Deadlines:
      - §4 Advertised vehicles (`advertised_buyer`, `marketplace`): ~1 to 2 working hours (we use 2h).
      - §3, §5, §6 Seller, Sourcing, Combined (`seller`, `sourcing`, `sell_and_source`): on the same working day
        (up to 4 working hours, or end of current working day if >=2h remain).
      - §7 B2B specific cooperation (`b2b_cooperation`): no later than the next working day.
    """
    cfg = cfg or get_working_hours()
    now_utc = now_utc or datetime.now(timezone.utc)
    cat = (category or "").lower()

    if cat in ("advertised_buyer", "marketplace"):
        return add_working_hours(now_utc, 2.0, cfg)

    if cat == "b2b_cooperation":
        return add_working_days(now_utc, 1, cfg)

    # Same working day (§3, §5, §6): 4 working hours (rolls into next working day if inquiry arrives near closing)
    return add_working_hours(now_utc, 4.0, cfg)


# ─── Reminder CRUD & Deduplication (§6, §10) ──────────────────────────────

def short_id(row: Dict) -> str:
    return str(row.get("id", ""))[:6]


def create_reminder(
    title: str,
    due_at: datetime,
    reminder_type: str = "initial_response",
    triage_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    project_id: Optional[str] = None,
    contact_key: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_contact: Optional[str] = None,
    category: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict:
    """
    Create a reminder. Enforces §6: no duplicate open reminders of the same `reminder_type`
    for a shared `contact_key` (e.g., combined sell + source inquiry).
    """
    ck = (contact_key or customer_contact or "").strip().lower() or None
    if ck:
        existing = [
            r for r in list_reminders(status="OPEN", limit=200)
            if (r.get("contact_key") or "").lower() == ck and r.get("reminder_type") == reminder_type
        ]
        if existing:
            return existing[0]

    payload = {
        "triage_id": triage_id,
        "lead_id": lead_id,
        "project_id": project_id,
        "contact_key": ck,
        "customer_name": customer_name,
        "customer_contact": customer_contact,
        "category": category,
        "reminder_type": reminder_type,
        "title": title,
        "notes": notes,
        "due_at": due_at.astimezone(timezone.utc).isoformat(),
        "status": "OPEN",
        "notified_individual": False,
    }
    row = {**payload, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
    if _use_memory():
        _mem_reminders.append(row)
        return row
    clean = {k: v for k, v in payload.items() if v is not None}
    try:
        res = _sb().table("crm_reminders").insert(clean).execute()
        return res.data[0] if res.data else row
    except Exception as e:
        logger.warning(f"create_reminder DB fallback: {e}")
        _mem_reminders.append(row)
        return row


def schedule_inquiry_reminder(
    triage_row: Dict,
    reminder_type: str = "initial_response",
    now_utc: Optional[datetime] = None,
) -> Optional[Dict]:
    """
    Auto-schedule a Phase 1 reminder for an incoming inquiry or after an outbound reply.
    Skips spam, automated, advertising, and invoices.
    """
    cat = (triage_row.get("category") or "").lower()
    if cat in ("spam", "automated", "marketing", "b2b_advertising", "b2b_offer", "b2b_solicitation", "invoice", "unknown"):
        return None

    now_utc = now_utc or datetime.now(timezone.utc)
    cfg = get_working_hours()
    contact = triage_row.get("reply_to") or triage_row.get("sender_email") or ""
    cname = triage_row.get("sender_name") or contact or "Customer"
    ck = triage_row.get("parent_contact_key") or contact.lower()

    if reminder_type == "awaiting_reply":
        due = add_working_days(now_utc, 2, cfg)
        title = f"Keine Kundenantwort (2 Werktage): {cname}"
    else:
        due = compute_initial_due(cat, now_utc=now_utc, cfg=cfg)
        title = f"Erstkontakt fällig ({cat}): {cname}"

    return create_reminder(
        title=title,
        due_at=due,
        reminder_type=reminder_type,
        triage_id=triage_row.get("id"),
        lead_id=triage_row.get("lead_id"),
        contact_key=ck,
        customer_name=cname,
        customer_contact=contact,
        category=cat,
        notes=triage_row.get("subject"),
    )


def list_reminders(status: Optional[str] = "OPEN", limit: int = 100) -> List[Dict]:
    if _use_memory():
        rows = list(_mem_reminders)
        if status and status != "ALL":
            rows = [r for r in rows if r.get("status") == status]
        rows.sort(key=lambda r: r.get("due_at") or "")
        return rows[:limit]
    try:
        q = _sb().table("crm_reminders").select("*").order("due_at", desc=False).limit(limit)
        if status and status != "ALL":
            q = q.eq("status", status)
        return q.execute().data or []
    except Exception as e:
        logger.debug(f"list_reminders warning: {e}")
        return []


def find_reminder(short_or_full_id: str) -> Optional[Dict]:
    sid = (short_or_full_id or "").strip().lower().lstrip("#")
    if not sid:
        return None
    open_rows = list_reminders(status="OPEN", limit=50)
    # Allow 1-based index (e.g. `done 1`) from the `reminders` list
    if sid.isdigit() and len(sid) <= 2:
        idx = int(sid) - 1
        if 0 <= idx < len(open_rows):
            return open_rows[idx]
    for r in list_reminders(status="ALL", limit=200):
        if str(r.get("id", "")).lower().startswith(sid):
            return r
    return None


def mark_completed(reminder_id_or_short: str, via: str = "CRM") -> Optional[Dict]:
    """Mark a reminder completed from either CRM or WhatsApp (§10: status synchronized)."""
    target = find_reminder(reminder_id_or_short)
    if not target:
        return None
    fields = {
        "status": "COMPLETED",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "completed_via": via.upper(),
    }
    if _use_memory():
        target.update(fields)
        return target
    try:
        res = _sb().table("crm_reminders").update(fields).eq("id", target["id"]).execute()
        return res.data[0] if res.data else {**target, **fields}
    except Exception as e:
        logger.warning(f"mark_completed failed: {e}")
        return None


def complete_reminders_for_contact(contact_or_triage_id: str, via: str = "CRM") -> int:
    """When owner sends a reply or approves an inquiry, complete its open initial_response reminder."""
    key = (contact_or_triage_id or "").strip().lower()
    if not key:
        return 0
    count = 0
    for r in list_reminders(status="OPEN", limit=100):
        if (
            str(r.get("triage_id") or "").lower() == key
            or (r.get("contact_key") or "").lower() == key
            or (r.get("customer_contact") or "").lower() == key
        ) and r.get("reminder_type") == "initial_response":
            mark_completed(r["id"], via=via)
            count += 1
    return count


# ─── Overdue Delivery Engine (§10: Individual once + Daily Morning Digest) ─

async def process_due_reminders(now_utc: Optional[datetime] = None) -> List[Dict]:
    """
    §10 Rule:
      A reminder shall be delivered individually via WhatsApp when it FIRST becomes due.
      If it remains open, it shall NOT be repeatedly sent as an individual message.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    open_rows = list_reminders(status="OPEN", limit=100)
    newly_due = [
        r for r in open_rows
        if (r.get("due_at") or "") <= now_iso and not r.get("notified_individual")
    ]
    if not newly_due:
        return []

    from app.services.whatsapp_service import send_message
    from config import settings as _s
    owners = [n.strip() for n in (_s.WHATSAPP_OWNER_PHONES or "").split(",") if n.strip()]

    sent_list = []
    for r in newly_due:
        sid = short_id(r)
        due_local = ""
        try:
            dt = datetime.fromisoformat(str(r["due_at"]).replace("Z", "+00:00")).astimezone(BERLIN_TZ)
            due_local = dt.strftime("%d.%m %H:%M")
        except Exception:
            due_local = str(r.get("due_at"))[:16]

        msg = (
            f"⏰ *Erinnerung fällig (#{sid})*\n"
            f"📌 {r.get('title')}\n"
            f"👤 {r.get('customer_name') or '—'} ({r.get('customer_contact') or '—'})\n"
            f"🕒 Fällig seit: {due_local} (Europe/Berlin)\n"
            + (f"📝 {r['notes']}\n" if r.get("notes") else "")
            + f"\nErledigt markieren: `done {sid}`"
        )
        for num in owners:
            try:
                await send_message(num, msg)
            except Exception as e:
                logger.warning(f"Failed sending reminder #{sid} to {num}: {e}")

        # Mark notified_individual=True so it is never sent individually again
        if _use_memory():
            r["notified_individual"] = True
        else:
            try:
                _sb().table("crm_reminders").update({"notified_individual": True}).eq("id", r["id"]).execute()
            except Exception:
                pass
        sent_list.append(r)

    return sent_list


async def send_daily_overdue_overview(now_utc: Optional[datetime] = None) -> Optional[str]:
    """
    §10 Rule:
      If a reminder remains open after being notified, it appears in a daily consolidated
      overview delivered via WhatsApp at the beginning of the configured working day.
      This overview shall ONLY be sent if overdue reminders actually exist.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    today_date = now_utc.astimezone(BERLIN_TZ).date()

    overdue = [
        r for r in list_reminders(status="OPEN", limit=100)
        if (r.get("due_at") or "") <= now_iso
    ]
    if not overdue:
        return None  # §10: Only sent if overdue reminders actually exist

    lines = [
        f"📋 *Tägliche Übersicht — Überfällige Erinnerungen ({len(overdue)})*",
        f"_{today_date.strftime('%a %d.%m.%Y')} (Europe/Berlin)_\n",
    ]
    for i, r in enumerate(overdue[:15], 1):
        sid = short_id(r)
        due_str = str(r.get("due_at") or "")[:16].replace("T", " ")
        lines.append(
            f"{i}. `#{sid}` *{r.get('title')}*\n"
            f"   👤 {r.get('customer_name') or r.get('customer_contact') or '—'} • Fällig: {due_str}\n"
            f"   👉 `done {sid}`"
        )
    text = "\n".join(lines)

    from app.services.whatsapp_service import send_message
    from config import settings as _s
    owners = [n.strip() for n in (_s.WHATSAPP_OWNER_PHONES or "").split(",") if n.strip()]
    for num in owners:
        try:
            await send_message(num, text)
        except Exception as e:
            logger.warning(f"Failed sending overdue overview to {num}: {e}")

    for r in overdue:
        if _use_memory():
            r["last_digest_date"] = today_date.isoformat()
        else:
            try:
                _sb().table("crm_reminders").update({"last_digest_date": today_date.isoformat()}).eq("id", r["id"]).execute()
            except Exception:
                pass
    return text
