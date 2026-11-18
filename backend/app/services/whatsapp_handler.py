"""
app/services/whatsapp_handler.py
────────────────────────────────────────────────────────────────────────
Brain of the WhatsApp channel. The webhook hands every incoming message here.

  Founder (number in WHATSAPP_OWNER_PHONES)  -> Founder Cockpit (whatsapp_owner.py)
  Anyone else (customer)                    -> lead capture + fixed
        qualification questions (whatsapp_flow.py) + customer doc upload
────────────────────────────────────────────────────────────────────────
"""
import asyncio
import logging
import re
from typing import Dict, List, Optional

from config import settings
from app.services import document_service as docs
from app.services import whatsapp_flow as flow
from app.services import whatsapp_owner as owner
from app.services import whatsapp_store as store
from app.services.whatsapp_owner import format_deals, format_leads, format_summary
from app.services.whatsapp_service import (
    download_media,
    normalize_phone,
    send_message,
    send_whatsapp_message,
)

logger = logging.getLogger("whatsapp_handler")

_MIME_SUFFIX = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/amr": ".amr",
}


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
            for msg in value.get("messages", []):
                try:
                    await handle_message(msg, contacts.get(msg.get("from")))
                except Exception:
                    logger.exception("Error handling WhatsApp message")


def _extract_input(msg: Dict) -> Dict:
    """Normalise Meta / Twilio message shapes into one dict."""
    mtype = msg.get("type")
    out = {"type": mtype, "text": None, "reply_id": None, "media_id": None, "mime": None, "filename": None}
    if mtype == "text":
        out["text"] = msg.get("text", {}).get("body", "")
    elif mtype == "interactive":
        inter = msg.get("interactive", {})
        rep = inter.get("button_reply") or inter.get("list_reply") or {}
        out["reply_id"], out["text"] = rep.get("id"), rep.get("title")
    elif mtype == "button":
        out["reply_id"], out["text"] = msg.get("button", {}).get("payload"), msg.get("button", {}).get("text")
    elif mtype in ("image", "document", "audio"):
        media = msg.get(mtype, {})
        out["media_id"], out["mime"] = media.get("id"), media.get("mime_type")
        out["text"] = media.get("caption")
        out["filename"] = media.get("filename")
    return out


async def handle_twilio_payload(form: Dict) -> None:
    """Convert Twilio's form-encoded WhatsApp webhook (incl. Content button taps) into standard msg dict."""
    sid = form.get("MessageSid") or form.get("SmsMessageSid")
    from_raw = form.get("From", "")
    profile_name = form.get("ProfileName") or "WhatsApp Client"
    body = form.get("Body", "")
    num_media = int(form.get("NumMedia", "0") or 0)
    btn_payload = (form.get("ButtonPayload") or form.get("ListId") or "").strip()

    if num_media > 0 and form.get("MediaUrl0"):
        mime = form.get("MediaContentType0", "image/jpeg")
        mtype = "image" if mime.startswith("image/") else "audio" if mime.startswith("audio/") else "document"
        msg = {
            "id": sid,
            "from": from_raw,
            "type": mtype,
            mtype: {"id": form["MediaUrl0"], "mime_type": mime, "caption": body},
        }
    elif btn_payload:
        msg = {
            "id": sid,
            "from": from_raw,
            "type": "interactive",
            "interactive": {"type": "button_reply", "button_reply": {"id": btn_payload, "title": body or btn_payload}},
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


async def _resolve_audio_text(inp: Dict) -> Optional[str]:
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
    return inp.get("text")


async def handle_message(msg: Dict, profile_name: Optional[str] = None) -> None:
    if store.already_processed(msg.get("id")):
        return
    phone = normalize_phone(msg.get("from"))
    inp = _extract_input(msg)

    if phone in owner_phones():
        text = ((await _resolve_audio_text(inp)) or inp.get("text") or "").strip()
        btn_id = (inp.get("reply_id") or "").strip()
        session = store.get_session(phone)
        mode = (session or {}).get("mode", "qualify")

        in_qualify_flow = session is not None and mode == "qualify" and not session.get("done")
        in_owner_wizard = session is not None and mode.startswith("owner_") and mode != "owner_help"

        # 1. Active founder multi-step wizard (schedule / upload / scan / disambig)
        if in_owner_wizard and not owner.is_explicit_exit(text):
            await owner.handle_owner(phone, inp, text)
            return

        # 2. Active qualification test on founder phone (keep numbers '1','2','3' inside funnel)
        if in_qualify_flow and not owner.is_explicit_exit(text):
            await handle_customer(phone, profile_name or "WhatsApp Client", inp)
            return

        # 3. Starting a new qualification test from founder phone
        if not owner.is_owner_command(text) and not btn_id and (
            flow.detect_intent(text) in ("BUY", "SELL")
            or text.lower() in ("hi", "hallo", "hello", "test")
        ):
            if mode.startswith("owner_"):
                store.delete_session(phone)
            await handle_customer(phone, profile_name or "WhatsApp Client", inp)
            return

        await owner.handle_owner(phone, inp, text)
    else:
        await handle_customer(phone, profile_name or "WhatsApp Client", inp)


# ─── OCR helper (kept here so tests can monkeypatch handler.ocr_extract) ──

async def ocr_extract(data: bytes, mime: str) -> Dict:
    return await docs.scan_document(data, mime, doc_kind="vehicle")


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
        "manufacturer": "manufacturer",
        "model": "model",
        "vin": "vin",
        "licence_plate": "license_plate",
        "initial_registration": "initial_registration",
        "mileage": "mileage",
        "power_ps": "power_ps",
        "displacement_ccm": "displacement_ccm",
        "tuv_expiry": "tuev_until",
    }
    return {col: str(specs[k]) for k, col in mapping.items() if specs.get(k) is not None}


def _specs_line(specs: Dict) -> str:
    name = " ".join(str(specs[k]) for k in ("manufacturer", "model") if specs.get(k)) or "Vehicle document"
    extras = [f"VIN {specs['vin']}"] if specs.get("vin") else []
    if specs.get("licence_plate"):
        extras.append(str(specs["licence_plate"]))
    return name + (f" ({', '.join(extras)})" if extras else "")


async def notify_owner(text: str) -> None:
    """Push plain-text alert to configured founder numbers (never attaches footer menus)."""
    for p in owner_phones():
        await send_whatsapp_message(p, text)


# ─── Customer side ────────────────────────────────────────────────────────

async def handle_customer(phone: str, name: str, inp: Dict) -> None:
    lead = store.find_lead_by_phone(phone)
    state = store.get_session(phone)
    # Ignore any owner_* session if starting/continuing customer flow
    if state is not None and state.get("mode", "qualify") != "qualify":
        state = None

    first_contact = state is None
    if first_contact:
        state = flow.new_state(inp["text"] or "")
        state["mode"] = "qualify"

    if not lead:
        lead = store.create_lead({
            "name": name,
            "phone": phone,
            "channel": "WHATSAPP",
            "intent": f"{state['intent']}_INTENT" if state["intent"] in ("BUY", "SELL") else "UNKNOWN",
            "status": "NEW",
            "message": inp["text"] or f"[{inp['type']}]",
        })
    lead_id = lead.get("id")
    name = lead.get("name") or name

    store.save_communication({
        "lead_id": lead_id,
        "channel": "WHATSAPP",
        "sender_name": name,
        "sender_contact": phone,
        "subject": "Inbound WhatsApp Message",
        "body": inp["text"] or f"[{inp['type']}]",
        "is_inbound": True,
    })

    # Customer already qualified: store uploaded documents (no OCR) & notify founder cleanly.
    if state.get("done"):
        await _after_done(phone, name, lead_id, inp, lang=state.get("lang", "de"))
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
        reply = flow.prompt(state, first_contact=True)
    else:
        state, reply = flow.handle_input(state, inp["reply_id"], inp["text"])

    if state.get("done"):
        await _on_qualified(lead_id, name, phone, state)

    state.setdefault("mode", "qualify")
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
        {
            "intent": intent_col,
            "status": "QUALIFIED" if state["label"] in ("HOT", "WARM") else "NEW",
            "notes": f"WhatsApp qualification: {summ}",
        },
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


async def _after_done(phone: str, name: str, lead_id: Optional[str], inp: Dict, lang: str = "de") -> None:
    if inp["type"] in ("image", "document") and inp.get("media_id"):
        media = await download_media(inp["media_id"])
        if media:
            data, mime = media
            row = await docs.store_uploaded_document(
                file_bytes=data,
                filename=inp.get("filename"),
                mime_type=inp.get("mime") or mime,
                customer={"name": name, "phone": phone, "lead_id": lead_id},
                category="other",
                source="WHATSAPP_CUSTOMER",
            )
            ack = "Vielen Dank! Wir haben Ihr Dokument sicher gespeichert." if lang == "de" else "Thank you! We safely stored your document."
            await send_message(phone, ack)
            link_line = f"\n🔗 {row['file_url']}" if row.get("file_url") else ""
            await notify_owner(f"📎 Document uploaded by {name} (+{phone}): {row.get('filename')}{link_line}")
            return
        ack = "Danke! Wir haben Ihre Datei erhalten." if lang == "de" else "Thanks! We received your file."
        await send_message(phone, ack)
        await notify_owner(f"📎 {name} (+{phone}) sent a {inp['type']}.")
        return

    ack = (
        "Vielen Dank für Ihre Nachricht! Unser Team hat Ihre Nachricht erhalten und meldet sich schnellstmöglich persönlich bei Ihnen."
        if lang == "de"
        else "Thank you for your message! Our team received it and will get back to you personally shortly."
    )
    await send_message(phone, ack)
    await notify_owner(f"💬 {name} (+{phone}): {inp['text'] or '[' + inp['type'] + ']'}")
