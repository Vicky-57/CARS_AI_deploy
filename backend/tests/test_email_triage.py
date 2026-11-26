"""Offline tests for email triage Layers 0-1 (no network, no AI). Run: python backend/tests/test_email_triage.py"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from app.services import email_triage_service as et  # noqa: E402


def mail(sender, subject, body, headers=None, in_thread=False):
    return {"sender_email": sender, "subject": subject, "body": body, "headers": headers or {},
            "in_thread": in_thread, "own_address": "info@car-agents.de"}


def run(m, **kw):
    return asyncio.run(et.triage(m, use_ai=False, **kw))


def test_noreply_and_blocked_domains_dropped():
    assert run(mail("no-reply@sixt.com", "Ihr SIXT Code: 581254", "Ihr Code lautet 581254 bitte nicht weitergeben"))["decision"] == "drop"
    assert run(mail("hello@dkb.de", "Neue Nachricht", "Sie haben eine neue Nachricht im Postfach erhalten, bitte einloggen."))["layer"] == 0


def test_bulk_headers_dropped():
    r = run(mail("deals@autohaus.de", "Angebote", "Neue Autos im Angebot " * 5, headers={"List-Unsubscribe": "<mailto:x>"}))
    assert r["decision"] == "drop" and r["category"] == "marketing"


def test_marketplace_is_lead():
    r = run(mail("abc@kontakt.mobile.de", "Interesse an deinem Fahrzeug: Seat Alhambra", "Hallo, ist das Fahrzeug noch verfügbar? Gruß Max"))
    assert r["decision"] == "lead" and r["category"] == "marketplace"


def test_b2b_pitch_scored_out():
    r = run(mail("sales@personal-gmbh.de", "Personelle Unterstützung für CAR AGENTS",
                 "Wir bieten Ihnen unsere Dienstleistungen im Bereich Recruiting an. Zusammenarbeit lohnt sich."))
    assert r["decision"] == "drop"


def test_keywordless_human_mail_not_dropped_by_rules():
    # No 'kaufen'/'auto' keyword but car model + question + personal mailbox -> must reach AI/review
    r = run(mail("max.mustermann@gmail.com", "Frage", "Hallo, ich brauche eine BMW Limousine, haben Sie die?"))
    assert r["decision"] in ("review", "lead") and r["score"] >= 4


def test_plain_unrelated_human_mail_goes_to_ai_not_dropped_silently():
    r = asyncio.run(et.triage(mail("anna@gmail.com", "Hallo", "Können wir kurz telefonieren? Es geht um meinen Wagen."), use_ai=False))
    assert r["score"] > et.DROP_SCORE  # reached Layer 1 decision path, not hard-dropped


def test_thread_reply_skips_filtering_but_not_autoreplies():
    assert run(mail("kunde@gmail.com", "Re: Anfrage", "Ja, ich suche einen Kombi, Budget 20000.", in_thread=True))["decision"] == "reply"
    assert run(mail("kunde@gmail.com", "Automatische Antwort: Re: Anfrage", "Ich bin bis 5.12. abwesend.", in_thread=True))["decision"] == "drop"


def test_sender_rules_override():
    assert run(mail("max@gmail.com", "Frage", "Hallo, ich brauche einen BMW"), sender_rule="deny")["decision"] == "drop"
    assert run(mail("no-reply@dealer.de", "Fahrzeug", "Ihr Audi A4 ist verfügbar, Preis 20000 Euro"), sender_rule="allow")["layer"] != 0


def test_clean_for_ai_strips_quotes_and_links():
    txt = et.clean_for_ai("Ich suche einen Golf.\n> altes zitat\nAm 01.01.2026 schrieb X:\nfoo https://x.de/abc")
    assert "zitat" not in txt and "foo" not in txt and "Golf" in txt


def test_phase1_parameters_missing_fields_and_drafts():
    # Seller inquiry with model + year + price -> extracts params, lists remaining missing fields, builds draft
    r_sell = run(mail("seller@gmail.com", "Mein BMW X5 verkaufen", "Hallo, ich möchte meinen BMW X5 Baujahr 2021 mit 45.000 km in München für 48.000 € verkaufen."))
    assert r_sell["extracted_params"].get("first_registration") == "2021"
    assert r_sell["extracted_params"].get("mileage")
    assert r_sell["draft_reply"] and "CAR-AGENTS" in r_sell["draft_reply"]

    # Invoice subject -> flagged as invoice with payment deadline extracted, no customer auto-draft
    r_inv = run(mail("billing@vendor-gmbh.de", "Rechnung Nr. 2026-991", "Anbei Ihre Rechnung über 250 €. Zahlbar bis: 15.12.2026."))
    assert r_inv["category"] == "invoice" and r_inv["payment_deadline"] == "15.12.2026"
    assert r_inv["draft_reply"] is None


def test_bavarian_holidays_working_hours_and_reminder_deduplication():
    from datetime import date, datetime, timezone
    from app.services import reminder_service as rs
    from app.services import whatsapp_store as ws

    ws.MEMORY = True
    rs.reset_memory()

    # Bavaria statutory holidays check (Epiphany Jan 6, Fronleichnam, Allerheiligen Nov 1)
    h2026 = rs.bavarian_holidays(2026)
    assert date(2026, 1, 6) in h2026 and date(2026, 11, 1) in h2026 and date(2026, 8, 15) in h2026
    assert not rs.is_working_day(date(2026, 1, 6))

    # §4 Advertised vehicle buyer -> +2 working hours
    start_utc = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)  # Wed 10:00 Berlin
    due_adv = rs.compute_initial_due("advertised_buyer", now_utc=start_utc)
    assert int((due_adv - start_utc).total_seconds() // 3600) == 2

    # §6 Shared contact_key prevents duplicate reminders for combined Sell+Source
    r1 = rs.create_reminder("Erstkontakt 1", due_adv, reminder_type="initial_response", contact_key="combo@gmail.com")
    r2 = rs.create_reminder("Erstkontakt 2", due_adv, reminder_type="initial_response", contact_key="combo@gmail.com")
    assert r1["id"] == r2["id"]

    # §10 Changing working hours does not alter already-calculated reminder due_at
    orig_due = r1["due_at"]
    rs.update_working_hours([0, 1, 2, 3, 4], 10, 17)
    assert rs.find_reminder(r1["id"])["due_at"] == orig_due

    # §10 Two-way completion sync
    done = rs.mark_completed(rs.short_id(r1), via="WHATSAPP")
    assert done["status"] == "COMPLETED" and done["completed_via"] == "WHATSAPP"


def test_combined_sell_and_source_linking_and_advertised_offer():
    from app.services import email_triage_store as tstore
    from app.services import whatsapp_store as ws

    ws.MEMORY = True
    tstore.reset_memory()
    ws._mem_projects.clear()
    ws._mem_projects.append({
        "id": "proj-m4",
        "target_vehicle": "BMW M4 Competition",
        "budget": "74.900 €",
        "status": "ACTIVE",
    })

    # §4 Advertised vehicle inquiry with price offer + viewing request + reservation
    r_adv = run(mail(
        "buyer@kontakt.mobile.de",
        "Interesse an deinem Fahrzeug: BMW M4 Competition",
        "Hallo, ist der BMW M4 noch verfügbar? Ich biete Ihnen 71.500 € und möchte morgen zur Besichtigung kommen. Bitte reservieren.",
    ))
    assert r_adv["matched_vehicle_title"] == "BMW M4 Competition"
    assert r_adv["advertised_price"] == "74.900 €"
    assert r_adv["buyer_offer_price"] == "71.500 €"
    assert r_adv["reservation_requested"] is True

    # §6 Combined Sell + Source creates two separate linked inquiries under one contact
    primary = tstore.log_decision({
        "message_id": "<combo1@test>",
        "sender_email": "dual@gmail.com",
        "sender_name": "Dual Customer",
        "subject": "Audi A4 verkaufen und BMW X5 suchen",
        "body_preview": "Ich möchte meinen Audi A4 verkaufen und gleichzeitig einen BMW X5 suchen.",
        "decision": "lead",
        "category": "sell_and_source",
    })
    companion = tstore.create_linked_sell_and_source(primary)
    assert companion is not None
    assert companion["linked_inquiry_id"] == primary["id"]
    assert companion["parent_contact_key"] == "dual@gmail.com"
    assert companion["category"] == "sourcing"


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    for name, fn in tests:
        fn()
        print(f"PASS {name}")
    print(f"\n{len(tests)} tests passed")
