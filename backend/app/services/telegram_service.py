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
from datetime import datetime
from typing import Optional, List, Dict, Any
from config import settings
from app.services.supabase_service import get_all_leads, get_all_projects
from database import get_supabase

logger = logging.getLogger("telegram_service")

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


def _format_date(iso_str: Optional[str]) -> str:
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return str(iso_str)[:10] if iso_str else "—"


# ─── Keyboards ────────────────────────────────────────────────────────────────

MAIN_REPLY_KEYBOARD = {
    "keyboard": [
        [{"text": "📊 Summary"}, {"text": "📋 Leads"}],
        [{"text": "💼 Active Deals"}, {"text": "👤 Customers"}],
        [{"text": "📅 Schedule"}, {"text": "📰 Briefing"}, {"text": "🚗 Cars"}]
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
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore') if hasattr(e, 'read') else str(e)
        logger.error(f"Telegram send HTTP error {e.code}: {err_body}")
        return {}
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
            "👤 *Customers* — Browse active customers & full profiles\n"
            "📅 *Schedule* — Read today's Outlook calendar\n"
            "📰 *Briefing* — Generate executive digest\n"
            "🚗 *Cars* — Browse active car inventory\n\n"
            "💡 *Shortcuts & Advanced Commands:*\n"
            "`/stage [Name] [Stage]` — Update deal stage\n"
            "`/customer [Name]` — View full profile & Drive folders\n"
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

    if text_lower.startswith("/stage"):
        return await _handle_stage(text, chat_id)

    if text_lower.startswith("/search"):
        return await _handle_get_lead(text, chat_id)

    if text_lower.startswith("/summary"):
        return await _handle_summary(chat_id)

    if text_lower.startswith("/customers") or text_lower.startswith("/getcustomers"):
        return await _handle_get_customers(text, chat_id)

    if text_lower.startswith("/customer") or text_lower.startswith("/getcustomer"):
        return await _handle_customer_detail(text, chat_id)

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

    if text_lower == "👤 customers" or text_lower == "customers":
        return await _handle_get_customers(text, chat_id)

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

    # Extract phone (starts with + or is 8+ digits)
    tokens = args_clean.split()
    phone = next((t for t in tokens if t.startswith("+") or (t.isdigit() and len(t) >= 8)), "")

    if phone and phone in tokens:
        phone_idx = tokens.index(phone)
        name_tokens = tokens[:phone_idx]
        vehicle_tokens = tokens[phone_idx + 1:]
        full_name = " ".join(name_tokens) if name_tokens else "Unknown"
        vehicle = " ".join(vehicle_tokens) if vehicle_tokens else ""
    else:
        # Fallback if no phone token found: last 2 tokens = vehicle, rest = name
        if len(tokens) >= 3:
            full_name = " ".join(tokens[:-2])
            vehicle = " ".join(tokens[-2:])
        elif len(tokens) == 2:
            full_name = tokens[0]
            vehicle = tokens[1]
        else:
            full_name = " ".join(tokens) if tokens else "Unknown"
            vehicle = ""

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

        phone_button = (
            {"text": f"📞 {phone}", "callback_data": f"/customer {full_name}"}
            if phone
            else {"text": "👤 View Customer", "callback_data": f"/customer {full_name}"}
        )
        inline_buttons = {
            "inline_keyboard": [
                [
                    {"text": "⚡ Convert to Project", "callback_data": f"/convert {full_name}"},
                    phone_button
                ]
            ]
        }

        reply = (
            f"✅ *Lead Created!*\n\n"
            f"👤 *Name:* {full_name}\n"
            f"📞 *Phone:* {phone or 'Not provided'}\n"
            f"🚗 *Vehicle Interest:* {vehicle or 'Not specified'}\n"
            f"📌 *Intent:* {pipeline_type} pipeline\n"
            f"🆔 *Lead ID:* `{lead_id}`\n\n"
            f"Tap **⚡ Convert to Project** below or use `/convert {full_name}`."
        )
        await send_telegram_message(reply, chat_id, reply_markup=inline_buttons)
        return reply
    except Exception as e:
        logger.error(f"Create lead error: {e}")
        reply = f"❌ Failed to create lead: {str(e)}"
        await send_telegram_message(reply, chat_id)
        return reply


async def _handle_get_lead(text: str, chat_id: str) -> str:
    """Search or list leads with creation dates and formatted intents."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip().lower() if len(parts) > 1 else ""
    if query in ["leads", "lead", "📋 leads"]:
        query = ""

    try:
        leads = get_all_leads()
        if query:
            leads = [l for l in leads if query in (l.get("name") or "").lower()]

        if not leads:
            reply = f"🔍 No leads found{' matching *' + query + '*' if query else ''}."
        else:
            lines = [f"📋 *Active Inbound Leads ({len(leads)} found):*\n"]
            for l in leads[:10]:
                name = l.get("name") or "Unknown Lead"
                intent = l.get("intent") or l.get("pipeline_type") or "NEW"
                phone = l.get("phone") or "N/A"
                veh = l.get("vehicle_interest") or f"{l.get('manufacturer') or ''} {l.get('model') or ''}".strip() or "Vehicle TBD"
                created = _format_date(l.get("created_at"))
                status = l.get("status") or "NEW"
                lines.append(
                    f"• *{name}* — `{intent}` — *{veh}*\n"
                    f"  └ Status: _{status}_ | 📅 Created: {created} | 📞 {phone}"
                )
            if len(leads) > 10:
                lines.append(f"\n_...and {len(leads) - 10} more_")
            lines.append("\n💡 _Type `/convert [Lead Name]` to convert a lead into an active deal & Drive storage._")
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching leads: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_get_cars(text: str, chat_id: str) -> str:
    """List vehicles from active projects with creation date and status."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip().lower() if len(parts) > 1 else ""
    if query in ["cars", "car", "inventory", "🚗 cars"]:
        query = ""

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
            lines = [f"🚗 *Active Vehicle Inventory ({len(vehicles)} found):*\n"]
            for v in vehicles[:10]:
                veh = v.get("target_vehicle")
                p_type = v.get("project_type", "?")
                client = v.get("client_name", "N/A")
                created = _format_date(v.get("created_at"))
                stage = v.get("current_stage") or "Intake"
                lines.append(
                    f"• *{veh}* — {p_type} BROKERAGE\n"
                    f"  └ Client: _{client}_ | Stage: _{stage}_ | 📅 Created: {created}"
                )
            if len(vehicles) > 10:
                lines.append(f"\n_...and {len(vehicles) - 10} more_")
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching vehicles: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_get_projects(chat_id: str) -> str:
    """List active projects with status, vehicle, stage, created date, and Google Drive links."""
    try:
        projects = get_all_projects()
        active = [p for p in projects if p.get("status") == "ACTIVE"]
        if not active:
            reply = "📁 No active projects at the moment."
        else:
            lines = [f"📁 *Active Projects & Deals ({len(active)}):*\n"]
            for p in active[:10]:
                c_name = p.get("client_name") or "Unknown"
                p_type = p.get("project_type", "?")
                veh = p.get("target_vehicle") or "TBD"
                stage = p.get("current_stage") or p.get("stage") or "Intake & Onboarding"
                created = _format_date(p.get("created_at"))

                # Google Drive folder link
                drive_str = ""
                try:
                    from app.services.gdrive_service import create_customer_folder_structure
                    struct = create_customer_folder_structure(c_name, str(p.get("id")))
                    cust_url = struct.get("customer_folder_url")
                    if cust_url:
                        drive_str = f"\n  └ 📂 Drive: {cust_url}"
                except Exception:
                    drive_str = ""

                lines.append(
                    f"• *{c_name}* — {p_type} — *{veh}*\n"
                    f"  └ Stage: _{stage}_ | 📅 Created: {created}{drive_str}"
                )
            if len(active) > 10:
                lines.append(f"\n_...and {len(active) - 10} more_")
            lines.append("\n💡 _Type `/stage [Customer] [Stage]` to update stage or `/customer [Name]` for full profile._")
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
    """Fetch today's merged schedule from Outlook and DB calendar."""
    try:
        from app.services.outlook_service import get_todays_schedule
        events = await get_todays_schedule()
        if not events:
            reply = "📅 No appointments found for today."
        else:
            lines = ["📅 *Today's Schedule (Outlook & Calendar DB):*\n"]
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
    """Generate a rich, executive CRM snapshot."""
    from datetime import datetime, timedelta
    try:
        leads = get_all_leads()
        projects = get_all_projects()
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()

        new_leads = [l for l in leads if (l.get("created_at") or "") >= yesterday]
        active_leads = [l for l in leads if l.get("status") in ["NEW", "ACTIVE"]]
        active_sell = [p for p in projects if p.get("project_type") == "SELL" and p.get("status") == "ACTIVE"]
        active_buy = [p for p in projects if p.get("project_type") == "BUY" and p.get("status") == "ACTIVE"]

        # Calculate Total Pipeline Valuation
        total_val = sum(
            (p.get("agreed_sale_price") or p.get("purchase_price") or 0)
            for p in projects if p.get("status") == "ACTIVE"
        )

        # Stage distribution
        stages_count = {}
        for p in projects:
            if p.get("status") == "ACTIVE":
                stg = p.get("current_stage") or "Intake & Onboarding"
                stages_count[stg] = stages_count.get(stg, 0) + 1

        stage_lines = [f"  • _{stg}_: *{cnt}*" for stg, cnt in stages_count.items()]
        stage_summary_text = "\n".join(stage_lines) if stage_lines else "  • _No active stages_"

        # Fetch today's Outlook appointments
        schedule_info = ""
        try:
            from app.services.outlook_service import get_todays_schedule
            events = await get_todays_schedule()
            if events:
                evt_lines = [f"• *{e.get('time', 'All Day')}* — {e.get('subject', 'Meeting')}" for e in events[:3]]
                schedule_info = "\n\n📅 *Today's Appointments:*\n" + "\n".join(evt_lines)
        except Exception:
            schedule_info = ""

        reply = (
            f"📊 *CAR-AGENTS Executive CRM Summary*\n"
            f"_{datetime.utcnow().strftime('%A, %d %B %Y')}_\n\n"
            f"💰 *Total Active Portfolio Value:* €{total_val:,.2f}\n\n"
            f"📈 *Active Deals & Pipeline Snapshot:*\n"
            f"• 🏷️ Active SELL Projects: *{len(active_sell)}*\n"
            f"• 🔍 Active BUY Projects: *{len(active_buy)}*\n"
            f"• 🆕 New Inbound Leads (24h): *{len(new_leads)}* (Total Active: *{len(active_leads)}*)\n\n"
            f"🔄 *Sales Stage Breakdown:*\n"
            f"{stage_summary_text}"
            f"{schedule_info}\n\n"
            f"💡 _Tap quick action buttons below or type `/customer [Name]` to view details._"
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


async def _handle_get_customers(text: str, chat_id: str) -> str:
    """List all customers (from active projects & converted clients) with summary details."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip().lower() if len(parts) > 1 else ""
    if query in ["customers", "customer", "👤 customers"]:
        query = ""

    try:
        projects = get_all_projects()
        if query:
            projects = [
                p for p in projects
                if query in (p.get("client_name") or "").lower()
                or query in (p.get("target_vehicle") or "").lower()
            ]

        if not projects:
            reply = f"👤 No active customers found{' matching *' + query + '*' if query else ''}."
        else:
            lines = [f"👤 *Active Customers ({len(projects)} found):*\n"]
            for p in projects[:10]:
                name = p.get("client_name", "Unknown")
                p_type = p.get("project_type", "?")
                veh = p.get("target_vehicle") or "TBD"
                stage = p.get("current_stage") or p.get("stage") or "N/A"
                phone = p.get("client_phone") or "N/A"
                created = _format_date(p.get("created_at"))

                drive_str = ""
                try:
                    from app.services.gdrive_service import create_customer_folder_structure
                    struct = create_customer_folder_structure(name, str(p.get("id")))
                    cust_url = struct.get("customer_folder_url")
                    if cust_url:
                        drive_str = f"\n  └ 📂 Drive: {cust_url}"
                except Exception:
                    drive_str = ""

                lines.append(f"• *{name}* — {p_type} — {veh}\n  └ Stage: _{stage}_ | 📅 {created} | 📞 {phone}{drive_str}")

            if len(projects) > 10:
                lines.append(f"\n_...and {len(projects) - 10} more_")
            
            lines.append("\n💡 _Type `/customer [Name]` to view full customer profile & Drive folder._")
            reply = "\n".join(lines)
    except Exception as e:
        reply = f"❌ Error fetching customers: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


async def _handle_customer_detail(text: str, chat_id: str) -> str:
    """Fetch full detailed customer card for a specific client name or project ID."""
    parts = text.split(maxsplit=1)
    query = parts[1].strip() if len(parts) > 1 else ""

    if not query:
        reply = (
            "👤 *Customer Profile Lookup — Usage:*\n"
            "`/customer [Customer Name or ID]`\n\n"
            "Example: `/customer Stefan Meier` or `/customers` to view all active customers."
        )
        await send_telegram_message(reply, chat_id)
        return reply

    try:
        # Search in active projects/customers first
        projects = get_all_projects()
        match = next(
            (p for p in projects if query.lower() in (p.get("client_name") or "").lower() or str(p.get("id")) == query),
            None
        )

        if match:
            c_name = match.get("client_name") or "Unknown"
            c_phone = match.get("client_phone") or "Not provided"
            c_email = match.get("client_email") or "Not provided"
            p_type = match.get("project_type") or "N/A"
            veh = match.get("target_vehicle") or "TBD"
            stage = match.get("current_stage") or match.get("stage") or "Intake"
            status = match.get("status") or "ACTIVE"
            p_id = match.get("id") or "N/A"
            notes = match.get("notes") or "No internal notes."
            created = _format_date(match.get("created_at"))
            updated = _format_date(match.get("updated_at"))

            # Drive folder link
            drive_info = ""
            try:
                from app.services.gdrive_service import create_customer_folder_structure
                folders = create_customer_folder_structure(c_name, str(p_id))
                cust_url = folders.get("customer_folder_url")
                if cust_url:
                    drive_info = f"\n\n📂 *Google Drive Storage Folder:*\n🔗 {cust_url}"
            except Exception as d_err:
                logger.warning(f"Drive folder lookup error: {d_err}")
                drive_info = ""

            reply = (
                f"👤 *Customer Full Profile — {c_name}*\n\n"
                f"📞 *Phone:* {c_phone}\n"
                f"📧 *Email:* {c_email}\n"
                f"📌 *Deal Type:* {p_type} Brokerage\n"
                f"🚗 *Target Vehicle:* {veh}\n"
                f"🔄 *Sales Stage:* {stage}\n"
                f"📊 *Project Status:* {status}\n"
                f"📅 *Created Date:* {created}\n"
                f"🔄 *Last Updated:* {updated}\n"
                f"🆔 *Project ID:* `{p_id}`"
                f"{drive_info}\n\n"
                f"📝 *Notes:* {notes}"
            )
        else:
            # Fallback to check leads if customer isn't converted yet
            leads = get_all_leads()
            lead_match = next(
                (l for l in leads if query.lower() in (l.get("name") or "").lower()),
                None
            )
            if lead_match:
                reply = (
                    f"📋 *Customer Inquiry (Lead) — {lead_match.get('name')}*\n\n"
                    f"📞 *Phone:* {lead_match.get('phone') or 'N/A'}\n"
                    f"📧 *Email:* {lead_match.get('email') or 'N/A'}\n"
                    f"📌 *Intent:* {lead_match.get('intent', 'N/A')} ({lead_match.get('pipeline_type', 'N/A')})\n"
                    f"🚗 *Vehicle Interest:* {lead_match.get('vehicle_interest') or (lead_match.get('manufacturer', '') + ' ' + lead_match.get('model', '')).strip()}\n"
                    f"📊 *Lead Status:* {lead_match.get('status')}\n"
                    f"🆔 *Lead ID:* `{lead_match.get('id')}`\n\n"
                    f"📝 *Notes:* {lead_match.get('notes') or 'No notes.'}\n\n"
                    f"💡 _Use `/convert {lead_match.get('name')}` to upgrade this lead to an active customer project._"
                )
            else:
                reply = f"❌ No customer or lead found matching *{query}*. Type `/customers` to view all active customers."

    except Exception as e:
        logger.error(f"Customer detail error: {e}")
        reply = f"❌ Error fetching customer details: {str(e)}"

    await send_telegram_message(reply, chat_id)
    return reply


# ─── Sales Stage Management ──────────────────────────────────────────────────

STAGES = [
    "Intake & Onboarding",
    "Sourcing & Inspection",
    "Contract Signing",
    "Payment & Settlement",
    "Handover & Delivered"
]


def _match_stage(query: str) -> Optional[str]:
    """Matches partial query string to standard sales stage."""
    q = query.strip().lower()
    for s in STAGES:
        if q == s.lower():
            return s
    if "intake" in q or "onboard" in q:
        return "Intake & Onboarding"
    if "sourc" in q or "inspect" in q:
        return "Sourcing & Inspection"
    if "contract" in q or "sign" in q:
        return "Contract Signing"
    if "pay" in q or "settle" in q:
        return "Payment & Settlement"
    if "handover" in q or "deliver" in q or "done" in q:
        return "Handover & Delivered"
    return None


async def _handle_stage(text: str, chat_id: str) -> str:
    """
    View or update sales stage for an active deal:
      /stage                          → List active projects & valid stages
      /stage Stefan Meier             → View current stage & stage action buttons
      /stage Stefan Meier Contract    → Update stage to 'Contract Signing'
    """
    parts = text.split(maxsplit=1)
    args = parts[1].strip() if len(parts) > 1 else ""

    projects = get_all_projects()
    active_projects = [p for p in projects if p.get("status") == "ACTIVE"]

    if not args:
        lines = [
            "🔄 *Sales Stage Manager*\n",
            "Usage: `/stage [Client Name] [Stage Name]`",
            "Example: `/stage Stefan Meier Contract Signing`\n",
            "📌 *Standard Sales Stages:*",
            "1️⃣ `Intake & Onboarding`",
            "2️⃣ `Sourcing & Inspection`",
            "3️⃣ `Contract Signing`",
            "4️⃣ `Payment & Settlement`",
            "5️⃣ `Handover & Delivered`\n",
        ]
        if active_projects:
            lines.append("📁 *Active Client Projects:*")
            for p in active_projects[:8]:
                c_name = p.get("client_name", "Unknown")
                stg = p.get("current_stage") or p.get("stage") or "Intake & Onboarding"
                lines.append(f"• *{c_name}* — Stage: _{stg}_")
            lines.append("\n💡 _Type `/stage [Client Name]` to get stage action buttons._")
        else:
            lines.append("📁 _No active projects found._")

        reply = "\n".join(lines)
        await send_telegram_message(reply, chat_id)
        return reply

    # Match client name in active projects (longest client name first)
    active_projects.sort(key=lambda p: len(p.get("client_name") or ""), reverse=True)
    match = next(
        (p for p in active_projects if (p.get("client_name") or "").lower() in args.lower() or str(p.get("id")) == args),
        None
    )

    if not match:
        match = next(
            (p for p in projects if (p.get("client_name") or "").lower() in args.lower() or str(p.get("id")) == args),
            None
        )

    if not match:
        reply = f"❌ No project found matching *{args}*. Type `/stage` to view active projects."
        await send_telegram_message(reply, chat_id)
        return reply

    c_name = match.get("client_name", "Unknown")
    current_stg = match.get("current_stage") or match.get("stage") or "Intake & Onboarding"
    p_id = match.get("id")

    # Extract target stage text if user specified one
    remaining_text = args.lower().replace(c_name.lower(), "").strip()
    target_stage = _match_stage(remaining_text) if remaining_text else None

    if target_stage:
        try:
            sb = get_supabase()
            upd = {
                "current_stage": target_stage,
                "updated_at": datetime.utcnow().isoformat()
            }
            sb.table("projects").update(upd).eq("id", p_id).execute()

            reply = (
                f"✅ *Sales Stage Updated!*\n\n"
                f"👤 *Client:* {c_name}\n"
                f"🚗 *Vehicle:* {match.get('target_vehicle') or 'TBD'}\n"
                f"📌 *Pipeline:* {match.get('project_type')} Brokerage\n"
                f"🔄 *New Stage:* {target_stage}\n"
                f"🆔 *Project ID:* `{p_id}`"
            )
        except Exception as e:
            logger.error(f"Stage update error: {e}")
            reply = f"❌ Failed to update stage: {str(e)}"

        await send_telegram_message(reply, chat_id)
        return reply

    # If client matched but no target stage provided: display current stage + transition buttons!
    buttons = []
    for s in STAGES:
        if s != current_stg:
            buttons.append([{"text": f"➡️ Move to: {s}", "callback_data": f"/stage {c_name} {s}"}])

    inline_markup = {"inline_keyboard": buttons}

    reply = (
        f"👤 *Customer:* {c_name}\n"
        f"🚗 *Vehicle:* {match.get('target_vehicle') or 'TBD'}\n"
        f"🔄 *Current Stage:* *{current_stg}*\n\n"
        f"Tap a button below to advance stage:"
    )
    await send_telegram_message(reply, chat_id, reply_markup=inline_markup)
    return reply
