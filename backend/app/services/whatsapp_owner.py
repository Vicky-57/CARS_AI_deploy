"""
app/services/whatsapp_owner.py
────────────────────────────────────────────────────────────────────────
Founder Cockpit commands & interactive multi-step WhatsApp wizards:
  - help            (only place showing menu buttons/options)
  - summary / leads / deals / convert / stage / reset
  - customer <query> with duplicate-name disambiguation (name | phone | email)
  - schedule / meetings / cancel meeting / reschedule (free slots + clash guard)
  - upload          (store personalized customer documents, NO OCR)
  - scan / ocr      (parse vehicle/ID docs into CRM & template fields)
  - clean plain-text responses everywhere else (no persistent footer)
────────────────────────────────────────────────────────────────────────
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from app.services import crm_service as crm
from app.services import document_service as docs
from app.services import meeting_service as ms
from app.services import whatsapp_store as store
from app.services.whatsapp_service import download_media, send_message

logger = logging.getLogger("whatsapp_owner")

_LABEL_ICON = {"HOT": "🔥", "WARM": "🟡", "COLD": "❄️"}

HELP_MENU_BUTTONS = [
    ("summary", "📊 Summary", "KPI snapshot & deal stages"),
    ("leads", "👥 Leads", "Latest 10 leads"),
    ("deals", "🚗 Deals", "Active Kanban deals"),
    ("customer", "🔍 Find customer", "Search by name, phone or email"),
    ("schedule", "📅 Schedule meeting", "Book free slot with client"),
    ("meetings", "🗓️ My meetings", "Today & upcoming meetings"),
    ("upload", "📎 Upload document", "Save file to customer folder"),
    ("scan", "🔎 Scan doc (OCR)", "Extract fields & contract PDF"),
    ("reset", "🔄 Reset session", "Restart qualification test"),
    ("today", "📋 Today's inquiries", "All leads, params, missing info & drafts"),
    ("mail", "📩 Email review (mail)", "Approve drafts, reclassify or flag spam"),
    ("b2b", "🤝 B2B & Partners", "B2B deals & cooperation offers"),
    ("reminders", "⏰ Reminders", "Follow-up deadlines & mark done"),
    ("docs", "📂 Customer docs", "List files in customer Drive folder"),
]

HELP_TEXT = (
    "🚗 *CAR-AGENTS Assistant — Help*\n"
    "Tap an option (1-14) or type a command:\n"
    "• `customer <name | phone | email>`\n"
    "• `docs <name | phone | email>` — list customer documents\n"
    "• `today` — today's inquiries (qualified & unqualified, params & drafts)\n"
    "• `mail` — list pending email IDs (`#id` or `1, 2, 3...`)\n"
    "  `mail send <id>` • `mail ok <id>` • `mail no <id>`\n"
    "  `mail type <id> <seller|sourcing|b2b_offer|invoice|spam>`\n"
    "• `b2b` — B2B deals & offers\n"
    "• `reminders` • `done <id>` — follow-up reminders & completion sync\n"
    "• `convert <lead>` • `stage <client> <stage>`\n"
    "• `cancel meeting` • `reschedule`"
)

OWNER_CMDS = {
    "help", "/help", "hilfe", "?",
    "leads", "anfragen", "/leads",
    "deals", "projekte", "projects", "/deals",
    "summary", "zusammenfassung", "status", "/summary",
    "reset", "/reset",
    "customer", "kunde", "find", "/customer",
    "docs", "/docs", "documents", "dokumente",
    "mail", "/mail", "emails", "triage",
    "today", "/today", "heute", "inquiries",
    "b2b", "/b2b",
    "reminders", "/reminders", "erinnerungen", "tasks",
    "done", "/done", "erledigt",
    "convert", "/convert",
    "stage", "/stage",
    "schedule", "/schedule", "meeting", "termin",
    "meetings", "/meetings", "termine",
    "reschedule", "/reschedule",
    "upload", "/upload",
    "scan", "/scan", "ocr", "/ocr",
    "cancel", "/cancel",
}


def is_owner_command(text: Optional[str]) -> bool:
    if not text:
        return False
    low = text.strip().lower()
    if low in ("cancel meeting", "abbrechen"):
        return True
    cmd = low.partition(" ")[0]
    return cmd in OWNER_CMDS


def is_explicit_exit(text: Optional[str]) -> bool:
    if not text:
        return False
    low = text.strip().lower()
    return low in (
        "reset", "/reset", "cancel", "/cancel", "abort", "stop", "abbrechen",
        "help", "/help", "summary", "leads", "deals", "meetings",
    )


# ─── Formatting Helpers (shared clean outputs) ────────────────────────────

def _lead_label(lead: Dict) -> str:
    label = lead.get("lead_label")
    if not label:
        import re
        m = re.search(r"\b(HOT|WARM|COLD)\b", lead.get("notes") or "")
        label = m.group(1) if m else None
    return f"{_LABEL_ICON.get(label, '•')} {label}" if label else "• new"


def format_leads(leads: List[Dict]) -> str:
    if not leads:
        return "No leads yet."
    lines = ["Latest leads:"]
    for i, l in enumerate(leads, 1):
        intent = (l.get("intent") or "UNKNOWN").replace("_INTENT", "")
        lines.append(
            f"{i}. {l.get('name') or 'Unknown'} - {intent} - {_lead_label(l)} ({l.get('channel') or '?'})"
            + (f"\n   📞 {l['phone']}" if l.get("phone") else "")
        )
    return "\n".join(lines)


def format_deals(projects: List[Dict]) -> str:
    if not projects:
        return "No active deals."
    lines = ["Active deals:"]
    for i, p in enumerate(projects, 1):
        lines.append(f"{i}. {p.get('client_name')} - {p.get('target_vehicle') or 'n/a'}\n   Stage: {p.get('current_stage') or 'n/a'}")
    return "\n".join(lines)


def format_summary(leads: List[Dict], projects: List[Dict]) -> str:
    new_leads = sum(1 for l in leads if (l.get("status") or "NEW") == "NEW")
    hot = sum(1 for l in leads if "HOT" in _lead_label(l))
    stages: Dict[str, int] = {}
    for p in projects:
        stages[p.get("current_stage") or "n/a"] = stages.get(p.get("current_stage") or "n/a", 0) + 1
    stage_txt = "\n".join(f"   • {k}: {v}" for k, v in stages.items()) or "   none"
    base = f"📊 *Summary:*\n• New leads: {new_leads}\n• Hot leads: {hot}\n• Active deals: {len(projects)}\n{stage_txt}"
    try:
        from app.services import email_triage_store as tstore
        st = tstore.stats(30)
        if st.get("total"):
            d = st["decisions"]
            base += (
                f"\n\n📩 *Email triage (30d):* {st['total']} scanned — "
                f"leads: {d.get('lead', 0)}, replies: {d.get('reply', 0)}, "
                f"review: {d.get('review', 0)}, dropped: {d.get('drop', 0)}"
            )
    except Exception:
        pass
    return base


def _pick_index(text: str, reply_id: str, count: int, prefix: str = "") -> Optional[int]:
    """Parse 1-based numbered input or `{prefix}{idx}` button ID into 0-based index."""
    if reply_id and prefix and reply_id.startswith(prefix):
        tail = reply_id[len(prefix):]
        if tail.isdigit():
            idx = int(tail)
            if 0 <= idx < count:
                return idx
    raw = (text or "").strip()
    if raw.isdigit():
        idx = int(raw) - 1
        if 0 <= idx < count:
            return idx
    return None


def _next_working_days(limit: int = 7) -> List[date]:
    today = datetime.now(ms.BERLIN_TZ).date()
    days: List[date] = []
    offset = 0
    while len(days) < limit and offset < 14:
        d = today + timedelta(days=offset)
        if d.weekday() in ms.WORK_DAYS:
            days.append(d)
        offset += 1
    return days


def _date_label(d: date) -> str:
    today = datetime.now(ms.BERLIN_TZ).date()
    if d == today:
        return f"Today ({d.strftime('%a %d.%m')})"
    if d == today + timedelta(days=1):
        return f"Tomorrow ({d.strftime('%a %d.%m')})"
    return d.strftime("%a %d.%m.%Y")


def _parse_user_date(raw: str) -> Optional[date]:
    s = (raw or "").strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%d.%m":
                dt = dt.replace(year=datetime.now(ms.BERLIN_TZ).year)
            return dt.date()
        except ValueError:
            continue
    return None


# ─── Entry Point for Owner Messages ──────────────────────────────────────

async def handle_owner(phone: str, inp: Dict, text: str) -> None:
    session = store.get_session(phone)
    mode = (session or {}).get("mode", "")
    btn_id = (inp.get("reply_id") or "").lower().strip()
    low = (text or "").strip().lower()

    # Global cancel out of any founder wizard
    if mode.startswith("owner_") and mode != "owner_help" and low in ("cancel", "/cancel", "abort", "abbrechen"):
        store.delete_session(phone)
        await send_message(phone, "❌ Cancelled.")
        return

    # Incoming image/document while inside upload or scan wizard -> handle directly
    if inp["type"] in ("image", "document"):
        if mode == "owner_upload":
            await _step_upload_file(phone, session, inp)
            return
        if mode == "owner_scan":
            await _step_scan_file(phone, session, inp)
            return
        # Unprompted media: ask clearly Upload vs Scan (two separate workflows!)
        store.save_session(phone, {
            "mode": "owner_file_route",
            "done": True,
            "media_id": inp["media_id"],
            "mime": inp["mime"],
            "filename": inp.get("filename"),
        })
        await send_message(
            phone,
            "📎 Document received. What would you like to do with it?",
            buttons=[
                ("route_upload", "📎 Upload Document", "Save to customer folder (no OCR)"),
                ("route_scan", "🔎 Scan (OCR)", "Extract fields into templates"),
            ],
        )
        return

    # 1. Handle Help menu selection ONLY right after `help` was opened
    if mode == "owner_help":
        idx = _pick_index(low, btn_id, len(HELP_MENU_BUTTONS))
        chosen_cmd = None
        if btn_id in {b[0] for b in HELP_MENU_BUTTONS}:
            chosen_cmd = btn_id
        elif idx is not None:
            chosen_cmd = HELP_MENU_BUTTONS[idx][0]
        if chosen_cmd:
            store.delete_session(phone)
            await _dispatch_command(phone, chosen_cmd, "", "")
            return
        # User typed another word/command -> clear help mode and run normal dispatch
        store.delete_session(phone)
        session = None
        mode = ""

    # 2. Handle active founder multi-step workflows (unless user runs an explicit top-level command)
    if mode.startswith("owner_") and not is_owner_command(low):
        if mode == "owner_file_route":
            await _handle_file_route_choice(phone, session, low, btn_id)
            return
        if mode == "owner_find_prompt":
            store.delete_session(phone)
            if session.get("action") == "docs":
                await _cmd_docs(phone, (text or "").strip())
            else:
                await _cmd_customer(phone, (text or "").strip())
            return
        if mode == "owner_customer_pick":
            await _handle_customer_pick(phone, session, low, btn_id)
            return
        if mode == "owner_schedule":
            await _handle_schedule_step(phone, session, text, btn_id)
            return
        if mode == "owner_meetings_action":
            await _handle_meetings_action(phone, session, low, btn_id)
            return
        if mode == "owner_upload":
            await _handle_upload_step(phone, session, text, btn_id)
            return
        if mode == "owner_scan":
            await _handle_scan_step(phone, session, text, btn_id)
            return

    # 3. Direct top-level command dispatch (clears stale owner wizard cleanly)
    if mode.startswith("owner_"):
        store.delete_session(phone)

    if low == "cancel meeting":
        await _start_meetings_action(phone, "cancel")
        return

    cmd, _, arg = (text or "").strip().partition(" ")
    await _dispatch_command(phone, btn_id or cmd.lower().lstrip("/"), arg.strip(), text.strip())


async def _dispatch_command(phone: str, cmd: str, arg: str, raw_text: str) -> None:
    # Allow bare menu number 1..14 anytime the owner is not inside a wizard or qualification flow
    if cmd.isdigit() and not arg:
        idx = int(cmd) - 1
        if 0 <= idx < len(HELP_MENU_BUTTONS):
            cmd = HELP_MENU_BUTTONS[idx][0]

    if cmd == "reset":
        store.delete_session(phone)
        await send_message(phone, "🔄 Session reset. Send a customer message (e.g. 'Hallo, ich möchte ein Auto kaufen') to test qualification, or `help` for commands.")
        return
    if cmd in ("help", "hilfe", "?"):
        store.save_session(phone, {"mode": "owner_help", "done": True})
        await send_message(phone, HELP_TEXT, buttons=HELP_MENU_BUTTONS)
        return
    if cmd in ("leads", "anfragen"):
        await send_message(phone, format_leads(store.list_leads(10)))
        return
    if cmd in ("deals", "projekte", "projects"):
        await send_message(phone, format_deals(store.list_active_projects()))
        return
    if cmd in ("summary", "zusammenfassung", "status"):
        await send_message(phone, format_summary(store.list_leads(200), store.list_active_projects(100)))
        return
    if cmd in ("reminders", "erinnerungen", "tasks"):
        await _cmd_reminders(phone, arg)
        return
    if cmd in ("done", "erledigt"):
        await _cmd_reminder_done(phone, arg)
        return
    if cmd in ("today", "heute", "inquiries"):
        await _cmd_today(phone, arg)
        return
    if cmd == "b2b":
        await _cmd_b2b(phone)
        return
    if cmd in ("mail", "emails", "triage"):
        await _cmd_mail(phone, arg)
        return
    if cmd in ("docs", "documents", "dokumente"):
        await _cmd_docs(phone, arg)
        return
    if cmd in ("customer", "kunde", "find"):
        await _cmd_customer(phone, arg)
        return
    if cmd == "convert":
        await _cmd_convert(phone, arg)
        return
    if cmd == "stage":
        await _cmd_stage(phone, arg)
        return
    if cmd in ("schedule", "meeting", "termin"):
        await _start_schedule(phone, arg)
        return
    if cmd in ("meetings", "termine"):
        await _cmd_list_meetings(phone)
        return
    if cmd == "reschedule":
        await _start_meetings_action(phone, "reschedule")
        return
    if cmd == "cancel":
        await _start_meetings_action(phone, "cancel")
        return
    if cmd == "upload":
        await _start_upload(phone, arg)
        return
    if cmd in ("scan", "ocr"):
        await _start_scan(phone, arg)
        return

    await send_message(phone, "Unknown command. Type `help` for options.")


# ─── Customer Search & Disambiguation ─────────────────────────────────────

def _drive_folder_for(cust: Dict) -> Optional[str]:
    """Customer's Drive folder URL (fast 2-call lookup without creating all 3 subfolders)."""
    if store.MEMORY:
        return None
    try:
        from app.services.google_service import is_connected
        if not is_connected():
            return None
        from app.services.gdrive_service import create_customer_folder_structure
        ref_id = str(cust.get("project_id") or cust.get("lead_id") or "")[:8]
        if not ref_id:
            return None
        struct = create_customer_folder_structure(cust.get("name") or "Customer", ref_id, create_subfolders=False)
        return struct.get("customer_folder_url")
    except Exception as e:
        logger.warning(f"Drive folder lookup failed for {cust.get('name')}: {e}")
        return None


async def _card_with_drive(cust: Dict) -> str:
    import asyncio
    card = crm.format_customer_card(cust)
    url = None
    try:
        url = await asyncio.wait_for(asyncio.to_thread(_drive_folder_for, cust), timeout=3.5)
    except asyncio.TimeoutError:
        logger.info(f"Drive folder lookup timed out (>3.5s) for {cust.get('name')}; warming in background.")
        import threading
        threading.Thread(target=_drive_folder_for, args=(cust,), daemon=True).start()
    except Exception:
        pass
    if url:
        card += f"\n📁 Documents: {url}"
    else:
        # Check if any stored document in DB already has a drive_url
        db_docs = _collect_db_docs(cust)
        if db_docs and db_docs[0].get("url"):
            card += f"\n📄 Latest Doc: {db_docs[0]['url']}"
        else:
            card += "\n📁 Documents: Use `docs` or `upload` to view/add files"
    return card


async def _cmd_customer(phone: str, query: str) -> None:
    if not query:
        store.save_session(phone, {"mode": "owner_find_prompt", "done": True})
        await send_message(
            phone,
            "🔍 *Find Customer*\nSend a name, phone number (e.g. `+49170...`), or email:",
        )
        return

    matches = store.search_customers(query, limit=8)
    if not matches:
        await send_message(
            phone,
            f"Nothing found for '{query}'. Try full name, phone (`customer +49...`), or email (`customer max@mail.de`).",
        )
        return

    if len(matches) == 1:
        await send_message(phone, await _card_with_drive(matches[0]))
        return

    # Multiple customers matched -> show disambiguation picklist
    refs = [crm.to_session_ref(m) for m in matches]
    store.save_session(phone, {"mode": "owner_customer_pick", "done": True, "matches": refs})
    btns = [
        (f"cust_{i}", crm.disambiguate_row_title(m), crm.disambiguate_row_desc(m))
        for i, m in enumerate(matches)
    ]
    await send_message(
        phone,
        f"🔍 Found {len(matches)} customers matching '{query}'. Pick one (or search by `customer <phone>` / `customer <email>`):",
        buttons=btns,
    )


async def _handle_customer_pick(phone: str, session: Dict, low: str, btn_id: str) -> None:
    matches = session.get("matches") or []
    idx = _pick_index(low, btn_id, len(matches), prefix="cust_")
    if idx is None:
        # Allow typing a new phone/email right away to refine search
        store.delete_session(phone)
        if session.get("action") == "docs":
            await _cmd_docs(phone, low)
        else:
            await _cmd_customer(phone, low)
        return
    store.delete_session(phone)
    if session.get("action") == "docs":
        await _send_docs_list(phone, matches[idx])
        return
    await send_message(phone, await _card_with_drive(matches[idx]))


# ─── Customer Documents Listing ───────────────────────────────────────────

_DOCS_SUBFOLDERS = [
    ("1. OCR", "ocr_folder_id"),
    ("2. Legal Docs", "legal_docs_folder_id"),
    ("3. Signed Docs", "signed_docs_folder_id"),
]


def _collect_db_docs(cust: Dict) -> List[Dict]:
    """Fast (<80ms) Supabase lookup of customer_documents by lead_id, project_id, or customer_name."""
    rows: List[Dict] = []
    seen = set()
    for kw in ({"lead_id": cust.get("lead_id")}, {"project_id": cust.get("project_id")}):
        if not list(kw.values())[0]:
            continue
        for d in store.list_customer_documents(limit=20, **kw):
            if d.get("id") not in seen:
                seen.add(d.get("id"))
                rows.append(d)
    if not rows and not store.MEMORY and cust.get("name"):
        try:
            from database import get_supabase
            by_name = (
                get_supabase()
                .table("customer_documents")
                .select("*")
                .ilike("customer_name", f"*{cust['name'].strip()}*")
                .order("created_at", desc=True)
                .limit(15)
                .execute()
                .data or []
            )
            for d in by_name:
                if d.get("id") not in seen:
                    seen.add(d.get("id"))
                    rows.append(d)
        except Exception:
            pass
    return [
        {
            "name": d.get("filename"),
            "url": d.get("file_url") or d.get("drive_url"),
            "category": d.get("category") or "doc",
            "created": str(d.get("created_at") or "")[:10],
        }
        for d in rows
    ]


def _collect_drive_docs(cust: Dict) -> Optional[Dict]:
    """Parallel Google Drive subfolder listing (runs inside a 3.5s timeout budget)."""
    if store.MEMORY:
        return None
    from concurrent.futures import ThreadPoolExecutor
    from app.services.google_service import is_connected
    if not is_connected():
        return None
    from app.services.gdrive_service import create_customer_folder_structure, list_folder_files
    ref_id = str(cust.get("project_id") or cust.get("lead_id") or "")[:8]
    if not ref_id:
        return None
    struct = create_customer_folder_structure(cust.get("name") or "Customer", ref_id)
    out: Dict = {"folder_url": struct.get("customer_folder_url"), "groups": [], "source": "drive"}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = [(label, pool.submit(list_folder_files, struct[key])) for label, key in _DOCS_SUBFOLDERS]
        for label, fut in futs:
            try:
                out["groups"].append((label, fut.result(timeout=2.5)))
            except Exception:
                out["groups"].append((label, []))
    return out


async def _send_docs_list(phone: str, cust: Dict) -> None:
    import asyncio
    import threading

    db_files = _collect_db_docs(cust)
    data = None
    try:
        data = await asyncio.wait_for(asyncio.to_thread(_collect_drive_docs, cust), timeout=3.5)
    except asyncio.TimeoutError:
        logger.info(f"Drive listing exceeded 3.5s for {cust.get('name')}; falling back to instant DB docs & warming cache.")
        threading.Thread(target=_collect_drive_docs, args=(cust,), daemon=True).start()
    except Exception as e:
        logger.warning(f"Drive listing fallback for {cust.get('name')}: {e}")

    if not data:
        data = {"folder_url": None, "groups": [("Saved documents", db_files)], "source": "db"}
    else:
        # Also include any DB-recorded files whose URLs aren't in the Drive subfolder list yet
        drive_names = {f.get("name") for _, grp in data["groups"] for f in grp}
        extra_db = [f for f in db_files if f.get("name") not in drive_names]
        if extra_db:
            data["groups"].append(("CRM Stored Docs", extra_db))

    lines = [f"📂 *Documents — {cust.get('name') or 'Customer'}*"]
    total = 0
    for label, files in data["groups"]:
        if not files:
            continue
        lines.append(f"\n*{label}*")
        for f in files[:6]:
            total += 1
            lines.append(f"• {f['name']} ({f['created']})\n  {f['url'] or '(no link)'}")
    if total == 0:
        lines.append("\nNo documents stored yet. Use `upload` (or option `7`) to add one.")
    if data.get("folder_url"):
        lines.append(f"\n📁 Folder: {data['folder_url']}")
    await send_message(phone, "\n".join(lines))


async def _cmd_docs(phone: str, query: str) -> None:
    if not query:
        store.save_session(phone, {"mode": "owner_find_prompt", "done": True, "action": "docs"})
        await send_message(phone, "📂 *Documents*\nSend a customer name, phone, or email:")
        return
    matches = store.search_customers(query, limit=8)
    if not matches:
        await send_message(phone, f"Nothing found for '{query}'. Try `docs <name | phone | email>`.")
        return
    if len(matches) == 1:
        await _send_docs_list(phone, matches[0])
        return
    refs = [crm.to_session_ref(m) for m in matches]
    store.save_session(phone, {"mode": "owner_customer_pick", "done": True, "matches": refs, "action": "docs"})
    btns = [(f"cust_{i}", crm.disambiguate_row_title(m), crm.disambiguate_row_desc(m)) for i, m in enumerate(matches)]
    await send_message(phone, f"📂 Found {len(matches)} customers matching '{query}'. Pick one:", buttons=btns)


async def _cmd_reminders(phone: str, arg: str = "") -> None:
    from app.services import reminder_service as rs

    rows = rs.list_reminders(status="OPEN", limit=20)
    cfg = rs.get_working_hours()
    now_iso = datetime.now(timezone.utc).isoformat()
    overdue = [r for r in rows if (r.get("due_at") or "") <= now_iso]
    upcoming = [r for r in rows if (r.get("due_at") or "") > now_iso]

    lines = [
        f"⏰ *Phase 1 Reminders & Follow-Ups*",
        f"Working hours: {cfg.get('start_hour', 9):02d}:00–{cfg.get('end_hour', 18):02d}:00 (Bavaria / BY holidays active)",
        f"Open: {len(rows)} • Overdue: {len(overdue)} • Upcoming: {len(upcoming)}",
    ]
    if not rows:
        lines.append("\nNo open reminders.")
    else:
        for i, r in enumerate(rows[:12], 1):
            sid = rs.short_id(r)
            is_od = (r.get("due_at") or "") <= now_iso
            tag = "🔴 OVERDUE" if is_od else "🟡 DUE"
            due_txt = str(r.get("due_at") or "")[:16].replace("T", " ")
            lines.append(
                f"\n*{i}.* `#{sid}` [{tag}] *{r.get('title')}*\n"
                f"  👤 {r.get('customer_name') or r.get('customer_contact') or '—'} • {due_txt}\n"
                f"  👉 `done {i}` _(or `done {sid}`)_"
            )
    await send_message(phone, "\n".join(lines))


async def _cmd_reminder_done(phone: str, arg: str = "") -> None:
    from app.services import reminder_service as rs

    sid = (arg or "").strip()
    if not sid:
        await send_message(phone, "Usage: `done <reminder_id>` (e.g. `done a1b2c3`). Type `reminders` to see open items.")
        return
    updated = rs.mark_completed(sid, via="WHATSAPP")
    if not updated:
        await send_message(phone, f"No reminder found matching `{sid}`. Type `reminders` to list open reminders.")
        return
    await send_message(phone, f"✅ Reminder `#{rs.short_id(updated)}` (*{updated.get('title')}*) marked as completed & synced with CRM.")


async def _cmd_today(phone: str, arg: str = "") -> None:
    """
    Phase 1 Owner View: Shows all inquiries (qualified AND non-qualified, with extracted
    parameters, missing requirements, and queries), excluding flagged spam.
    """
    from app.services import email_triage_store as tstore

    rows = tstore.list_inquiries(limit=100)
    visible = [r for r in rows if r.get("decision") != "drop" and r.get("category") not in ("spam", "automated", "marketing", "b2b_advertising")]
    flagged_count = len(rows) - len(visible)

    if not visible:
        await send_message(phone, f"📋 *Inquiries Overview*\nNo non-spam inquiries found ({flagged_count} flagged spam hidden).")
        return

    def _is_b2b_or_inv(r: Dict) -> bool:
        cat = str(r.get("category") or "").lower()
        return r.get("decision") in ("b2b", "invoice") or cat == "invoice" or cat.startswith("b2b")

    qual = [r for r in visible if r.get("is_qualified") and not _is_b2b_or_inv(r)]
    unqual = [r for r in visible if not r.get("is_qualified") and not _is_b2b_or_inv(r)]
    b2b_inv = [r for r in visible if _is_b2b_or_inv(r)]

    lines = [
        f"📋 *Phase 1 Inquiries Overview*",
        f"✅ Qualified: {len(qual)} • ⏳ Needs Info: {len(unqual)} • 🤝 B2B/Invoices: {len(b2b_inv)} • 🚫 Flagged Spam hidden: {flagged_count}",
    ]

    def _clean_sender(r: Dict) -> str:
        raw = (r.get("sender_name") or r.get("sender_email") or "Client").strip()
        if "-mo-mo" in raw or "kontakt.mobile.de" in (r.get("sender_email") or ""):
            veh = (r.get("extracted_params") or {}).get("manufacturer_model") or "Vehicle"
            return f"mobile.de Buyer ({veh[:22]})"
        return raw[:28]

    def _fmt_item(r: Dict) -> str:
        sid = tstore.short_id(r)
        params = r.get("extracted_params") or {}
        p_str = ", ".join(f"{k}: {v}" for k, v in list(params.items())[:3]) or "—"
        miss = r.get("missing_fields") or []
        m_str = ", ".join(miss[:2]) or "Complete"
        q_str = " ".join((r.get("body_preview") or r.get("subject") or "").split())[:55]
        return (
            f"• `#{sid}` *{_clean_sender(r)}* [{r.get('category')}]\n"
            f"  🔍 {p_str} | ❓ {m_str}\n"
            f"  💬 _{q_str}_"
        )

    if qual:
        lines.append("\n*✅ Qualified Inquiries:*")
        for r in qual[:3]:
            lines.append(_fmt_item(r))
    if unqual:
        lines.append("\n*⏳ Inquiries Missing Info (Non-Qualified):*")
        for r in unqual[:3]:
            lines.append(_fmt_item(r))
    if b2b_inv:
        lines.append("\n*🤝 B2B & Invoices:*")
        for r in b2b_inv[:3]:
            sid = tstore.short_id(r)
            dl = f" (Due: {r['payment_deadline']})" if r.get("payment_deadline") else ""
            lines.append(f"• `#{sid}` [{r.get('category')}] {r.get('sender_email')[:28]} — _{(r.get('subject') or '')[:34]}_{dl}")

    lines.append("\n👉 _Approve/edit: `mail send <id>` | `mail ok <id>` | `mail type <id> seller` | `mail no <id>`_")
    await send_message(phone, "\n".join(lines))


async def _cmd_b2b(phone: str) -> None:
    from app.services import email_triage_store as tstore

    deals = tstore.list_b2b_deals(limit=10)
    inquiries = [r for r in tstore.list_inquiries(limit=40) if r.get("decision") == "b2b" or str(r.get("category", "")).startswith("b2b")]
    lines = [f"🤝 *B2B Cooperation & Offers* — Active deals: {len(deals)} • B2B mails: {len(inquiries)}"]
    if deals:
        lines.append("\n*B2B Deals:*")
        for d in deals[:6]:
            lines.append(f"• *{d.get('company_name')}* ({d.get('status')}) — {d.get('contact_email')}")
    if inquiries:
        lines.append("\n*Recent B2B Mails:*")
        for r in inquiries[:6]:
            lines.append(f"• `#{tstore.short_id(r)}` [{r.get('category')}] {r.get('sender_email')} — _{(r.get('subject') or '')[:40]}_")
    await send_message(phone, "\n".join(lines))


async def _cmd_mail(phone: str, arg: str) -> None:
    from app.services import email_triage_store as tstore

    parts = (arg or "").strip().split()
    sub = parts[0].lower() if parts else ""
    target = parts[1] if len(parts) >= 2 else ""

    if sub in ("send", "ok", "approve", "yes", "ja") and target:
        row = tstore.find_pending(target)
        if not row:
            await send_message(phone, f"No pending email with id `{target}`. Type `mail` to list open items.")
            return
        send_draft = sub == "send"
        contact_email = row.get("reply_to") or row.get("sender_email")
        tstore.set_rule(contact_email, "allow")
        lead_id = row.get("lead_id")
        if not store.MEMORY:
            try:
                from app.services.outlook_service import approve_inquiry_and_send
                res = await approve_inquiry_and_send(row["id"], send_draft=send_draft)
                lead_id = res.get("lead_id")
            except Exception as e:
                logger.warning(f"mail {sub} lead/reply failed: {e}")
        tstore.update_decision(row["id"], {
            "resolution": "ok",
            "lead_id": lead_id,
            "draft_status": "sent" if send_draft else "approved_no_send",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })
        action_note = "lead created & draft reply sent" if send_draft else "sender allowed & lead created"
        await send_message(phone, f"✅ Approved `#{tstore.short_id(row)}` ({contact_email}) — {action_note}.")
        return

    if sub == "type" and target and len(parts) >= 3:
        new_cat = parts[2].lower()
        row = tstore.find_pending(target)
        if not row:
            await send_message(phone, f"No inquiry found with id `{target}`.")
            return
        from app.services.email_triage_service import build_draft_reply, compute_missing_fields
        params = row.get("extracted_params") or {}
        missing = compute_missing_fields(new_cat, params)
        d_subj, d_body = build_draft_reply(new_cat, row.get("sender_name") or "", row.get("subject") or "", params, missing)
        tstore.update_decision(row["id"], {
            "category": new_cat,
            "missing_fields": missing,
            "draft_subject": d_subj,
            "draft_reply": d_body,
        })
        await send_message(phone, f"🔄 Reclassified `#{tstore.short_id(row)}` to *{new_cat}* and updated draft reply.")
        return

    if sub in ("no", "deny", "block", "spam", "nein") and target:
        row = tstore.find_pending(target)
        if not row:
            await send_message(phone, f"No pending email with id `{target}`. Type `mail` to list open items.")
            return
        tstore.set_rule(row.get("sender_email") or "", "deny")
        tstore.update_decision(row["id"], {
            "decision": "drop",
            "category": "spam",
            "resolution": "no",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })
        await send_message(phone, f"🚫 Ignored `#{tstore.short_id(row)}` and blocked `{row.get('sender_email')}`.")
        return

    pending = tstore.list_pending(8)
    st = tstore.stats(30)
    d = st.get("decisions", {})
    lines = [
        f"📩 *Email Triage (last 30d)*",
        f"Scanned: {st.get('total', 0)} • Qualified: {st.get('qualified', 0)} • Drafts: {st.get('pending_drafts', 0)} • Leads: {d.get('lead', 0)} • Review: {d.get('review', 0)} • Flagged: {d.get('drop', 0)}",
    ]
    if not pending:
        lines.append("\nNo emails waiting for review.")
    else:
        lines.append(f"\n*Waiting for action ({len(pending)}) — use 1-{len(pending)} or #id:*")
        for i, r in enumerate(pending, 1):
            sid = tstore.short_id(r)
            qual_tag = "✅" if r.get("is_qualified") else "⏳"
            sender_disp = "mobile.de Buyer" if "kontakt.mobile.de" in (r.get("sender_email") or "") else (r.get("sender_email") or "")[:28]
            lines.append(
                f"*{i}.* {qual_tag} `#{sid}` [{r.get('category')}] {sender_disp}\n"
                f"   _{(r.get('subject') or '')[:44]}_"
            )
        lines.append(
            "\n👉 *Commands (use item `1` or `#id`):*\n"
            "• `mail send 1` — approve & send draft\n"
            "• `mail ok 1` — approve lead (no email)\n"
            "• `mail type 1 seller` — change type\n"
            "• `mail no 1` — flag as spam"
        )
    await send_message(phone, "\n".join(lines))


# ─── Convert & Stage ──────────────────────────────────────────────────────

async def _cmd_convert(phone: str, arg: str) -> None:
    if not arg:
        await send_message(phone, "Usage: `convert <lead name or phone>`")
        return
    proj = store.convert_lead_to_project(arg)
    if proj:
        await send_message(
            phone,
            f"✅ *Lead Converted to Active Deal!*\n\n"
            f"👤 Client: {proj.get('client_name')}\n"
            f"🚗 Vehicle: {proj.get('target_vehicle') or 'TBD'}\n"
            f"📌 Type: {proj.get('project_type')}\n"
            f"🔄 Stage: {proj.get('current_stage')}",
        )
    else:
        await send_message(phone, f"❌ No matching lead found for '{arg}'.")


async def _cmd_stage(phone: str, arg: str) -> None:
    parts = arg.split(maxsplit=1) if arg else []
    if len(parts) < 2:
        await send_message(
            phone,
            "Usage: `stage <client_name> <new_stage>`\n"
            "Stages: Intake, Sourcing, Negotiation, Marketing, Completed",
        )
        return
    updated = store.update_project_stage(parts[0], parts[1])
    if updated:
        proj, stg = updated
        await send_message(
            phone,
            f"✅ *Stage Updated!*\n\n👤 {proj.get('client_name')}\n🚗 {proj.get('target_vehicle') or 'TBD'}\n🔄 New Stage: *{stg}*",
        )
    else:
        await send_message(phone, f"❌ Could not update stage for '{parts[0]}' -> '{parts[1]}'.")


# ─── Meetings: Schedule / List / Cancel / Reschedule ─────────────────────

async def _cmd_list_meetings(phone: str) -> None:
    upcoming = ms.list_upcoming_meetings(limit=10)
    if not upcoming:
        await send_message(phone, "🗓️ No upcoming meetings scheduled.")
        return
    lines = ["🗓️ *Upcoming Meetings (Europe/Berlin):*\n"] + [
        ms.format_meeting_line(m, i) for i, m in enumerate(upcoming, 1)
    ]
    await send_message(phone, "\n".join(lines))


async def _start_meetings_action(phone: str, action: str) -> None:
    upcoming = ms.list_upcoming_meetings(limit=8)
    if not upcoming:
        await send_message(phone, "🗓️ No upcoming meetings found.")
        return
    refs = [
        {"id": m.get("id"), "title": m.get("title"), "client_name": m.get("client_name"), "start_time": m.get("start_time")}
        for m in upcoming
    ]
    store.save_session(phone, {"mode": "owner_meetings_action", "done": True, "action": action, "items": refs})
    btns = []
    for i, m in enumerate(upcoming):
        dt_s = ms._parse_iso_utc(m.get("start_time", ""))
        t_lbl = dt_s.astimezone(ms.BERLIN_TZ).strftime("%d.%m %H:%M") if dt_s else "?"
        btns.append((f"mtg_{i}", f"{t_lbl} {m.get('client_name', '')[:11]}".strip(), (m.get("vehicle") or m.get("title") or "")[:72]))
    verb = "cancel" if action == "cancel" else "reschedule"
    await send_message(phone, f"Pick a meeting to {verb}:", buttons=btns)


async def _handle_meetings_action(phone: str, session: Dict, low: str, btn_id: str) -> None:
    items = session.get("items") or []
    idx = _pick_index(low, btn_id, len(items), prefix="mtg_")
    if idx is None:
        await send_message(phone, f"Please reply with 1-{len(items)}, or `cancel` to abort.")
        return
    chosen = items[idx]
    action = session.get("action")
    if action == "cancel":
        res = ms.cancel_meeting(chosen["id"])
        store.delete_session(phone)
        if res:
            await send_message(phone, f"🗑️ Cancelled meeting: *{chosen.get('client_name')}* ({chosen.get('title')}). Time slot is now free.")
        else:
            await send_message(phone, "❌ Could not cancel meeting.")
        return

    # Reschedule -> enter schedule date/slot picker targeting existing meeting_id
    state = {
        "mode": "owner_schedule",
        "done": True,
        "step": "sched_pick_date",
        "reschedule_id": chosen["id"],
        "customer": {"name": chosen.get("client_name"), "phone": "", "vehicle": "", "deal_type": "UNKNOWN", "address": ""},
    }
    store.save_session(phone, state)
    await _prompt_schedule_dates(phone, state)


async def _start_schedule(phone: str, initial_query: str = "") -> None:
    if initial_query:
        await _resolve_schedule_customer(phone, initial_query)
        return
    recent = store.recent_customers(limit=5)
    refs = [crm.to_session_ref(c) for c in recent]
    store.save_session(phone, {"mode": "owner_schedule", "done": True, "step": "sched_pick_customer", "candidates": refs})
    if refs:
        btns = [(f"scust_{i}", crm.disambiguate_row_title(c), crm.disambiguate_row_desc(c)) for i, c in enumerate(recent)]
        await send_message(
            phone,
            "📅 *Schedule Meeting*\nSend customer phone number (or name/email), or pick a recent customer:",
            buttons=btns,
        )
    else:
        await send_message(phone, "📅 *Schedule Meeting*\nSend the customer's phone number (or name/email):")


async def _resolve_schedule_customer(phone: str, query: str) -> None:
    matches = store.search_customers(query, limit=8)
    if not matches:
        await send_message(phone, f"No customer found for '{query}'. Send another phone number, email, or name (or `cancel`):")
        return
    if len(matches) == 1:
        cust = crm.to_session_ref(matches[0])
        state = {"mode": "owner_schedule", "done": True, "step": "sched_pick_date", "customer": cust}
        store.save_session(phone, state)
        await _prompt_schedule_dates(phone, state)
        return

    refs = [crm.to_session_ref(m) for m in matches]
    store.save_session(phone, {"mode": "owner_schedule", "done": True, "step": "sched_disambig", "candidates": refs})
    btns = [(f"scust_{i}", crm.disambiguate_row_title(m), crm.disambiguate_row_desc(m)) for i, m in enumerate(matches)]
    await send_message(phone, f"Found {len(matches)} matches for '{query}'. Which customer?", buttons=btns)


async def _prompt_schedule_dates(phone: str, state: Dict) -> None:
    cust = state["customer"]
    days = _next_working_days(7)
    state["days"] = [d.isoformat() for d in days]
    state["step"] = "sched_pick_date"
    store.save_session(phone, state)

    info_lines = [f"👤 *{cust['name']}*" + (f" ({cust['phone']})" if cust.get("phone") else "")]
    if cust.get("vehicle") or cust.get("deal_type") != "UNKNOWN":
        info_lines.append(f"🚗 {cust.get('vehicle') or 'Vehicle TBD'} ({cust.get('deal_type') or 'UNKNOWN'})")
    header = "\n".join(info_lines) + "\n\nSelect a date (or reply DD.MM.YYYY):"
    btns = [(f"sday_{i}", _date_label(d), "") for i, d in enumerate(days)]
    await send_message(phone, header, buttons=btns)


async def _prompt_schedule_slots(phone: str, state: Dict, chosen_day: date) -> None:
    slots = ms.get_free_slots(chosen_day, duration_minutes=ms.DEFAULT_DURATION_MIN, is_offline=True)
    if not slots:
        await send_message(phone, f"No free slots on {_date_label(chosen_day)} (09:00-18:00 w/ 30m travel buffer). Please pick another date or `cancel`.")
        return
    state["chosen_date"] = chosen_day.isoformat()
    state["slots"] = slots
    state["step"] = "sched_pick_slot"
    store.save_session(phone, state)

    btns = [(f"sslot_{i}", s["label"], "Free") for i, s in enumerate(slots)]
    await send_message(phone, f"⏰ Free slots on *{_date_label(chosen_day)}* (Europe/Berlin):", buttons=btns)


async def _handle_schedule_step(phone: str, state: Dict, raw_text: str, btn_id: str) -> None:
    step = state.get("step")
    low = (raw_text or "").strip().lower()

    if step == "sched_pick_customer":
        cands = state.get("candidates") or []
        idx = _pick_index(low, btn_id, len(cands), prefix="scust_")
        if idx is not None:
            state["customer"] = cands[idx]
            await _prompt_schedule_dates(phone, state)
            return
        await _resolve_schedule_customer(phone, (raw_text or "").strip())
        return

    if step == "sched_disambig":
        cands = state.get("candidates") or []
        idx = _pick_index(low, btn_id, len(cands), prefix="scust_")
        if idx is not None:
            state["customer"] = cands[idx]
            await _prompt_schedule_dates(phone, state)
            return
        await _resolve_schedule_customer(phone, (raw_text or "").strip())
        return

    if step == "sched_pick_date":
        days_iso = state.get("days") or []
        idx = _pick_index(low, btn_id, len(days_iso), prefix="sday_")
        chosen_day = date.fromisoformat(days_iso[idx]) if idx is not None else _parse_user_date(raw_text)
        if not chosen_day:
            await send_message(phone, f"Please pick 1-{len(days_iso)} or send a date like `20.11.2026`.")
            return
        await _prompt_schedule_slots(phone, state, chosen_day)
        return

    if step == "sched_pick_slot":
        slots = state.get("slots") or []
        idx = _pick_index(low, btn_id, len(slots), prefix="sslot_")
        if idx is None:
            await send_message(phone, f"Please select a free slot (1-{len(slots)}).")
            return
        state["chosen_slot"] = slots[idx]
        # If rescheduling an existing meeting, skip type/address -> go straight to reschedule confirm
        if state.get("reschedule_id"):
            state["location_type"] = "OFFLINE_ONSITE"
            state["location_address"] = ""
            await _prompt_schedule_confirm(phone, state)
            return
        state["step"] = "sched_pick_type"
        store.save_session(phone, state)
        await send_message(
            phone,
            "📍 Meeting format:",
            buttons=[
                ("stype_offline", "📍 Offline (Vor Ort)", "30-min travel buffer"),
                ("stype_online", "💻 Online", "Video / Phone call"),
            ],
        )
        return

    if step == "sched_pick_type":
        if btn_id == "stype_online" or low in ("2", "online"):
            state["location_type"] = "ONLINE"
            state["location_address"] = "Online / Video Call"
            await _prompt_schedule_confirm(phone, state)
            return
        if btn_id == "stype_offline" or low in ("1", "offline", "vor ort"):
            state["location_type"] = "OFFLINE_ONSITE"
            cust_addr = (state.get("customer") or {}).get("address") or ""
            state["step"] = "sched_address"
            store.save_session(phone, state)
            opts = []
            if cust_addr:
                opts.append(("addr_cust", f"Customer: {cust_addr[:14]}", cust_addr))
            opts.append(("addr_office", "CAR-AGENTS Office", "Dealership office"))
            await send_message(phone, "Enter meeting address (or choose below):", buttons=opts)
            return
        await send_message(phone, "Please reply 1 (Offline) or 2 (Online).")
        return

    if step == "sched_address":
        cust_addr = (state.get("customer") or {}).get("address") or ""
        if btn_id == "addr_cust" and cust_addr:
            addr = cust_addr
        elif btn_id == "addr_office" or (cust_addr and low == "2") or (not cust_addr and low == "1"):
            addr = "CAR-AGENTS Office"
        elif cust_addr and low == "1":
            addr = cust_addr
        else:
            addr = (raw_text or "").strip() or "CAR-AGENTS Office"
        state["location_address"] = addr
        await _prompt_schedule_confirm(phone, state)
        return

    if step == "sched_confirm":
        if btn_id == "sconf_no" or low in ("2", "no", "nein", "cancel"):
            store.delete_session(phone)
            await send_message(phone, "❌ Booking cancelled.")
            return
        if btn_id == "sconf_yes" or low in ("1", "yes", "ja", "confirm", "ok"):
            await _finalize_schedule(phone, state)
            return
        await send_message(phone, "Please reply 1 (Confirm) or 2 (Cancel).")


async def _prompt_schedule_confirm(phone: str, state: Dict) -> None:
    state["step"] = "sched_confirm"
    store.save_session(phone, state)
    cust = state["customer"]
    slot = state["chosen_slot"]
    d = date.fromisoformat(state["chosen_date"])
    loc = "Online" if state.get("location_type") == "ONLINE" else f"Offline — {state.get('location_address') or 'Vor Ort'}"
    action_lbl = "Confirm Reschedule" if state.get("reschedule_id") else "Confirm Meeting"
    card = (
        f"📅 *{action_lbl}*\n\n"
        f"👤 Client: {cust['name']}" + (f" ({cust['phone']})" if cust.get("phone") else "") + "\n"
        f"🚗 Deal: {cust.get('vehicle') or 'Vehicle TBD'} ({cust.get('deal_type') or 'UNKNOWN'})\n"
        f"🗓️ Date: {d.strftime('%a %d.%m.%Y')}\n"
        f"⏰ Time: {slot['label']} (Europe/Berlin)\n"
        f"📍 Format: {loc}"
    )
    await send_message(phone, card, buttons=[("sconf_yes", "✅ Confirm", ""), ("sconf_no", "❌ Cancel", "")])


async def _finalize_schedule(phone: str, state: Dict) -> None:
    slot = state["chosen_slot"]
    dt_s = ms._parse_iso_utc(slot["start_iso"])
    dt_e = ms._parse_iso_utc(slot["end_iso"])
    cust = state["customer"]

    if state.get("reschedule_id"):
        res = ms.reschedule_meeting(state["reschedule_id"], dt_s, dt_e)
        if res.get("conflict"):
            await send_message(phone, "⚠️ That slot was just booked! Refreshing free slots...")
            await _prompt_schedule_slots(phone, state, date.fromisoformat(state["chosen_date"]))
            return
        store.delete_session(phone)
        await send_message(phone, f"✅ *Meeting Rescheduled!*\n👤 {cust['name']}\n🗓️ {state['chosen_date']} {slot['label']} (Europe/Berlin)")
        return

    res = ms.create_meeting(
        client_name=cust["name"],
        start_utc=dt_s,
        end_utc=dt_e,
        client_phone=cust.get("phone") or "",
        customer_email=cust.get("email") or "",
        vehicle=cust.get("vehicle") or "",
        deal_type=cust.get("deal_type") or "UNKNOWN",
        lead_id=cust.get("lead_id"),
        project_id=cust.get("project_id"),
        location_type=state.get("location_type") or "OFFLINE_ONSITE",
        location_address=state.get("location_address") or "",
    )
    if res.get("conflict"):
        await send_message(phone, "⚠️ Clash detected (another meeting or travel buffer overlaps)! Picking a fresh free slot...")
        await _prompt_schedule_slots(phone, state, date.fromisoformat(state["chosen_date"]))
        return

    store.delete_session(phone)
    invite_note = "\n📅 Added to Google Calendar." if res.get("calendar_synced") else ""
    await send_message(
        phone,
        f"✅ *Meeting Booked!*\n\n"
        f"👤 {cust['name']} ({cust.get('phone') or 'no phone'})\n"
        f"🚗 {cust.get('vehicle') or 'Vehicle TBD'} ({cust.get('deal_type') or 'UNKNOWN'})\n"
        f"🗓️ {state['chosen_date']} • {slot['label']} (Europe/Berlin)\n"
        f"📍 {state.get('location_address') or 'Offline'}{invite_note}",
    )


# ─── Separate Workflow 1: Upload Documents (NO OCR) ───────────────────────

async def _handle_file_route_choice(phone: str, session: Dict, low: str, btn_id: str) -> None:
    buffered = {"media_id": session.get("media_id"), "mime": session.get("mime"), "filename": session.get("filename")}
    if btn_id == "route_upload" or low == "1":
        await _start_upload(phone, "", buffered_media=buffered)
        return
    if btn_id == "route_scan" or low == "2":
        await _start_scan(phone, "", buffered_media=buffered)
        return
    await send_message(phone, "Please choose 1 (Upload Document) or 2 (Scan OCR), or `cancel`.")


async def _start_upload(phone: str, initial_query: str = "", buffered_media: Optional[Dict] = None) -> None:
    if initial_query:
        matches = store.search_customers(initial_query, limit=8)
        if len(matches) == 1:
            await _prompt_upload_category(phone, crm.to_session_ref(matches[0]), buffered_media)
            return

    recent = store.recent_customers(limit=5)
    refs = [crm.to_session_ref(c) for c in recent]
    store.save_session(phone, {
        "mode": "owner_upload", "done": True, "step": "up_pick_customer",
        "candidates": refs, "buffered_media": buffered_media,
    })
    if refs:
        btns = [(f"ucust_{i}", crm.disambiguate_row_title(c), crm.disambiguate_row_desc(c)) for i, c in enumerate(recent)]
        await send_message(phone, "📎 *Upload Customer Document*\nPick a customer or type their phone/name/email:", buttons=btns)
    else:
        await send_message(phone, "📎 *Upload Customer Document*\nSend customer phone number, name, or email:")


async def _prompt_upload_category(phone: str, cust: Dict, buffered_media: Optional[Dict] = None) -> None:
    store.save_session(phone, {
        "mode": "owner_upload", "done": True, "step": "up_pick_category",
        "customer": cust, "buffered_media": buffered_media,
    })
    btns = [(f"ucat_{cid}", title, "") for cid, title in docs.UPLOAD_CATEGORIES]
    await send_message(phone, f"📁 Storing document for *{cust['name']}*.\nSelect category:", buttons=btns)


async def _handle_upload_step(phone: str, state: Dict, raw_text: str, btn_id: str) -> None:
    step = state.get("step")
    low = (raw_text or "").strip().lower()

    if step == "up_pick_customer":
        cands = state.get("candidates") or []
        idx = _pick_index(low, btn_id, len(cands), prefix="ucust_")
        if idx is not None:
            await _prompt_upload_category(phone, cands[idx], state.get("buffered_media"))
            return
        matches = store.search_customers((raw_text or "").strip(), limit=8)
        if not matches:
            await send_message(phone, f"No customer found for '{raw_text}'. Try phone number, email, or name:")
            return
        if len(matches) == 1:
            await _prompt_upload_category(phone, crm.to_session_ref(matches[0]), state.get("buffered_media"))
            return
        refs = [crm.to_session_ref(m) for m in matches]
        state["candidates"] = refs
        store.save_session(phone, state)
        btns = [(f"ucust_{i}", crm.disambiguate_row_title(m), crm.disambiguate_row_desc(m)) for i, m in enumerate(matches)]
        await send_message(phone, f"Found {len(matches)} matches. Pick one:", buttons=btns)
        return

    if step == "up_pick_category":
        cat_keys = [c[0] for c in docs.UPLOAD_CATEGORIES]
        chosen_cat = None
        if btn_id.startswith("ucat_") and btn_id[5:] in cat_keys:
            chosen_cat = btn_id[5:]
        else:
            idx = _pick_index(low, "", len(cat_keys))
            if idx is not None:
                chosen_cat = cat_keys[idx]
        if not chosen_cat:
            await send_message(phone, f"Please choose a category (1-{len(cat_keys)}).")
            return
        state["category"] = chosen_cat
        state["step"] = "up_wait_file"
        store.save_session(phone, state)
        if state.get("buffered_media"):
            bm = state.pop("buffered_media")
            await _step_upload_file(phone, state, {"media_id": bm["media_id"], "mime": bm["mime"], "filename": bm.get("filename"), "type": "document"})
            return
        await send_message(phone, f"📤 Ready! Send the photo or PDF now (category: *{chosen_cat}*).")
        return

    if step == "up_wait_file":
        if low in ("done", "fertig", "ok", "1"):
            store.delete_session(phone)
            await send_message(phone, "✅ Document upload session finished.")
        else:
            await send_message(phone, "Please attach/send the file (photo or PDF), or type `done` to finish.")


async def _step_upload_file(phone: str, state: Dict, inp: Dict) -> None:
    if state.get("step") != "up_wait_file":
        await send_message(phone, "Please select the customer and category first before sending the file.")
        return
    media = await download_media(inp["media_id"])
    if not media:
        await send_message(phone, "❌ Could not download file from WhatsApp. Please try again.")
        return
    data, mime = media
    row = await docs.store_uploaded_document(
        file_bytes=data,
        filename=inp.get("filename"),
        mime_type=inp.get("mime") or mime,
        customer=state["customer"],
        category=state.get("category") or "other",
        source="WHATSAPP_UPLOAD",
    )
    store.delete_session(phone)
    link_line = f"\n🔗 {row['file_url']}" if row.get("file_url") else ""
    await send_message(
        phone,
        f"✅ *Document Saved (No OCR)*\n"
        f"👤 Customer: {state['customer']['name']}\n"
        f"📁 Category: {state.get('category')}\n"
        f"📄 File: {row.get('filename')}{link_line}",
    )


# ─── Separate Workflow 2: OCR Scan & Template Fill ────────────────────────

async def _start_scan(phone: str, initial_arg: str = "", buffered_media: Optional[Dict] = None) -> None:
    store.save_session(phone, {
        "mode": "owner_scan", "done": True, "step": "sc_pick_type",
        "buffered_media": buffered_media,
    })
    btns = [(f"sctype_{k}", title, "") for k, title in docs.SCAN_DOC_TYPES]
    await send_message(phone, "🔎 *Scan Document (OCR -> Templates)*\nSelect document type to parse:", buttons=btns)


async def _handle_scan_step(phone: str, state: Dict, raw_text: str, btn_id: str) -> None:
    step = state.get("step")
    low = (raw_text or "").strip().lower()

    if step == "sc_pick_type":
        type_keys = [k for k, _ in docs.SCAN_DOC_TYPES]
        chosen = None
        if btn_id.startswith("sctype_") and btn_id[7:] in type_keys:
            chosen = btn_id[7:]
        else:
            idx = _pick_index(low, "", len(type_keys))
            if idx is not None:
                chosen = type_keys[idx]
        if not chosen:
            await send_message(phone, f"Please pick 1-{len(type_keys)}.")
            return
        state["doc_kind"] = chosen
        state["step"] = "sc_pick_customer"
        recent = store.recent_customers(limit=4)
        refs = [crm.to_session_ref(c) for c in recent]
        state["candidates"] = refs
        store.save_session(phone, state)
        btns = [("sccust_skip", "⏭️ Skip (Preview only)", "Extract fields without saving")]
        for i, c in enumerate(recent):
            btns.append((f"sccust_{i}", crm.disambiguate_row_title(c), crm.disambiguate_row_desc(c)))
        await send_message(phone, "Which customer/deal should these extracted fields fill? (Pick, type phone/name/email, or Skip):", buttons=btns)
        return

    if step == "sc_pick_customer":
        if btn_id == "sccust_skip" or low in ("1", "skip"):
            state["customer"] = None
            await _advance_to_scan_wait(phone, state)
            return
        cands = state.get("candidates") or []
        # Button indices are shifted by 1 because option 1 is Skip
        if btn_id.startswith("sccust_") and btn_id[7:].isdigit():
            idx = int(btn_id[7:])
            if 0 <= idx < len(cands):
                state["customer"] = cands[idx]
                await _advance_to_scan_wait(phone, state)
                return
        if low.isdigit():
            idx = int(low) - 2
            if 0 <= idx < len(cands):
                state["customer"] = cands[idx]
                await _advance_to_scan_wait(phone, state)
                return
        matches = store.search_customers((raw_text or "").strip(), limit=6)
        if not matches:
            await send_message(phone, f"No customer found for '{raw_text}'. Type another phone/name, or `skip`:")
            return
        if len(matches) == 1:
            state["customer"] = crm.to_session_ref(matches[0])
            await _advance_to_scan_wait(phone, state)
            return
        refs = [crm.to_session_ref(m) for m in matches]
        state["candidates"] = refs
        store.save_session(phone, state)
        btns = [("sccust_skip", "⏭️ Skip (Preview only)", "")] + [
            (f"sccust_{i}", crm.disambiguate_row_title(m), crm.disambiguate_row_desc(m)) for i, m in enumerate(matches)
        ]
        await send_message(phone, f"Found {len(matches)} matches. Pick customer:", buttons=btns)
        return

    if step == "sc_confirm":
        if btn_id == "socr_no" or low in ("2", "discard", "no", "cancel"):
            store.delete_session(phone)
            await send_message(phone, "🗑️ Scan discarded. Nothing was saved.")
            return
        if btn_id == "socr_yes" or low in ("1", "save", "yes", "confirm"):
            cust = state.get("customer")
            if not cust:
                store.delete_session(phone)
                await send_message(phone, "✅ Extraction reviewed (no customer was linked).")
                return
            applied = docs.apply_ocr_to_crm(state.get("extracted") or {}, cust)
            targets = ", ".join(applied["updated_targets"]) or "CRM"
            rec_tpl = applied["recommended_template"]

            # Advance to optional 1-click PDF contract generation step (§11)
            state["step"] = "sc_pick_template"
            state["canonical_fields"] = applied.get("canonical_fields") or {}
            store.save_session(phone, state)
            await send_message(
                phone,
                f"✅ *OCR Fields Saved!*\n"
                f"👤 Customer: {cust['name']}\n"
                f"💾 Updated: {targets}\n"
                f"📄 Template ready: `{rec_tpl}`\n\n"
                f"Would you like to generate a pre-filled Contract PDF draft now? (Reply 1-5 or tap):",
                buttons=[
                    ("sctpl_sell_b2c", "1. Vermittlung B2C", "Verkauf Aktiv (sell_b2c)"),
                    ("sctpl_buy_passiv", "2. Beschaffung", "Suchauftrag Passiv (buy_passiv)"),
                    ("sctpl_kaufvertrag", "3. Kaufvertrag C2C", "Bilingualer Kaufvertrag"),
                    ("sctpl_handover", "4. Übergabeprotokoll", "Fahrzeug-Übergabe"),
                    ("sctpl_skip", "5. Skip (Done)", "Do not generate PDF now"),
                ],
            )
            return
        await send_message(phone, "Reply 1 to Save into CRM & Templates, or 2 to Discard.")
        return

    if step == "sc_pick_template":
        tpl_keys = ["sell_b2c", "buy_passiv", "kaufvertrag", "handover"]
        if btn_id == "sctpl_skip" or low in ("5", "skip", "no", "done"):
            store.delete_session(phone)
            await send_message(phone, "✅ Done! You can also generate or edit contracts anytime in the Web Portal (`/contracts`).")
            return
        chosen_tpl = None
        if btn_id.startswith("sctpl_") and btn_id[6:] in tpl_keys:
            chosen_tpl = btn_id[6:]
        elif low in ("1", "2", "3", "4"):
            chosen_tpl = tpl_keys[int(low) - 1]
        elif low in tpl_keys:
            chosen_tpl = low
        if not chosen_tpl:
            store.delete_session(phone)
            await send_message(phone, "✅ OCR saved.")
            return

        cust = state.get("customer") or {}
        canonical = state.get("canonical_fields") or docs.to_canonical_template_fields(state.get("extracted") or {})
        store.delete_session(phone)
        try:
            pdf_res = await docs.generate_and_store_contract_pdf(chosen_tpl, canonical, cust)
            url_line = f"\n🔗 {pdf_res['file_url']}" if pdf_res.get("file_url") else ""
            await send_message(
                phone,
                f"📄 *Pre-Filled Contract Draft Generated!*\n"
                f"👤 Customer: {cust.get('name')}\n"
                f"📋 Template: *{pdf_res.get('template_label')}*\n"
                f"📁 File: `{pdf_res.get('file_name')}`{url_line}",
            )
        except Exception as e:
            logger.warning(f"WhatsApp contract PDF generation failed: {e}")
            await send_message(phone, f"⚠️ Could not render PDF directly ({e}). Fields are saved in CRM for `/contracts`.")
        return

    if step == "sc_wait_file":
        await send_message(phone, "📷 Waiting for photo or PDF to scan (or type `cancel`).")


async def _advance_to_scan_wait(phone: str, state: Dict) -> None:
    state["step"] = "sc_wait_file"
    store.save_session(phone, state)
    if state.get("buffered_media"):
        bm = state.pop("buffered_media")
        await _step_scan_file(phone, state, {"media_id": bm["media_id"], "mime": bm["mime"], "type": "document"})
        return
    cname = (state.get("customer") or {}).get("name") or "Preview only"
    await send_message(phone, f"📷 Ready to scan (*{state.get('doc_kind')}* -> {cname}). Send the photo or PDF now:")


async def _step_scan_file(phone: str, state: Dict, inp: Dict) -> None:
    if state.get("step") != "sc_wait_file":
        await send_message(phone, "Please pick document type & customer first before sending the file.")
        return
    media = await download_media(inp["media_id"])
    if not media:
        await send_message(phone, "❌ Could not download file from WhatsApp. Please try again.")
        return
    data, mime = media
    extracted = await docs.scan_document(data, inp.get("mime") or mime, doc_kind=state.get("doc_kind") or "vehicle")
    if not extracted:
        store.delete_session(phone)
        await send_message(phone, "❌ Could not extract clear fields from that file. Please send a sharper photo or digital PDF.")
        return

    preview = docs.format_ocr_preview(extracted)
    if state.get("customer"):
        state["extracted"] = extracted
        state["step"] = "sc_confirm"
        store.save_session(phone, state)
        await send_message(
            phone,
            f"{preview}\n\nSave these values to *{state['customer']['name']}* & contract templates?",
            buttons=[
                ("socr_yes", "✅ Save to CRM", "Update lead, deal & template fields"),
                ("socr_no", "❌ Discard", "Do not save"),
            ],
        )
    else:
        store.delete_session(phone)
        await send_message(phone, preview)
