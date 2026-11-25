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


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    for name, fn in tests:
        fn()
        print(f"PASS {name}")
    print(f"\n{len(tests)} tests passed")
