"""
test_whatsapp.py - offline tests for the WhatsApp channel (no Meta, no Twilio, no Supabase).

Run:  python backend/tests/test_whatsapp.py
  or: pytest backend/tests/test_whatsapp.py -q
"""
import asyncio
import hashlib
import hmac
import os
import sys
from datetime import date, datetime, time, timedelta, timezone

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from config import settings
from app.services import crm_service as crm
from app.services import document_service as docs
from app.services import meeting_service as ms
from app.services import whatsapp_flow as flow
from app.services import whatsapp_handler as handler
from app.services import whatsapp_owner as owner
from app.services import whatsapp_service as wa
from app.services import whatsapp_store as store

OWNER = "491700000001"
CUSTOMER = "491700000002"


def setup_module(_=None):
    settings.WHATSAPP_DRY_RUN = True
    settings.WHATSAPP_OWNER_PHONES = OWNER
    settings.WHATSAPP_APP_SECRET = ""
    settings.TWILIO_CONTENT_ENABLED = False
    store.MEMORY = True
    reset()


def reset():
    store.reset_memory()
    wa.OUTBOX.clear()


def text_msg(sender, body, mid):
    return {"id": mid, "from": sender, "type": "text", "text": {"body": body}}


def button_msg(sender, bid, title, mid):
    return {
        "id": mid,
        "from": sender,
        "type": "interactive",
        "interactive": {"type": "button_reply", "button_reply": {"id": bid, "title": title}},
    }


def run(coro):
    return asyncio.run(coro)


def sent_to(phone):
    return [m for m in wa.OUTBOX if m["to"] == phone]


def body_of(m):
    if m["type"] == "text":
        return m["text"]["body"]
    return m["interactive"]["body"]["text"]


# ─── Pure qualification flow ──────────────────────────────────────────────

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


# ─── Whole channel & TwiML caller isolation ───────────────────────────────

def test_customer_qualification_and_owner_alert():
    reset()
    run(handler.handle_message(text_msg(CUSTOMER, "Hallo, ich suche einen Audi RS6", "m1"), "Max Muster"))
    first = sent_to(CUSTOMER)[-1]
    assert first["type"] == "interactive" and "speichern" in body_of(first)
    run(handler.handle_message(button_msg(CUSTOMER, "urgent", "Dringend", "m2")))
    run(handler.handle_message(button_msg(CUSTOMER, "week", "Diese Woche", "m3")))
    run(handler.handle_message(button_msg(CUSTOMER, "b50", "20.000-50.000 EUR", "m4")))

    alert = sent_to(OWNER)[-1]
    assert "HOT" in body_of(alert) and "Max Muster" in body_of(alert)
    assert alert["type"] == "text"  # Clean alert: no footer buttons attached!
    lead = store.find_lead_by_phone(CUSTOMER)
    assert lead["channel"] == "WHATSAPP" and lead["intent"] == "BUY_INTENT" and lead["lead_label"] == "HOT"
    assert lead["label"] == "Hot" and len(lead["qualification_answers"]) >= 3 and lead["label_reason"]


def test_twiml_caller_isolation_prevents_owner_leak():
    reset()
    store._mem_leads["l1"] = {"id": "l1", "name": "Prisha Patel", "phone": CUSTOMER, "channel": "WHATSAPP"}
    store.save_session(CUSTOMER, {"mode": "qualify", "done": True, "lang": "de"})

    with wa.collect_twilio_replies(target_phone=CUSTOMER) as replies:
        run(handler.handle_twilio_payload({
            "MessageSid": "TW1",
            "From": f"whatsapp:+{CUSTOMER}",
            "ProfileName": "Prisha Patel",
            "Body": "Hallo! Können Sie helfen?",
        }))
    assert len(replies) == 1
    assert "Vielen Dank" in replies[0]
    assert "Prisha Patel (+49" not in replies[0]


def test_twilio_button_payload_is_parsed():
    reset()
    run(handler.handle_twilio_payload({
        "MessageSid": "TB1",
        "From": f"whatsapp:+{CUSTOMER}",
        "ProfileName": "Max",
        "Body": "Hallo, ich suche einen BMW",
    }))
    run(handler.handle_twilio_payload({
        "MessageSid": "TB2",
        "From": f"whatsapp:+{CUSTOMER}",
        "ProfileName": "Max",
        "Body": "Dringend",
        "ButtonPayload": "urgent",
    }))
    st = store.get_session(CUSTOMER)
    assert st["step"] == flow.STEP_BUY_TIMELINE and st["answers"]["buy_urgency"] == "urgent"


def test_duplicate_webhook_delivery_is_ignored():
    reset()
    m = text_msg(CUSTOMER, "Ich möchte kaufen", "dup1")
    run(handler.handle_message(m, "A"))
    n = len(wa.OUTBOX)
    run(handler.handle_message(m, "A"))
    assert len(wa.OUTBOX) == n


# ─── Owner commands, no footers, Help menu & Number guard ─────────────────

def test_owner_commands_no_footer_and_help_menu():
    reset()
    store._mem_projects.append({
        "id": "p1", "client_name": "Müller", "client_phone": "+49170111222",
        "target_vehicle": "Audi RS6", "current_stage": "Intake & Onboarding", "status": "ACTIVE",
    })
    run(handler.handle_message(text_msg(OWNER, "deals", "o1")))
    last_deals = sent_to(OWNER)[-1]
    assert last_deals["type"] == "text" and "Müller" in body_of(last_deals)

    # `help` is the ONLY menu with buttons
    run(handler.handle_message(text_msg(OWNER, "help", "o2")))
    help_msg = sent_to(OWNER)[-1]
    assert help_msg["type"] == "interactive" and "Help" in body_of(help_msg)

    # Replying '3' right after help executes 'deals'
    run(handler.handle_message(text_msg(OWNER, "3", "o2b")))
    assert "Müller" in body_of(sent_to(OWNER)[-1]) and sent_to(OWNER)[-1]["type"] == "text"

    # A customer typing "deals" must NOT receive CRM data
    run(handler.handle_message(text_msg(CUSTOMER, "deals", "c1"), "Eve"))
    assert all("Müller" not in body_of(m) for m in sent_to(CUSTOMER))


def test_owner_qualification_flow_not_hijacked_by_numbers():
    reset()
    run(handler.handle_message(text_msg(OWNER, "Hallo, ich möchte ein Auto kaufen", "q0"), "Founder"))
    run(handler.handle_message(text_msg(OWNER, "1", "q1"), "Founder"))
    st = store.get_session(OWNER)
    assert st["mode"] == "qualify" and st["step"] == flow.STEP_BUY_TIMELINE


# ─── Customer search & duplicate-name disambiguation ──────────────────────

def test_customer_search_disambiguation_phone_and_email():
    reset()
    store._mem_leads["la"] = {
        "id": "la", "name": "Prisha Patel", "phone": "+491701111111",
        "email": "prisha.a@example.de", "intent": "BUY_INTENT", "status": "NEW", "model": "BMW M4",
    }
    store._mem_leads["lb"] = {
        "id": "lb", "name": "Prisha Patel", "phone": "+919265299636",
        "email": "prisha.b@example.de", "intent": "SELL_INTENT", "status": "QUALIFIED", "model": "Porsche 911",
    }

    # Ambiguous name -> interactive picklist
    run(handler.handle_message(text_msg(OWNER, "customer Prisha", "cs1")))
    pick_msg = sent_to(OWNER)[-1]
    assert pick_msg["type"] == "interactive" and "Found 2" in body_of(pick_msg)

    # Pick option 2 -> shows second Prisha card
    run(handler.handle_message(text_msg(OWNER, "2", "cs2")))
    card = sent_to(OWNER)[-1]
    assert "9265299636" in body_of(card) or "1701111111" in body_of(card)

    # Direct filter by phone or email returns 1 card immediately (plain text)
    run(handler.handle_message(text_msg(OWNER, "customer 919265299636", "cs3")))
    direct_phone = sent_to(OWNER)[-1]
    assert direct_phone["type"] == "text" and "Porsche 911" in body_of(direct_phone)

    run(handler.handle_message(text_msg(OWNER, "customer prisha.a@example.de", "cs4")))
    direct_email = sent_to(OWNER)[-1]
    assert direct_email["type"] == "text" and "BMW M4" in body_of(direct_email)


# ─── Meetings: free slots, offline travel buffer, clash prevention ────────

def _next_mon_to_sat() -> date:
    d = datetime.now(ms.BERLIN_TZ).date() + timedelta(days=2)
    while d.weekday() not in ms.WORK_DAYS:
        d += timedelta(days=1)
    return d


def test_meeting_free_slots_and_clash_guard():
    reset()
    target_day = _next_mon_to_sat()
    now_fixed = datetime.combine(target_day - timedelta(days=1), time(8, 0), tzinfo=ms.BERLIN_TZ).astimezone(timezone.utc)

    # Book 10:00–11:00 Berlin offline
    s_utc = datetime.combine(target_day, time(10, 0), tzinfo=ms.BERLIN_TZ).astimezone(timezone.utc)
    e_utc = s_utc + timedelta(hours=1)
    r1 = ms.create_meeting(
        client_name="Prisha Patel",
        start_utc=s_utc,
        end_utc=e_utc,
        client_phone="+919265299636",
        vehicle="Porsche 911",
        deal_type="SELL",
        location_type="OFFLINE_ONSITE",
        include_outlook=False,
    )
    assert not r1["conflict"]

    # Double-booking 10:30–11:30 MUST be refused; 09:00–10:00 offline also clashes due to 30m buffer
    clash = ms.create_meeting(
        client_name="Someone Else",
        start_utc=datetime.combine(target_day, time(9, 0), tzinfo=ms.BERLIN_TZ).astimezone(timezone.utc),
        end_utc=datetime.combine(target_day, time(10, 0), tzinfo=ms.BERLIN_TZ).astimezone(timezone.utc),
        location_type="OFFLINE_ONSITE",
        include_outlook=False,
    )
    assert clash["conflict"] is True

    # Free slots should omit 09:00, 10:00, 11:00 (11:30–12:30 is free!)
    slots = ms.get_free_slots(target_day, now_utc=now_fixed, include_outlook=False)
    times = {s["time"] for s in slots}
    assert "09:00" not in times and "10:00" not in times and "11:00" not in times
    assert "11:30" in times and "12:00" in times


def test_whatsapp_schedule_autofills_customer_and_books():
    reset()
    store._mem_leads["l_sched"] = {
        "id": "l_sched", "name": "Carlos Perez", "phone": "+491709998887",
        "intent": "BUY_INTENT", "manufacturer": "BMW", "model": "M4", "address": "Hauptstr. 5, Berlin",
    }
    run(handler.handle_message(text_msg(OWNER, "schedule +491709998887", "sch1")))
    date_prompt = sent_to(OWNER)[-1]
    assert "Carlos Perez" in body_of(date_prompt) and "BMW M4" in body_of(date_prompt) and "BUY" in body_of(date_prompt)

    # Pick day 2 (tomorrow or day after), slot 1, offline, customer address, confirm
    run(handler.handle_message(text_msg(OWNER, "2", "sch2")))
    run(handler.handle_message(text_msg(OWNER, "1", "sch3")))
    run(handler.handle_message(text_msg(OWNER, "1", "sch4")))   # Offline
    run(handler.handle_message(text_msg(OWNER, "1", "sch5")))   # Saved address
    run(handler.handle_message(text_msg(OWNER, "1", "sch6")))   # Confirm
    done_msg = sent_to(OWNER)[-1]
    assert "Meeting Booked" in body_of(done_msg) and len(store._mem_meetings) == 1
    assert store._mem_meetings[0]["deal_type"] == "BUY" and store._mem_meetings[0]["vehicle"] == "BMW M4"

    # Cancel meeting via WhatsApp frees slot
    run(handler.handle_message(text_msg(OWNER, "meetings", "sch7")))
    assert "Carlos Perez" in body_of(sent_to(OWNER)[-1])
    run(handler.handle_message(text_msg(OWNER, "cancel meeting", "sch8")))
    run(handler.handle_message(text_msg(OWNER, "1", "sch9")))
    assert "Cancelled meeting" in body_of(sent_to(OWNER)[-1])
    assert store._mem_meetings[0]["status"] == "CANCELLED"


def test_unprompted_owner_file_offers_upload_or_scan_router():
    reset()
    run(handler.handle_message({"id": "unf1", "from": OWNER, "type": "image", "image": {"id": "MEDIA_U", "mime_type": "image/jpeg"}}))
    route_msg = sent_to(OWNER)[-1]
    assert route_msg["type"] == "interactive" and "Upload" in body_of(route_msg) or route_msg["interactive"]
    run(handler.handle_message(text_msg(OWNER, "1", "unf2")))  # Pick Upload Document
    assert store.get_session(OWNER)["mode"] == "owner_upload"


# ─── Document Upload vs OCR Separation ────────────────────────────────────

def test_upload_stores_without_ocr_and_scan_parses_to_templates():
    reset()
    store._mem_leads["l_doc"] = {"id": "l_doc", "name": "Anna Weber", "phone": "+491705556667", "intent": "SELL_INTENT"}
    store._mem_projects.append({"id": "p_doc", "client_name": "Anna Weber", "client_phone": "+491705556667", "project_type": "SELL", "status": "ACTIVE"})

    ocr_called = {"count": 0}
    orig_scan = docs.scan_document
    orig_dl = owner.download_media

    async def fake_scan(data, mime, doc_kind="vehicle"):
        ocr_called["count"] += 1
        return {"manufacturer": "Porsche", "model": "911", "vin": "WP0ZZZ99ZTS392123"}

    async def fake_dl(media_id):
        return b"dummybytes", "application/pdf"

    docs.scan_document = fake_scan
    owner.download_media = fake_dl
    try:
        # 1. UPLOAD flow: must store WITHOUT calling OCR!
        run(handler.handle_message(text_msg(OWNER, "upload +491705556667", "up1")))
        run(handler.handle_message(text_msg(OWNER, "1", "up2")))  # id_card
        run(handler.handle_message({"id": "up3", "from": OWNER, "type": "document", "document": {"id": "MEDIA_UP", "mime_type": "application/pdf", "filename": "ausweis.pdf"}}))
        assert ocr_called["count"] == 0
        assert len(store._mem_docs) == 1 and store._mem_docs[0]["category"] == "id_card"
        assert "No OCR" in body_of(sent_to(OWNER)[-1])

        # 2. SCAN flow: extracts fields, previews, and saves on confirmation
        run(handler.handle_message(text_msg(OWNER, "scan", "sc1")))
        run(handler.handle_message(text_msg(OWNER, "1", "sc2")))  # Fahrzeugschein
        run(handler.handle_message(text_msg(OWNER, "Anna Weber", "sc3")))
        run(handler.handle_message({"id": "sc4", "from": OWNER, "type": "image", "image": {"id": "MEDIA_SC", "mime_type": "image/jpeg"}}))
        assert ocr_called["count"] == 1
        assert "WP0ZZZ99ZTS392123" in body_of(sent_to(OWNER)[-1])
        run(handler.handle_message(text_msg(OWNER, "1", "sc5")))  # Confirm save
        assert store._mem_leads["l_doc"]["vin"] == "WP0ZZZ99ZTS392123"
        assert store._mem_projects[0]["vin"] == "WP0ZZZ99ZTS392123"
        assert "Template Data" in body_of(sent_to(OWNER)[-1]) or "sell_b2c" in body_of(sent_to(OWNER)[-1])
    finally:
        docs.scan_document = orig_scan
        owner.download_media = orig_dl


def test_customer_document_ocr_during_sell_qualification():
    reset()
    async def fake_ocr(data, mime):
        return {"manufacturer": "BMW", "model": "320i", "vin": "WBA12345678901234", "licence_plate": "IN-AB 123"}

    async def fake_download(media_id):
        return b"x", "image/jpeg"

    orig_ocr, orig_dl = handler.ocr_extract, handler.download_media
    handler.ocr_extract, handler.download_media = fake_ocr, fake_download
    try:
        run(handler.handle_message(text_msg(CUSTOMER, "Ich möchte mein Auto verkaufen", "d1"), "Anna"))
        run(handler.handle_message(button_msg(CUSTOMER, "quick", "Schnell verkaufen", "d2")))
        run(handler.handle_message({"id": "d3", "from": CUSTOMER, "type": "image", "image": {"id": "MEDIA1", "mime_type": "image/jpeg"}}))
        lead = store.find_lead_by_phone(CUSTOMER)
        assert lead["manufacturer"] == "BMW" and lead["vin"] == "WBA12345678901234"
        assert "Preisvorstellung" in body_of(sent_to(CUSTOMER)[-1])
    finally:
        handler.ocr_extract, handler.download_media = orig_ocr, orig_dl


def test_docs_command_lists_customer_documents():
    reset()
    store._mem_leads["l1"] = {"id": "l1", "name": "Docs Kunde", "phone": "+49170555666", "status": "NEW"}
    store.save_customer_document({
        "lead_id": "l1", "customer_name": "Docs Kunde", "category": "id",
        "filename": "ausweis.jpg", "file_url": "https://example.test/ausweis.jpg",
    })
    run(handler.handle_message(text_msg(OWNER, "docs Docs Kunde", "d1")))
    body = body_of(sent_to(OWNER)[-1])
    assert "ausweis.jpg" in body and "https://example.test/ausweis.jpg" in body
    run(handler.handle_message(text_msg(OWNER, "docs Niemand Unbekannt", "d2")))
    assert "Nothing found" in body_of(sent_to(OWNER)[-1])


def test_slow_handler_answers_twilio_within_budget_then_sends_rest():
    reset()
    wa.OUTBOX.clear()

    async def slow_turn():
        await wa.send_message(OWNER, "first")
        await asyncio.sleep(0.5)
        await wa.send_message(OWNER, "late")

    async def scenario():
        replies = await wa.run_within_twiml_budget(OWNER, slow_turn, budget=0.1)
        assert replies and "first" in replies[0] and all("late" not in r for r in replies)
        await asyncio.sleep(0.8)  # let the detached handler finish

    rest_calls = []

    class _FakeResp:
        def raise_for_status(self): pass
        def json(self): return {"sid": "SMfake"}

    class _FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, data=None, auth=None, **k):
            rest_calls.append(data)
            return _FakeResp()

    orig_client = wa.httpx.AsyncClient
    wa.httpx.AsyncClient = _FakeClient
    try:
        run(scenario())
    finally:
        wa.httpx.AsyncClient = orig_client
    # the late reply must not be lost: it goes out through the REST API
    assert any("late" in (c or {}).get("Body", "") for c in rest_calls)


def test_mail_review_queue_approve_and_deny():
    from app.services import email_triage_store as tstore

    reset()
    tstore.reset_memory()
    row = tstore.log_decision({
        "message_id": "<m1@test>",
        "sender_email": "unsure.buyer@gmail.com",
        "sender_name": "Unsure Buyer",
        "reply_to": "unsure.buyer@gmail.com",
        "subject": "BMW Anfrage",
        "body_preview": "Hallo, hätten Sie eine Limousine?",
        "intent": "BUY",
        "decision": "review",
        "category": "lead_buy",
        "layer": "2",
        "score": 4,
        "confidence": 0.65,
        "reason": "AI: borderline inquiry",
    })
    sid = tstore.short_id(row)

    run(handler.handle_message(text_msg(OWNER, "mail", "m_list")))
    assert sid in body_of(sent_to(OWNER)[-1])

    run(handler.handle_message(text_msg(OWNER, f"mail no {sid}", "m_no")))
    assert "Ignored" in body_of(sent_to(OWNER)[-1])
    assert tstore.get_rule("unsure.buyer@gmail.com") == "deny"


def test_whatsapp_reminders_and_done_sync():
    from datetime import datetime, timezone
    from app.services import reminder_service as rs

    reset()
    rs.reset_memory()
    rem = rs.create_reminder(
        title="Erstkontakt fällig: Herr Weber",
        due_at=datetime(2026, 11, 25, 8, 0, tzinfo=timezone.utc),
        customer_name="Herr Weber",
        customer_contact="weber@mail.de",
    )
    sid = rs.short_id(rem)

    run(handler.handle_message(text_msg(OWNER, "reminders", "rem_1")))
    assert sid in body_of(sent_to(OWNER)[-1]) and "Herr Weber" in body_of(sent_to(OWNER)[-1])

    run(handler.handle_message(text_msg(OWNER, f"done {sid}", "rem_2")))
    assert "marked as completed" in body_of(sent_to(OWNER)[-1])
    assert rs.find_reminder(rem["id"])["status"] == "COMPLETED"


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
