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


_OWNER_CMDS = {"help", "/help", "leads", "anfragen", "deals", "projekte", "projects", "summary", "zusammenfassung", "status", "reset", "/reset", "customer", "kunde", "find"}


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
        # Allow owner to test customer qualification on the same phone when not running a founder command
        if not _is_owner_command(text) and (
            in_active_flow
            or flow.detect_intent(text) in ("BUY", "SELL")
            or text.lower() in ("hi", "hallo", "hello", "test")
        ):
            await handle_customer(phone, profile_name or "WhatsApp Client", inp)
            return
        await handle_owner(phone, inp)
    else:
        await handle_customer(phone, profile_name or "WhatsApp Client", inp)


# ─── OCR (reuses the existing document pipeline) ──────────────────────────

async def ocr_extract(data: bytes, mime: str) -> Dict:
    """Bytes -> vehicle specs dict. Separate function so tests can replace it."""
    from app.services.pdf_service import extract_document_text
    from app.services.claude_service import extract_vehicle_specs

    suffix = _MIME_SUFFIX.get(mime, ".jpg")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        text = await asyncio.to_thread(extract_document_text, path)
        return await extract_vehicle_specs(text) if text.strip() else {}
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
    "CAR-AGENTS assistant - commands:\n"
    "• leads - latest leads with quality label\n"
    "• deals - active deals and stages\n"
    "• summary - quick overview\n"
    "• customer <name> - find a customer/lead/deal\n"
    "• reset - restart customer qualification test\n"
    "• Send a photo or PDF of a vehicle document - I read it for you\n"
    "• help - this list"
)


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
    return (f"Summary:\n• New leads: {new_leads}\n• Hot leads: {hot}\n• Active deals: {len(projects)}\n{stage_txt}")


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
            await send_message(phone, "I could not read that document. Please send a clear photo or PDF.")
            return
        miss = _missing_basics(specs)
        await send_message(phone, f"📄 {_specs_line(specs)}" + (f"\nMissing: {', '.join(miss)}" if miss else "\nAll key fields found ✅"))
        return

    text = (await _owner_text(inp) or "").strip()
    low = text.lower()
    cmd, _, arg = low.partition(" ")

    if cmd in ("reset", "/reset"):
        store.delete_session(phone)
        reply = "🔄 Session reset! Send a customer message (e.g. 'Hallo, ich möchte ein Auto kaufen') to test lead qualification, or 'help' for founder commands."
    elif cmd in ("leads", "anfragen"):
        reply = format_leads(store.list_leads(10))
    elif cmd in ("deals", "projekte", "projects"):
        reply = format_deals(store.list_active_projects())
    elif cmd in ("summary", "zusammenfassung", "status"):
        reply = format_summary(store.list_leads(200), store.list_active_projects(100))
    elif cmd in ("customer", "kunde", "find") and arg.strip():
        found = store.search_leads_and_projects(arg.strip())
        reply = "\n\n".join(x for x in (
            format_leads(found["leads"]) if found["leads"] else "",
            format_deals(found["projects"]) if found["projects"] else "") if x) or f"Nothing found for '{arg.strip()}'."
    else:
        reply = HELP_TEXT
    await send_message(phone, reply)


async def notify_owner(text: str) -> None:
    for p in owner_phones():
        await send_whatsapp_message(p, text)


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
            await notify_owner(f"📄 {name} (+{phone}) sent a document: {_specs_line(specs)}")
            return
    await notify_owner(f"💬 {name} (+{phone}): {inp['text'] or '[' + inp['type'] + ']'}")
