"""
test_whatsapp.py - offline tests for the WhatsApp channel (no Meta, no Supabase).

Run:  cd backend && python -m pytest test_whatsapp.py -q
  or: cd backend && python test_whatsapp.py
"""
import asyncio
import hashlib
import hmac
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from app.services import whatsapp_flow as flow
from app.services import whatsapp_handler as handler
from app.services import whatsapp_service as wa
from app.services import whatsapp_store as store

OWNER = "491700000001"
CUSTOMER = "491700000002"


def setup_module(_=None):
    settings.WHATSAPP_DRY_RUN = True
    settings.WHATSAPP_OWNER_PHONES = OWNER
    settings.WHATSAPP_APP_SECRET = ""
    store.MEMORY = True
    reset()


def reset():
    store.reset_memory()
    wa.OUTBOX.clear()


def text_msg(sender, body, mid):
    return {"id": mid, "from": sender, "type": "text", "text": {"body": body}}


def button_msg(sender, bid, title, mid):
    return {"id": mid, "from": sender, "type": "interactive",
            "interactive": {"type": "button_reply", "button_reply": {"id": bid, "title": title}}}


def run(coro):
    return asyncio.run(coro)


def sent_to(phone):
    return [m for m in wa.OUTBOX if m["to"] == phone]


def body_of(m):
    if m["type"] == "text":
        return m["text"]["body"]
    return m["interactive"]["body"]["text"]


# ─── Pure flow ────────────────────────────────────────────────────────────

def test_language_and_intent_detection():
    assert flow.detect_language("Hallo, ich möchte ein Auto kaufen") == "de"
    assert flow.detect_language("Hello, I want to buy a car") == "en"
    assert flow.detect_intent("Ich suche einen Audi A6") == "BUY"
    assert flow.detect_intent("Ich möchte mein Auto verkaufen") == "SELL"
    assert flow.detect_intent("Hallo") is None


def test_scoring_table():
    def buy(**a):
        return {"intent": "BUY", "answers": a}
    assert flow.score(buy(buy_urgency="urgent")) == "HOT"
    assert flow.score(buy(buy_urgency="soon", buy_timeline="month", buy_budget="b50")) == "HOT"
    assert flow.score(buy(buy_urgency="soon", buy_timeline="quarter", buy_budget="b50")) == "WARM"
    assert flow.score(buy(buy_urgency="soon", buy_timeline="week", buy_budget="bnone")) == "WARM"
    assert flow.score(buy(buy_urgency="looking")) == "COLD"
    assert flow.score({"intent": "SELL", "answers": {"sell_urgency": "quick"}}) == "HOT"
    assert flow.score({"intent": "SELL", "answers": {"sell_urgency": "valuation"}}) == "COLD"
    assert flow.score({"intent": "OTHER", "answers": {}}) == "COLD"


def test_buy_flow_hot_via_numbers():
    s = flow.new_state("Hallo, ich suche einen BMW")
    assert s["step"] == flow.STEP_BUY_URGENCY
    s, p = flow.handle_input(s, text="2")   # buy soon
    assert s["step"] == flow.STEP_BUY_TIMELINE
    s, p = flow.handle_input(s, reply_id="week")
    s, p = flow.handle_input(s, reply_id="b50")
    assert s["done"] and s["label"] == "HOT"
    assert len(p["buttons"] or []) == 0


def test_invalid_answer_repeats_question():
    s = flow.new_state("Ich möchte kaufen")
    s2, p = flow.handle_input(s, text="keine ahnung")
    assert s2["step"] == flow.STEP_BUY_URGENCY and p["buttons"]


def test_sell_flow_free_text():
    s = flow.new_state("I want to sell my car")
    s, _ = flow.handle_input(s, reply_id="quick")
    assert s["step"] == flow.STEP_SELL_VEHICLE
    s, _ = flow.handle_input(s, text="Audi A4 2019")
    s, _ = flow.handle_input(s, text="18000")
    assert s["done"] and s["label"] == "HOT" and s["answers"]["vehicle"] == "Audi A4 2019"


# ─── Whole channel ────────────────────────────────────────────────────────

def test_customer_qualification_and_owner_alert():
    reset()
    run(handler.handle_message(text_msg(CUSTOMER, "Hallo, ich suche einen Audi RS6", "m1"), "Max Muster"))
    first = sent_to(CUSTOMER)[-1]
    assert first["type"] == "interactive" and "speichern" in body_of(first)     # consent line
    run(handler.handle_message(button_msg(CUSTOMER, "urgent", "Dringend", "m2")))
    run(handler.handle_message(button_msg(CUSTOMER, "week", "Diese Woche", "m3")))
    run(handler.handle_message(button_msg(CUSTOMER, "b50", "20.000-50.000 EUR", "m4")))

    alert = sent_to(OWNER)[-1]
    assert "HOT" in body_of(alert) and "Max Muster" in body_of(alert)
    lead = store.find_lead_by_phone(CUSTOMER)
    assert lead["channel"] == "WHATSAPP" and lead["intent"] == "BUY_INTENT" and lead["lead_label"] == "HOT"
    assert lead["label"] == "Hot" and len(lead["qualification_answers"]) >= 3 and lead["label_reason"]


def test_duplicate_webhook_delivery_is_ignored():
    reset()
    m = text_msg(CUSTOMER, "Ich möchte kaufen", "dup1")
    run(handler.handle_message(m, "A")); n = len(wa.OUTBOX)
    run(handler.handle_message(m, "A"))
    assert len(wa.OUTBOX) == n


def test_owner_commands_and_security():
    reset()
    store._mem_projects.append({"client_name": "Müller", "target_vehicle": "Audi RS6", "current_stage": "Intake & Onboarding", "status": "ACTIVE"})
    run(handler.handle_message(text_msg(OWNER, "deals", "o1")))
    assert "Müller" in body_of(sent_to(OWNER)[-1])
    run(handler.handle_message(text_msg(OWNER, "help", "o2")))
    assert "commands" in body_of(sent_to(OWNER)[-1])
    # A customer typing "deals" must NOT receive CRM data - they are treated as a lead
    run(handler.handle_message(text_msg(CUSTOMER, "deals", "c1"), "Eve"))
    assert all("Müller" not in body_of(m) for m in sent_to(CUSTOMER))


def test_document_ocr_fills_lead_and_answers_vehicle_question():
    reset()

    async def fake_ocr(data, mime):
        return {"manufacturer": "BMW", "model": "320i", "vin": "WBA12345678901234", "licence_plate": "IN-AB 123"}

    async def fake_download(media_id):
        return b"x", "image/jpeg"

    handler.ocr_extract, handler.download_media = fake_ocr, fake_download
    run(handler.handle_message(text_msg(CUSTOMER, "Ich möchte mein Auto verkaufen", "d1"), "Anna"))
    run(handler.handle_message(button_msg(CUSTOMER, "quick", "Schnell verkaufen", "d2")))
    run(handler.handle_message({"id": "d3", "from": CUSTOMER, "type": "image", "image": {"id": "MEDIA1", "mime_type": "image/jpeg"}}))
    lead = store.find_lead_by_phone(CUSTOMER)
    assert lead["manufacturer"] == "BMW" and lead["vin"] == "WBA12345678901234"
    assert "Preisvorstellung" in body_of(sent_to(CUSTOMER)[-1])    # moved on to the price question


# ─── Transport security ───────────────────────────────────────────────────

def test_signature_verification():
    body = b'{"x":1}'
    settings.WHATSAPP_APP_SECRET = "s3cret"
    try:
        good = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
        assert wa.verify_signature(body, good)
        assert not wa.verify_signature(body, "sha256=deadbeef")
        assert not wa.verify_signature(body, None)
    finally:
        settings.WHATSAPP_APP_SECRET = ""


if __name__ == "__main__":
    setup_module()
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    for name, fn in tests:
        fn()
        print(f"PASS {name}")
    print(f"\n{len(tests)} tests passed")
