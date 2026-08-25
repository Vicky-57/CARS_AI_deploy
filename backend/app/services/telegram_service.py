"""
app/services/telegram_service.py
────────────────────────────────────────────────────────────────────────
Telegram Master Agent — Command Dispatcher & Response Engine

Supported Commands:
  /start          → Welcome message & command list
  /createlead     → Create a new lead
  /getlead        → Search lead by name or list all
  /getcars        → List active vehicles
  /getprojects    → List active projects
  /convert        → Convert lead to project
  /schedule       → Get today's Outlook calendar schedule
  /summary        → CRM daily summary
────────────────────────────────────────────────────────────────────────
"""
import logging
import urllib.request
import urllib.parse
import json
from config import settings
from app.services.supabase_service import get_all_leads, get_all_projects
from database import get_supabase

logger = logging.getLogger("telegram_service")

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


# ─── Keyboards ────────────────────────────────────────────────────────────────

MAIN_REPLY_KEYBOARD = {
    "keyboard": [
        [{"text": "📊 Summary"}, {"text": "📋 Leads"}],
        [{"text": "💼 Active Deals"}, {"text": "📅 Schedule"}],
        [{"text": "📰 Briefing"}, {"text": "🚗 Cars"}]
    ],
    "resize_keyboard": True,
    "one_time_keyboard": False
}


# ─── Core Send ────────────────────────────────────────────────────────────────

async def send_telegram_message(text: str, chat_id: str = None, parse_mode: str = "Markdown", reply_markup: dict = None) -> dict:
    """Send a text message to a Telegram chat with optional button keyboard."""
    target_chat = chat_id or settings.TELEGRAM_CHAT_ID
    if not target_chat:
        logger.warning("No Telegram chat_id configured.")
        return {}

    # Default to persistent quick button keyboard if none provided
    markup = reply_markup if reply_markup is not None else MAIN_REPLY_KEYBOARD

    payload_dict = {
        "chat_id": target_chat,
        "text": text,
        "parse_mode": parse_mode,
    }
    if markup:
        payload_dict["reply_markup"] = markup

    payload = json.dumps(payload_dict).encode("utf-8")
    req = urllib.request.Request(
        f"{TELEGRAM_API}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return {}


# ─── Command Dispatcher ───────────────────────────────────────────────────────

async def dispatch_telegram_command(message: dict) -> str:
    """
    Main dispatcher: reads incoming Telegram message or button click,
    identifies command, executes action, and returns response text.
    """
    text: str = (message.get("text") or "").strip()
    chat_id: str = str(message.get("chat", {}).get("id", ""))

    if not text:
        return ""

    text_lower = text.lower()

    # ── /start & /help ──
    if text_lower.startswith("/start") or text_lower.startswith("/help") or text_lower == "help" or text_lower == "start":
        reply = (
            "👋 *Welcome to CAR-AGENTS Master Agent Bot!*\n\n"
            "I manage your entire brokerage operations. Use the **Quick Buttons below** or type any command:\n\n"
            "📊 *Summary* — Daily CRM snapshot\n"
            "📋 *Leads* — View active customer inquiries\n"
            "💼 *Deals* — View active Buy/Sell projects\n"
            "📅 *Schedule* — Read today's Outlook calendar\n"
            "📰 *Briefing* — Generate executive digest\n"
            "🚗 *Cars* — Browse active car inventory\n\n"
            "💡 *Shortcuts & Advanced Commands:*\n"
            "`/createlead [Name] [Phone] [Vehicle] [buy|sell]`\n"
            "`/convert [Lead Name]` — Create project from lead\n"
            "`/search [Name]` — Search leads & customers"
        )
        await send_telegram_message(reply, chat_id, reply_markup=MAIN_REPLY_KEYBOARD)
        return reply

    # ── Explicit Slash Commands (MUST BE CHECKED FIRST!) ──
    if text_lower.startswith("/createlead"):
        return await _handle_create_lead(text, chat_id)

    if text_lower.startswith("/convert"):
        return await _handle_convert_lead(text, chat_id)

    if text_lower.startswith("/search"):
        return await _handle_get_lead(text, chat_id)

    if text_lower.startswith("/summary"):
        return await _handle_summary(chat_id)

    if text_lower.startswith("/leads") or text_lower.startswith("/getlead"):
        return await _handle_get_lead(text, chat_id)

    if text_lower.startswith("/deals") or text_lower.startswith("/projects") or text_lower.startswith("/getprojects"):
        return await _handle_get_projects(chat_id)

    if text_lower.startswith("/schedule") or text_lower.startswith("/calendar"):
        return await _handle_schedule(chat_id)

    if text_lower.startswith("/briefing"):
        return await _handle_briefing(chat_id)

    if text_lower.startswith("/cars") or text_lower.startswith("/getcars"):
        return await _handle_get_cars(text, chat_id)

    # ── Quick Keyboard Button Matches ──
    if text_lower == "📊 summary" or text_lower == "summary":
        return await _handle_summary(chat_id)

    if text_lower == "📋 leads" or text_lower == "leads":
        return await _handle_get_lead(text, chat_id)

    if text_lower == "💼 active deals" or text_lower == "deals" or text_lower == "projects":
        return await _handle_get_projects(chat_id)

    if text_lower == "📅 schedule" or text_lower == "schedule" or text_lower == "calendar":
        return await _handle_schedule(chat_id)

    if text_lower == "📰 briefing" or text_lower == "briefing":
        return await _handle_briefing(chat_id)

    if text_lower == "🚗 cars" or text_lower == "cars" or text_lower == "inventory":
        return await _handle_get_cars(text, chat_id)

    # ── Unknown Command Fallback ──
    reply = (
        "🤖 I didn't recognize that option.\n\n"
        "Tap one of the **Quick Buttons** below or type `/start` to see all commands."
    )
    await send_telegram_message(reply, chat_id, reply_markup=MAIN_REPLY_KEYBOARD)
    return reply


# ─── Command Handlers ─────────────────────────────────────────────────────────

async def _handle_create_lead(text: str, chat_id: str) -> str:
    """
    Parse and create a lead from command:
      /createlead Stefan Meier +491701234567 BMW 320i sell
    """
    parts = text.split(maxsplit=1)
    args = parts[1].strip() if len(parts) > 1 else ""

    if not args:
        reply = (
            "📋 *Create Lead — Usage:*\n"
            "`/createlead [Full Name] [Phone] [Vehicle Interest] [buy|sell]`\n\n"
            "Example: `/createlead Stefan Meier +49170123456 BMW 320i sell`"
        )
        await send_telegram_message(reply, chat_id)
        return reply

    # Determine intent
    intent = "SELL_INTENT" if "sell" in args.lower() else "BUY_INTENT"
    pipeline_type = "SELL" if intent == "SELL_INTENT" else "BUY"
    args_clean = args.replace("sell", "").replace("buy", "").strip()

    # Extract phone (starts with + or is 10+ digits)
    tokens = args_clean.split()
    phone = next((t for t in tokens if t.startswith("+") or (t.isdigit() and len(t) >= 8)), "")
    tokens_no_phone = [t for t in tokens if t != phone]

    # Heuristic: last 2-3 tokens = vehicle, earlier tokens = name
    vehicle = " ".join(tokens_no_phone[-3:]) if len(tokens_no_phone) >= 4 else ""
    name_tokens = tokens_no_phone[:-3] if len(tokens_no_phone) >= 4 else tokens_no_phone
    full_name = " ".join(name_tokens)

    if not full_name:
        full_name = args_clean.split()[0] if args_clean.split() else "Unknown"

    try:
        sb = get_supabase()
        m_parts = vehicle.split()
        m_manu = m_parts[0] if m_parts else None
        m_mod = " ".join(m_parts[1:]) if len(m_parts) > 1 else None
        lead_data = {
            "name": full_name,
            "phone": phone,
            "manufacturer": m_manu,
            "model": m_mod,
            "intent": intent,
            "channel": "TELEGRAM",
            "status": "NEW",
        }
        result = sb.table("leads").insert(lead_data).execute()
        lead_id = result.data[0].get("id", "N/A") if result.data else "N/A"

        reply = (
            f"✅ *Lead Created!*\n\n"
            f"👤 *Name:* {full_name}\n"
            f"📞 *Phone:* {phone or 'Not provided'}\n"
            f"🚗 *Vehicle Interest:* {vehicle or 'Not specified'}\n"
            f"📌 *Intent:* {pipeline_type} pipeline\n"
            f"🆔 *Lead ID:* `{lead_id}`\n\n"
            f"Use `/convert {full_name}` to create a project from this lead."
        )
    except Exception as e:
        logger.error(f"Create lead error: {e}")
        reply = f"❌ Failed to create lead: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_get_lead(text: str, chat_id: str) -> str:
    """Search or list leads."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip().lower() if len(parts) > 1 else ""

    try:
        leads = get_all_leads()
        if query:
            leads = [l for l in leads if query in (l.get("name") or "").lower()]

        if not leads:
            reply = f"🔍 No leads found{' matching *' + query + '*' if query else ''}."
        else:
            lines = [f"📋 *Leads ({len(leads)} found):*\n"]
            for l in leads[:10]:
                lines.append(
                    f"• *{l.get('name')}* — {l.get('pipeline_type', '?')} — "
                    f"{l.get('status', '?')} — 📞 {l.get('phone') or 'N/A'}"
                )
            if len(leads) > 10:
                lines.append(f"\n_...and {len(leads) - 10} more_")
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching leads: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_get_cars(text: str, chat_id: str) -> str:
    """List vehicles from active projects."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip().lower() if len(parts) > 1 else ""

    try:
        projects = get_all_projects()
        vehicles = [
            p for p in projects
            if p.get("target_vehicle") and p.get("status") == "ACTIVE"
        ]
        if query:
            vehicles = [v for v in vehicles if query in (v.get("target_vehicle") or "").lower()]

        if not vehicles:
            reply = f"🚗 No active vehicles found{' for *' + query + '*' if query else ''}."
        else:
            lines = [f"🚗 *Active Vehicles ({len(vehicles)}):*\n"]
            for v in vehicles[:10]:
                lines.append(
                    f"• *{v.get('target_vehicle')}* — "
                    f"{v.get('project_type', '?')} — "
                    f"Client: {v.get('client_name', 'N/A')}"
                )
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching vehicles: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_get_projects(chat_id: str) -> str:
    """List active projects with status."""
    try:
        projects = get_all_projects()
        active = [p for p in projects if p.get("status") == "ACTIVE"]
        if not active:
            reply = "📁 No active projects at the moment."
        else:
            lines = [f"📁 *Active Projects ({len(active)}):*\n"]
            for p in active[:10]:
                lines.append(
                    f"• *{p.get('client_name')}* — "
                    f"{p.get('project_type', '?')} — "
                    f"Stage: {p.get('stage', 'N/A')} — "
                    f"Vehicle: {p.get('target_vehicle') or 'TBD'}"
                )
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching projects: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_convert_lead(text: str, chat_id: str) -> str:
    """Convert a qualified lead into an active project."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip() if len(parts) > 1 else ""

    if not query:
        reply = "📋 Usage: `/convert [Lead Name or ID]`"
        await send_telegram_message(reply, chat_id)
        return reply

    try:
        leads = get_all_leads()
        match = next(
            (l for l in leads if query.lower() in (l.get("name") or "").lower()),
            None
        )
        if not match:
            reply = f"❌ No lead found matching *{query}*. Use `/leads` to view all leads."
            await send_telegram_message(reply, chat_id)
            return reply

        sb = get_supabase()
        p_type = "SELL" if "sell" in (match.get("intent") or "").lower() else "BUY"
        veh = match.get("vehicle_interest") or f"{match.get('manufacturer') or ''} {match.get('model') or ''}".strip()
        project_data = {
            "client_name": match.get("name"),
            "client_phone": match.get("phone"),
            "client_email": match.get("email"),
            "project_type": p_type,
            "target_vehicle": veh or "Vehicle TBD",
            "status": "ACTIVE",
            "current_stage": "Intake & Onboarding",
            "notes": match.get("notes") or f"Converted from Lead ID {match.get('id')}"
        }
        proj_result = sb.table("projects").insert(project_data).execute()
        project_id = proj_result.data[0].get("id", "N/A") if proj_result.data else "N/A"

        # Remove converted lead from leads table so client moves officially to Customers & Projects
        try:
            sb.table("leads").delete().eq("id", match.get("id")).execute()
        except Exception as del_err:
            logger.warning(f"Could not delete lead {match.get('id')}: {del_err}")

        # Create 3-tier Drive folders
        try:
            from app.services.gdrive_service import create_customer_folder_structure
            folders = create_customer_folder_structure(
                customer_name=match.get("name", "Unknown"),
                project_id=str(project_id)
            )
            folder_info = f"\n\n📂 *Drive Folders Created:*\n• OCR\n• Legal Docs\n• Signed Docs"
        except Exception as drive_err:
            folder_info = f"\n\n⚠️ Drive folders pending: {drive_err}"

        reply = (
            f"✅ *Project Created from Lead!*\n\n"
            f"👤 *Client:* {match.get('name')}\n"
            f"🚗 *Vehicle:* {match.get('vehicle_interest') or 'TBD'}\n"
            f"📌 *Pipeline:* {match.get('pipeline_type')}\n"
            f"🔄 *Stage:* Intake\n"
            f"🆔 *Project ID:* `{project_id}`"
            f"{folder_info}"
        )
    except Exception as e:
        logger.error(f"Convert lead error: {e}")
        reply = f"❌ Failed to convert lead: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_schedule(chat_id: str) -> str:
    """Fetch today's schedule from Outlook calendar."""
    try:
        from app.services.outlook_service import get_todays_schedule
        events = await get_todays_schedule()
        if not events:
            reply = "📅 No appointments found in your Outlook calendar for today."
        else:
            lines = ["📅 *Today's Schedule (Outlook):*\n"]
            for evt in events:
                lines.append(
                    f"• *{evt.get('time', 'All Day')}* — {evt.get('subject', 'No Subject')}"
                    + (f" 📍 {evt.get('location')}" if evt.get('location') else "")
                )
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Could not fetch Outlook schedule: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_summary(chat_id: str) -> str:
    """Generate a full CRM snapshot."""
    from datetime import datetime, timedelta
    try:
        leads = get_all_leads()
        projects = get_all_projects()
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()

        new_leads = [l for l in leads if l.get("created_at", "") >= yesterday]
        active_sell = [p for p in projects if p.get("project_type") == "SELL" and p.get("status") == "ACTIVE"]
        active_buy = [p for p in projects if p.get("project_type") == "BUY" and p.get("status") == "ACTIVE"]

        reply = (
            f"📊 *CAR-AGENTS CRM Summary*\n"
            f"_{datetime.utcnow().strftime('%A, %d %B %Y')}_\n\n"
            f"🆕 New Leads (24h): *{len(new_leads)}*\n"
            f"📋 Total Active Leads: *{len([l for l in leads if l.get('status') == 'ACTIVE'])}*\n"
            f"🏷️ Active SELL Projects: *{len(active_sell)}*\n"
            f"🔍 Active BUY Projects: *{len(active_buy)}*\n\n"
            f"Tap any button below to refresh or explore details."
        )
    except Exception as e:
        reply = f"❌ CRM summary error: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_briefing(chat_id: str) -> str:
    """Generate and deliver instant executive briefing digest."""
    try:
        from app.services.scheduler_service import generate_daily_briefing
        briefing_text = await generate_daily_briefing()
        await send_telegram_message(briefing_text, chat_id)
        return briefing_text
    except Exception as e:
        reply = f"❌ Briefing error: {str(e)}"
        await send_telegram_message(reply, chat_id)
        return reply
