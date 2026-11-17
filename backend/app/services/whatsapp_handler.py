"""
app/services/whatsapp_handler.py
────────────────────────────────────────────────────────────────────────
Brain of the WhatsApp channel. The webhook hands every incoming message here.

  Founder (number in WHATSAPP_OWNER_PHONES)  -> simple commands
        help | leads | deals | summary | customer <name> | photo/PDF -> OCR
  Anyone else (customer)                    -> lead capture + fixed
        qualification questions (see whatsapp_flow.py) + document OCR

No LLM is needed for the chat flow. OCR reuses the existing pipeline.
────────────────────────────────────────────────────────────────────────
"""
import asyncio
import logging
import os
import re
import tempfile
from typing import Dict, List, Optional

from config import settings
from app.services import whatsapp_flow as flow
from app.services import whatsapp_store as store
from app.services.whatsapp_service import normalize_phone, send_message, send_whatsapp_message, download_media

logger = logging.getLogger("whatsapp_handler")

_MIME_SUFFIX = {
    "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png",
    "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/amr": ".amr",
}
_LABEL_ICON = {"HOT": "🔥", "WARM": "🟡", "COLD": "❄️"}


# ─── Entry point ──────────────────────────────────────────────────────────

def owner_phones() -> List[str]:
    raw = f"{settings.WHATSAPP_OWNER_PHONES},{settings.BRIEFING_WHATSAPP_RECIPIENT}"
    return list(dict.fromkeys(p for p in (normalize_phone(x) for x in raw.split(",")) if p))


async def handle_webhook_payload(data: Dict) -> None:
    """Process a full Meta webhook payload (may contain several messages)."""
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            contacts = {c.get("wa_id"): c.get("profile", {}).get("name") for c in value.get("contacts", [])}
            for msg in value.get("messages", []):  # 'statuses' (delivery receipts) are ignored
                try:
                    await handle_message(msg, contacts.get(msg.get("from")))
                except Exception:
                    logger.exception("Error handling WhatsApp message")


def _extract_input(msg: Dict) -> Dict:
    """Normalise the different Meta message shapes into one dict."""
    mtype = msg.get("type")
    out = {"type": mtype, "text": None, "reply_id": None, "media_id": None, "mime": None}
    if mtype == "text":
        out["text"] = msg.get("text", {}).get("body", "")
    elif mtype == "interactive":
        inter = msg.get("interactive", {})
        rep = inter.get("button_reply") or inter.get("list_reply") or {}
        out["reply_id"], out["text"] = rep.get("id"), rep.get("title")
    elif mtype == "button":  # quick-reply on a template
        out["reply_id"], out["text"] = msg.get("button", {}).get("payload"), msg.get("button", {}).get("text")
    elif mtype in ("image", "document", "audio"):
        media = msg.get(mtype, {})
        out["media_id"], out["mime"] = media.get("id"), media.get("mime_type")
        out["text"] = media.get("caption")
    return out


async def handle_twilio_payload(form: Dict) -> None:
    """Convert Twilio's form-encoded WhatsApp webhook into our standard message dict."""
    sid = form.get("MessageSid") or form.get("SmsMessageSid")
    from_raw = form.get("From", "")
    profile_name = form.get("ProfileName") or "WhatsApp Client"
    body = form.get("Body", "")
    num_media = int(form.get("NumMedia", "0") or 0)

    if num_media > 0 and form.get("MediaUrl0"):
        mime = form.get("MediaContentType0", "image/jpeg")
        mtype = "image" if mime.startswith("image/") else "audio" if mime.startswith("audio/") else "document"
        msg = {
            "id": sid,
            "from": from_raw,
            "type": mtype,
            mtype: {"id": form["MediaUrl0"], "mime_type": mime, "caption": body},
        }
    else:
        msg = {
            "id": sid,
            "from": from_raw,
            "type": "text",
            "text": {"body": body},
        }
    try:
        await handle_message(msg, profile_name)
    except Exception:
        logger.exception("Error handling Twilio WhatsApp message")


_OWNER_CMDS = {
    "help", "/help", "hilfe", "?",
    "leads", "anfragen", "/leads",
    "deals", "projekte", "projects", "/deals",
    "summary", "zusammenfassung", "status", "/summary",
    "reset", "/reset",
    "customer", "kunde", "find", "/customer",
    "convert", "/convert",
    "stage", "/stage",
}


def _is_owner_command(text: Optional[str]) -> bool:
    if not text:
        return False
    cmd = text.strip().lower().partition(" ")[0]
    return cmd in _OWNER_CMDS


async def handle_message(msg: Dict, profile_name: Optional[str] = None) -> None:
    if store.already_processed(msg.get("id")):
        return
    phone = normalize_phone(msg.get("from"))
    inp = _extract_input(msg)
    if phone in owner_phones():
        text = (inp.get("text") or "").strip()
        session = store.get_session(phone)
        in_active_flow = session is not None and not session.get("done")

        # Founder testing the qualification flow:
        # If in active flow, route all input to customer qualification UNLESS founder explicitly types an exit command
        explicit_exit = text.lower() in ("reset", "/reset", "help", "/help", "leads", "deals", "summary")
        if in_active_flow and not explicit_exit:
            await handle_customer(phone, profile_name or "WhatsApp Client", inp)
            return

        # Not in active flow: if starting qualification test (e.g. "Hallo, ich möchte ein Auto kaufen"):
        if not _is_owner_command(text) and (
            flow.detect_intent(text) in ("BUY", "SELL")
            or text.lower() in ("hi", "hallo", "hello", "test")
        ):
            await handle_customer(phone, profile_name or "WhatsApp Client", inp)
            return
        await handle_owner(phone, inp)
    else:
        await handle_customer(phone, profile_name or "WhatsApp Client", inp)


# ─── OCR (reuses the existing document pipeline) ──────────────────────────

async def ocr_extract(data: bytes, mime: str) -> Dict:
    """Bytes -> vehicle specs dict. Uses Claude Vision for images/scans and text extraction for digital PDFs."""
    from app.services.claude_service import extract_vehicle_specs, extract_vehicle_specs_from_image

    # Image format (JPEG, PNG): use Claude Vision directly for maximum accuracy
    if (mime or "").startswith("image/"):
        return await extract_vehicle_specs_from_image(data, mime)

    # PDF format: try digital extraction first
    from app.services.pdf_service import extract_document_text
    suffix = _MIME_SUFFIX.get(mime, ".pdf")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        text = await asyncio.to_thread(extract_document_text, path)
        if text.strip():
            specs = await extract_vehicle_specs(text)
            if specs:
                return specs
        # If digital text was empty (scanned PDF), rasterize page 0 and use Claude Vision
        try:
            import fitz
            doc = fitz.open(path)
            if len(doc) > 0:
                pix = doc[0].get_pixmap(dpi=150)
                return await extract_vehicle_specs_from_image(pix.tobytes("jpeg"), "image/jpeg")
        except Exception as e:
            logger.warning(f"PDF page rasterization failed: {e}")
        return {}
    finally:
        if os.path.exists(path):
            os.unlink(path)


async def _specs_from_media(inp: Dict) -> Optional[Dict]:
    if not inp["media_id"] or inp["type"] not in ("image", "document"):
        return None
    media = await download_media(inp["media_id"])
    if not media:
        return None
    data, mime = media
    return await ocr_extract(data, inp["mime"] or mime)


def _specs_to_lead_fields(specs: Dict) -> Dict:
    mapping = {
        "manufacturer": "manufacturer", "model": "model", "vin": "vin",
        "licence_plate": "license_plate", "initial_registration": "initial_registration",
        "mileage": "mileage", "power_ps": "power_ps", "displacement_ccm": "displacement_ccm",
        "tuv_expiry": "tuev_until",
    }
    return {col: str(specs[k]) for k, col in mapping.items() if specs.get(k) is not None}


def _specs_line(specs: Dict) -> str:
    name = " ".join(str(specs[k]) for k in ("manufacturer", "model") if specs.get(k)) or "Vehicle document"
    extras = [f"VIN {specs['vin']}"] if specs.get("vin") else []
    if specs.get("licence_plate"):
        extras.append(str(specs["licence_plate"]))
    return name + (f" ({', '.join(extras)})" if extras else "")


def _missing_basics(specs: Dict) -> List[str]:
    return [k for k in ("vin", "manufacturer", "model", "initial_registration") if not specs.get(k)]


# ─── Founder side ─────────────────────────────────────────────────────────

HELP_TEXT = (
    "🚗 *CAR-AGENTS Assistant — Founder Cockpit*\n\n"
    "📊 *CRM Quick Views:*\n"
    "• `summary` — KPI snapshot & active deals\n"
    "• `leads` — Latest 10 leads with quality tags\n"
    "• `deals` — Active deals and Kanban stages\n"
    "• `customer <name>` — Find customer, lead, or deal\n\n"
    "⚡ *CRM Actions (POST/Update):*\n"
    "• `convert <lead>` — Convert lead into active deal\n"
    "• `stage <client> <stage>` — Update deal stage\n"
    "   _(Stages: Intake, Sourcing, Negotiation, Marketing, Completed)_\n\n"
    "📄 *Vehicle Document OCR:*\n"
    "• Send a photo or PDF of a Fahrzeugschein to extract specs\n\n"
    "🔄 *Testing:*\n"
    "• `reset` — Restart customer qualification test"
)

OWNER_BUTTONS = [
    ("summary", "📊 Summary"),
    ("leads", "👥 Leads"),
    ("deals", "🚗 Deals"),
]


def _lead_label(lead: Dict) -> str:
    label = lead.get("lead_label")
    if not label:
        m = re.search(r"\b(HOT|WARM|COLD)\b", lead.get("notes") or "")
        label = m.group(1) if m else None
    return f"{_LABEL_ICON.get(label, '•')} {label}" if label else "• new"


def format_leads(leads: List[Dict]) -> str:
    if not leads:
        return "No leads yet."
    lines = ["Latest leads:"]
    for i, l in enumerate(leads, 1):
        intent = (l.get("intent") or "UNKNOWN").replace("_INTENT", "")
        lines.append(f"{i}. {l.get('name') or 'Unknown'} - {intent} - {_lead_label(l)} ({l.get('channel') or '?'})"
                     + (f"\n   📞 {l['phone']}" if l.get("phone") else ""))
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
    return (f"📊 *Summary:*\n• New leads: {new_leads}\n• Hot leads: {hot}\n• Active deals: {len(projects)}\n{stage_txt}")


async def _owner_text(inp: Dict) -> Optional[str]:
    """Text of the founder's message; voice notes are transcribed when Whisper is available."""
    if inp["type"] == "audio" and inp["media_id"]:
        media = await download_media(inp["media_id"])
        if not media:
            return None
        try:
            from app.services.whisper_service import transcribe_bytes
            data, mime = media
            return await asyncio.to_thread(transcribe_bytes, data, _MIME_SUFFIX.get(mime, ".ogg"))
        except Exception:
            logger.exception("Voice transcription failed")
            return None
    return inp["text"]


async def handle_owner(phone: str, inp: Dict) -> None:
    if inp["type"] in ("image", "document"):
        specs = await _specs_from_media(inp)
        if not specs:
            await send_message(phone, "I could not read that document. Please send a clear photo or PDF.", buttons=OWNER_BUTTONS)
            return
        miss = _missing_basics(specs)
        reply = f"📄 {_specs_line(specs)}" + (f"\nMissing: {', '.join(miss)}" if miss else "\nAll key fields found ✅")
        await send_message(phone, reply, buttons=OWNER_BUTTONS)
        return

    btn_id = (inp.get("reply_id") or "").lower().strip()
    text = (await _owner_text(inp) or "").strip()
    low = text.lower()

    if btn_id:
        cmd, arg = btn_id, ""
    elif low in ("1", "summary", "📊 summary", "/summary", "zusammenfassung", "status"):
        cmd, arg = "summary", ""
    elif low in ("2", "leads", "👥 leads", "/leads", "anfragen"):
        cmd, arg = "leads", ""
    elif low in ("3", "deals", "🚗 deals", "/deals", "projekte", "projects"):
        cmd, arg = "deals", ""
    elif low in ("reset", "/reset", "🔄 reset"):
        cmd, arg = "reset", ""
    elif low in ("help", "/help", "hilfe", "?"):
        cmd, arg = "help", ""
    else:
        cmd, _, arg = low.partition(" ")
        arg = arg.strip()

    buttons = OWNER_BUTTONS

    if cmd == "reset":
        store.delete_session(phone)
        reply = "🔄 Session reset! Send a customer message (e.g. 'Hallo, ich möchte ein Auto kaufen') to test lead qualification, or choose a founder command:"
        buttons = OWNER_BUTTONS
    elif cmd == "leads":
        reply = format_leads(store.list_leads(10))
        buttons = [("summary", "📊 Summary"), ("deals", "🚗 Deals"), ("reset", "🔄 Reset")]
    elif cmd == "deals":
        reply = format_deals(store.list_active_projects())
        buttons = [("summary", "📊 Summary"), ("leads", "👥 Leads"), ("reset", "🔄 Reset")]
    elif cmd == "summary":
        reply = format_summary(store.list_leads(200), store.list_active_projects(100))
        buttons = [("leads", "👥 Leads"), ("deals", "🚗 Deals"), ("reset", "🔄 Reset")]
    elif cmd in ("customer", "kunde", "find") and arg:
        found = store.search_leads_and_projects(arg)
        reply = "\n\n".join(x for x in (
            format_leads(found["leads"]) if found["leads"] else "",
            format_deals(found["projects"]) if found["projects"] else "") if x) or f"Nothing found for '{arg}'."
        buttons = OWNER_BUTTONS
    elif cmd in ("convert", "/convert") and arg:
        proj = store.convert_lead_to_project(arg)
        if proj:
            reply = (
                f"✅ *Lead Converted to Active Deal!*\n\n"
                f"👤 Client: {proj.get('client_name')}\n"
                f"🚗 Vehicle: {proj.get('target_vehicle') or 'TBD'}\n"
                f"📌 Type: {proj.get('project_type')}\n"
                f"🔄 Stage: {proj.get('current_stage')}\n\n"
                f"View in portal: https://car-agents-omega.vercel.app/deals"
            )
        else:
            reply = f"❌ No matching lead found for '{arg}'. Use `leads` to view available leads."
        buttons = [("deals", "🚗 View Deals"), ("leads", "👥 Leads"), ("summary", "📊 Summary")]
    elif cmd in ("stage", "/stage") and arg:
        parts = arg.split(maxsplit=1)
        client_name = parts[0]
        stage_name = parts[1] if len(parts) > 1 else ""
        if not stage_name:
            reply = (
                "Usage: `stage <client_name> <new_stage>`\n"
                "Example: `stage Carlos Negotiation`\n"
                "Valid stages: Intake, Sourcing, Negotiation, Marketing, Completed"
            )
        else:
            updated = store.update_project_stage(client_name, stage_name)
            if updated:
                proj, stg = updated
                reply = (
                    f"✅ *Stage Updated!*\n\n"
                    f"👤 Client: {proj.get('client_name')}\n"
                    f"🚗 Vehicle: {proj.get('target_vehicle') or 'TBD'}\n"
                    f"🔄 New Stage: *{stg}*"
                )
            else:
                reply = f"❌ Could not update stage. Check client name ('{client_name}') or stage ('{stage_name}')."
        buttons = [("deals", "🚗 View Deals"), ("summary", "📊 Summary"), ("leads", "👥 Leads")]
    else:
        reply = HELP_TEXT
        buttons = OWNER_BUTTONS

    await send_message(phone, reply, buttons=buttons)


async def notify_owner(text: str) -> None:
    for p in owner_phones():
        await send_message(p, text, buttons=[("leads", "👥 Leads"), ("deals", "🚗 Deals"), ("summary", "📊 Summary")])


# ─── Customer side ────────────────────────────────────────────────────────

async def handle_customer(phone: str, name: str, inp: Dict) -> None:
    lead = store.find_lead_by_phone(phone)
    state = store.get_session(phone)
    first_contact = state is None
    if first_contact:
        state = flow.new_state(inp["text"] or "")

    if not lead:
        lead = store.create_lead({
            "name": name, "phone": phone, "channel": "WHATSAPP",
            "intent": f"{state['intent']}_INTENT" if state["intent"] in ("BUY", "SELL") else "UNKNOWN",
            "status": "NEW", "message": inp["text"] or f"[{inp['type']}]",
        })
    lead_id = lead.get("id")
    name = lead.get("name") or name

    store.save_communication({
        "lead_id": lead_id, "channel": "WHATSAPP", "sender_name": name, "sender_contact": phone,
        "subject": "Inbound WhatsApp Message", "body": inp["text"] or f"[{inp['type']}]", "is_inbound": True,
    })

    # Customer already qualified: don't restart, just pass messages (and documents) to the founder.
    if state.get("done"):
        await _after_done(phone, name, lead_id, inp)
        return

    reply = None
    if inp["type"] in ("image", "document"):
        specs = await _specs_from_media(inp)
        if specs:
            store.update_lead(lead_id, _specs_to_lead_fields(specs))
            applied = flow.apply_vehicle_document(state, specs)
            if applied:
                state, reply = applied
            else:
                reply = {"text": _ack_document(state["lang"], specs), "buttons": None}
            await notify_owner(f"📄 {name} (+{phone}) sent a document: {_specs_line(specs)}")
        else:
            reply = {"text": "Danke! Wir haben Ihre Datei erhalten." if state["lang"] == "de" else "Thanks! We received your file.", "buttons": None}
            await notify_owner(f"📎 {name} (+{phone}) sent a {inp['type']} (could not be read automatically).")
    elif first_contact:
        # Greet first. If the first message already told us buy/sell, the first question is already the next one.
        reply = flow.prompt(state, first_contact=True)
    else:
        state, reply = flow.handle_input(state, inp["reply_id"], inp["text"])

    if state.get("done"):
        await _on_qualified(lead_id, name, phone, state)

    store.save_session(phone, state)
    if reply:
        await send_message(phone, reply["text"], reply.get("buttons"))


def _ack_document(lang: str, specs: Dict) -> str:
    line = _specs_line(specs)
    return f"Danke! Dokument erhalten: {line}" if lang == "de" else f"Thanks! Document received: {line}"


async def _on_qualified(lead_id: str, name: str, phone: str, state: Dict) -> None:
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    summ = flow.summary(state)
    lbl = (state.get("label") or "COLD").capitalize()
    reason = flow.label_reason(state)
    qa = flow.qualification_qa(state)
    intent_col = f"{state['intent']}_INTENT" if state.get("intent") in ("BUY", "SELL") else "UNKNOWN"
    store.update_lead(
        lead_id,
        {"intent": intent_col, "status": "QUALIFIED" if state["label"] in ("HOT", "WARM") else "NEW",
         "notes": f"WhatsApp qualification: {summ}"},
        optional={
            "qualification_stage": "qualified",
            "is_qualified": state["label"] in ("HOT", "WARM"),
            "lead_label": state["label"],
            "label": lbl,
            "label_reason": reason,
            "qualification_answers": qa,
            "founder_alerted_at": now_iso,
        },
    )
    await notify_owner(f"{summ}\n👤 {name}\n📞 +{phone}")


async def _after_done(phone: str, name: str, lead_id: str, inp: Dict) -> None:
    if inp["type"] in ("image", "document"):
        specs = await _specs_from_media(inp)
        if specs:
            store.update_lead(lead_id, _specs_to_lead_fields(specs))
            await send_message(phone, _ack_document("de", specs))
            await notify_owner(f"📄 {name} (+{phone}) sent a document: {_specs_line(specs)}")
            return
        else:
            await send_message(phone, "Danke! Wir haben Ihre Datei erhalten.")
            await notify_owner(f"📎 {name} (+{phone}) sent a {inp['type']} (could not be read automatically).")
            return

    # Acknowledge customer so they know their message reached the team
    await send_message(
        phone,
        "Vielen Dank für Ihre Nachricht! Unser Team hat Ihre Nachricht erhalten und meldet sich schnellstmöglich persönlich bei Ihnen."
    )
    await notify_owner(f"💬 {name} (+{phone}): {inp['text'] or '[' + inp['type'] + ']'}")
