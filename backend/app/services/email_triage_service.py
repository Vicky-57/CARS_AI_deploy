"""
app/services/email_triage_service.py
────────────────────────────────────────────────────────────────────────
CAR-AGENTS Phase 1 — AI-Assisted Lead Qualification & Triage Engine.

Core Phase 1 Principles (24 Nov 2026 spec):
  1. The AI NEVER rejects/deletes inquiries or sends customer messages on its own
     (unless EMAIL_AUTO_REPLY=True is explicitly enabled).
  2. Every incoming message is classified into the Phase 1 taxonomy, evaluated
     for extracted parameters + missing fields, assigned a suggested priority,
     and prepared with a tailored draft reply (German or English).
  3. Suspected spam/phishing is flagged (decision='flagged') — never deleted.

Taxonomy (`category`):
  - seller              (§3: Customer wishing to sell vehicle via CAR-AGENTS)
  - sourcing            (§5: Customer engaging CAR-AGENTS to source a vehicle)
  - sell_and_source     (§6: Customer selling current vehicle & sourcing another)
  - advertised_buyer    (§4: Prospective buyer of an already advertised vehicle, incl. mobile.de/AutoScout24/Kleinanzeigen)
  - b2b_cooperation     (§7: Specific B2B cooperation inquiry)
  - b2b_offer           (§7: General B2B service offer)
  - b2b_advertising     (§7: Recognizable B2B advertising/marketing)
  - invoice             (§7: Invoice, receipt, or financial document — highlights payment deadline)
  - spam                (§7: Suspected spam, phishing, or automated platform noise — flagged, not deleted)
  - other               (§2: Unclear or general inquiry)

 backward-compatible aliases accepted in tests/legacy:
  lead_buy -> sourcing, lead_sell -> seller, marketplace -> advertised_buyer,
  b2b_solicitation -> b2b_offer, lead_other -> other
────────────────────────────────────────────────────────────────────────
"""
import json
import logging
import re
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("email_triage")

AUTO_LEAD_CONFIDENCE = 0.8
REVIEW_CONFIDENCE = 0.5
DROP_SCORE = -3
AI_BODY_CHARS = 900
HAIKU_MODEL = "claude-haiku-4-5"

# ─── Phase 1 Required Field Checklists (§3, §4, §5, §6) ────────────────────

SELLER_REQUIRED_FIELDS = [
    ("manufacturer_model", "Hersteller & Modell", "Manufacturer & model"),
    ("first_registration", "Erstzulassung / Baujahr", "First registration / year"),
    ("timeframe", "Gewünschter Verkaufszeitraum", "Desired sale timeframe"),
    ("location", "Standort des Fahrzeugs", "Vehicle location"),
    ("phone", "Telefonnummer für Rückruf", "Telephone number / callback"),
    ("preferred_channel", "Bevorzugter Kontaktweg & Erreichbarkeit", "Preferred channel & contact times"),
]

SOURCING_REQUIRED_FIELDS = [
    ("manufacturer_model", "Gewünschte Marke / Modell oder Fahrzeugtyp", "Preferred make/model or vehicle type"),
    ("intended_use", "Einsatzzweck & wichtige Anforderungen", "Intended use & key requirements"),
    ("timeframe", "Gewünschter Kaufzeitraum", "Desired purchase timeframe"),
    ("location", "Standort / Suchregion", "Customer location / search region"),
    ("preferred_channel", "Telefonnummer, bevorzugter Kontaktweg & Erreichbarkeit", "Phone, preferred channel & availability"),
    # Note (§5): Budget is discussed in personal conversation and is NOT mandatory in initial written message.
]

ADVERTISED_BUYER_FIELDS = [
    ("target_vehicle", "Angefragtes Inserat / Fahrzeug", "Advertised vehicle reference"),
    ("buyer_question", "Anliegen (Verfügbarkeit / Besichtigung / Preisangebot)", "Inquiry focus (availability / viewing / offer)"),
]

LEAD_CATEGORIES = {"seller", "sourcing", "sell_and_source", "advertised_buyer", "lead_buy", "lead_sell", "marketplace", "lead_other"}
B2B_CATEGORIES = {"b2b_cooperation", "b2b_offer", "b2b_advertising", "b2b_solicitation"}

# ─── Layer 0 data ─────────────────────────────────────────────────────────

BLOCKED_DOMAINS = {
    "linkedin.com", "facebook.com", "facebookmail.com", "instagram.com", "twitter.com", "x.com",
    "xing.com", "youtube.com", "tiktok.com", "paypal.com", "klarna.com", "stripe.com", "mollie.com",
    "dhl.de", "dhl.com", "dpd.de", "hermes.de", "fedex.com", "ups.com", "gls-group.eu", "deutschepost.de",
    "booking.com", "airbnb.com", "expedia.com", "google.com", "accounts.google.com", "github.com",
    "slack.com", "notion.so", "atlassian.com", "mailchimp.com", "sendgrid.net", "constantcontact.com",
    "hubspot.com", "salesforce.com", "amazon.com", "amazon.de", "ebay.de", "ebay.com",
    "sixt.com", "sixt.de", "auto1.com", "sparkasse.de", "postbank.de", "dkb.de", "volksbank.de",
    "ing.de", "commerzbank.com", "commerzbank.de", "deutsche-bank.de", "santander.de",
    "trustpilotmail.com", "metafin.com.my",
}

MARKETPLACE_DOMAINS = ("mobile.de", "autoscout24.de", "autoscout24.com", "kleinanzeigen.de")

BLOCKED_PREFIXES = (
    "no-reply", "noreply", "donotreply", "do-not-reply", "newsletter", "mailer-daemon",
    "postmaster", "bounce", "notifications", "notification", "alerts",
)

INVOICE_RE = re.compile(
    r"\b(rechnung|invoice|quittung|beleg|zahlungsaufforderung|fällig bis|due date|zahlbar bis|rechnungsnummer)\b",
    re.IGNORECASE,
)

DEADLINE_RE = re.compile(
    r"(?:fällig(?:keit)?|zahlbar bis|due(?: date)?|bis zum)\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zÄÖÜäöü]+\s+\d{4})",
    re.IGNORECASE,
)

AUTO_SUBJECT = re.compile(
    r"(automatische antwort|auto-?reply|out of office|abwesenheit|undeliverable|delivery (status|failed)|"
    r"kontoauszug|bestellbestätigung|buchungsbestätigung|"
    r"passwort|verifizierung|verify your|sicherheitscode|security alert|ihr .{0,12}code|neues dokument|"
    r"bestätigen sie|newsletter)",
    re.IGNORECASE,
)

FREEMAIL = ("gmail.com", "googlemail.com", "gmx.de", "gmx.net", "web.de", "outlook.com", "outlook.de",
            "hotmail.com", "hotmail.de", "yahoo.com", "yahoo.de", "icloud.com", "t-online.de", "freenet.de")


def _h(headers: Optional[Dict], name: str) -> str:
    if not headers:
        return ""
    for k, v in headers.items():
        if k.lower() == name.lower():
            return str(v or "")
    return ""


def _domain(addr: str) -> str:
    return addr.lower().strip().split("@")[-1] if "@" in addr else ""


def _domain_in(domain: str, domains) -> bool:
    return any(domain == d or domain.endswith("." + d) for d in domains)


def _detect_lang(text: str) -> str:
    low = (text or "").lower()
    en_hits = sum(1 for w in ("hello", "looking for", "interested", "would like", "car", "vehicle", "sell", "buy", "price") if w in low)
    de_hits = sum(1 for w in ("hallo", "guten tag", "sehr geehrte", "fahrzeug", "auto", "verkaufen", "kaufen", "suche", "interesse") if w in low)
    return "en" if en_hits > de_hits and en_hits >= 2 else "de"


def _extract_regex_params(subject: str, body: str) -> Dict:
    text = f"{subject}\n{body}"
    params: Dict[str, Optional[str]] = {}

    # Advertised vehicle from mobile.de / Kleinanzeigen subject
    m_adv = re.search(r"Fahrzeug:\s*([^\n\r|]+)", subject, re.IGNORECASE)
    if m_adv:
        params["manufacturer_model"] = m_adv.group(1).strip()
    else:
        m_brand = _BRAND_RE.search(text)
        if m_brand:
            # Capture brand + next word if model-like
            span_start = m_brand.start()
            snippet = text[span_start:span_start + 35].splitlines()[0]
            tokens = snippet.split()[:3]
            params["manufacturer_model"] = " ".join(tokens).strip(",.;:!?")

    m_year = re.search(r"\b(19[89]\d|20[0-2]\d)\b", text)
    if m_year:
        params["first_registration"] = m_year.group(1)

    m_km = re.search(r"\b(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*(?:km|kilometer)\b", text, re.IGNORECASE)
    if m_km:
        params["mileage"] = m_km.group(0).strip()

    m_price = re.search(r"(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*(?:€|eur|euro)|(?:€|eur)\s*\d{1,3}(?:[.\s]\d{3})*)", text, re.IGNORECASE)
    if m_price:
        params["price_or_budget"] = m_price.group(0).strip()

    m_phone = re.search(r"(\+?\d[\d\s/\-()]{7,16}\d)", body)
    if m_phone:
        params["phone"] = m_phone.group(1).strip()

    m_tf = re.search(r"\b(sofort|dringend|diese woche|nächste woche|in \d+\s*(?:wochen|monaten)|diesen monat|asap|immediately|within \d+ weeks)\b", text, re.IGNORECASE)
    if m_tf:
        params["timeframe"] = m_tf.group(0).strip()

    m_loc = re.search(r"\b(?:in|aus|standort|region|plz)\s+([A-ZÄÖÜ][a-zäöüß]{2,25}|\d{5}\s+[A-ZÄÖÜ][a-zäöüß]{2,25})", text)
    if m_loc:
        params["location"] = m_loc.group(1).strip()

    m_dl = DEADLINE_RE.search(text)
    if m_dl:
        params["payment_deadline"] = m_dl.group(1).strip()

    # §4 Advertised vehicle buyer specifics: price offer, requested viewing time, reservation
    m_offer = re.search(
        r"(?:biete|preisangebot|mein angebot|offer|würde|zahle)\s*(?:ihnen\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*(?:€|eur|euro)|(?:€|eur)\s*\d{1,3}(?:[.\s]\d{3})*)",
        text,
        re.IGNORECASE,
    )
    if m_offer:
        params["buyer_offer_price"] = m_offer.group(1).strip()

    m_view_time = re.search(
        r"(?:besichtigung|probefahrt|anschauen|viewing|termin).{0,35}?\b(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|\d{1,2}\.\d{1,2}\.(?:\d{2,4})?|\d{1,2}[:.]\d{2}\s*uhr)",
        text,
        re.IGNORECASE,
    )
    if m_view_time:
        params["viewing_requested_time"] = m_view_time.group(1).strip()

    # §6 Combined Sell + Source detection
    has_sell = bool(re.search(r"\b(verkaufen|verkaufe|inzahlungnahme|in zahlung|mein\s+(?:aktuelles\s+)?(?:auto|fahrzeug|wagen)\s+abgeben|sell my)\b", text, re.IGNORECASE))
    has_buy = bool(re.search(r"\b(gleichzeitig.{0,25}(?:suche|kaufen)|neues\s+(?:auto|fahrzeug)\s+suchen|ersatzfahrzeug|und\s+suche\s+ein|source another|buy another)\b", text, re.IGNORECASE))
    if has_sell and has_buy:
        params["combined_sell_and_source"] = "Ja (Verkauf + Neuanschaffung gekoppelt)"
        params["dependency_notes"] = "Zeitliche & finanzielle Abhängigkeit zwischen Verkauf des Bestandsfahrzeugs und Beschaffung des Neufahrzeugs (§6)"

    if re.search(r"\b(besichtigung|probefahrt|termin|anschauen|viewing|test drive)\b", text, re.IGNORECASE):
        params["viewing_requested"] = "Ja / Yes"
    if re.search(r"(reservier|hold|reserve)", text, re.IGNORECASE):
        params["reservation_requested"] = "Ja / Yes"
    if re.search(r"\b(noch da|verfügbar|available|noch zu haben)\b", text, re.IGNORECASE):
        params["availability_question"] = "Ja / Yes"

    return {k: v for k, v in params.items() if v}


def match_advertised_vehicle(vehicle_hint: Optional[str], projects: Optional[List[Dict]] = None) -> Dict:
    """
    §4: Match an advertised-vehicle inquiry against active CRM deals/listings (`projects`).
    Returns {"matched_project_id": ..., "matched_vehicle_title": ..., "advertised_price": ...} or {}.
    """
    hint = (vehicle_hint or "").strip().lower()
    if not hint or len(hint) < 2:
        return {}

    if projects is None:
        from app.services import whatsapp_store as ws
        if ws.MEMORY:
            projects = list(ws._mem_projects)
        else:
            try:
                from database import get_supabase
                projects = get_supabase().table("projects").select("*").eq("status", "ACTIVE").limit(100).execute().data or []
            except Exception:
                projects = []

    tokens = [t for t in re.split(r"[\s,\-|/]+", hint) if len(t) >= 2]
    best_proj = None
    best_hits = 0
    for p in projects:
        target = (p.get("target_vehicle") or f"{p.get('manufacturer', '')} {p.get('model', '')}").strip()
        t_low = target.lower()
        if not t_low:
            continue
        hits = sum(1 for tok in tokens if tok in t_low)
        if hits > best_hits:
            best_hits = hits
            best_proj = p

    if not best_proj or best_hits == 0:
        return {}

    adv_price = best_proj.get("budget") or best_proj.get("min_price") or best_proj.get("price")
    return {
        "matched_project_id": best_proj.get("id"),
        "matched_vehicle_title": best_proj.get("target_vehicle") or f"{best_proj.get('manufacturer', '')} {best_proj.get('model', '')}".strip(),
        "advertised_price": f"{adv_price} €" if adv_price and "€" not in str(adv_price) else (str(adv_price) if adv_price else None),
    }


def compute_missing_fields(category: str, params: Dict, lang: str = "de") -> List[str]:
    """Return human-readable list of missing required fields for this inquiry category."""
    idx = 2 if lang == "en" else 1
    cat = (category or "").lower()
    if cat in ("seller", "lead_sell"):
        checklist = SELLER_REQUIRED_FIELDS
    elif cat in ("sourcing", "lead_buy"):
        checklist = SOURCING_REQUIRED_FIELDS
    elif cat == "sell_and_source":
        checklist = SELLER_REQUIRED_FIELDS + [("sourcing_target", "Gewünschtes neues Fahrzeug (Suchauftrag)", "Desired replacement vehicle")]
    elif cat in ("advertised_buyer", "marketplace"):
        return []  # §4: A simple availability/listing question must NOT trigger an extensive qualification checklist
    else:
        return []

    missing = []
    for key, label_de, label_en in checklist:
        val = params.get(key)
        if not val:
            missing.append(label_en if idx == 2 else label_de)
    return missing


def build_draft_reply(
    category: str,
    sender_name: str,
    subject: str,
    params: Dict,
    missing_fields: List[str],
    lang: str = "de",
) -> Tuple[Optional[str], Optional[str]]:
    """
    Generate Phase 1 compliant draft reply (subject, body) tailored to the category,
    already-provided parameters, and missing fields. Returns (None, None) for spam/invoices.
    """
    cat = (category or "").lower()
    if cat in ("spam", "automated", "invoice", "b2b_advertising", "unknown"):
        return None, None

    raw_name = (sender_name or "").split("@")[0].strip().strip('"')
    greet_name = raw_name if raw_name and not raw_name.startswith(("d3n3", "31hj", "gxgq", "rg68", "no-reply", "noreply")) else ("Interessent/in" if lang == "de" else "Customer")
    subj_out = subject if subject.lower().startswith("re:") else f"Re: {subject or 'Ihre Anfrage bei CAR-AGENTS'}"
    veh = params.get("manufacturer_model") or ("Ihr Fahrzeug" if lang == "de" else "your vehicle")

    if cat in ("advertised_buyer", "marketplace"):
        # §4: Flexible, concise response — no mandatory extensive qualification
        if lang == "en":
            body = (
                f"Dear {greet_name},\n\n"
                f"Thank you for your inquiry regarding the {veh}.\n\n"
                f"We are checking the current status and would be happy to answer your questions or coordinate a viewing appointment personally.\n"
                f"Please let us know your phone number and when we can best reach you for a quick call.\n\n"
                f"Best regards,\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        else:
            body = (
                f"Sehr geehrte/r {greet_name},\n\n"
                f"vielen Dank für Ihr Interesse an unserem inserierten Fahrzeug ({veh}).\n\n"
                f"Gerne klären wir Ihre Anfrage sowie eine mögliche Besichtigung persönlich mit Ihnen. "
                f"Unter welcher Telefonnummer und zu welcher Uhrzeit erreichen wir Sie am besten für einen kurzen Rückruf?\n\n"
                f"Mit freundlichen Grüßen\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        return subj_out, body

    if cat in ("seller", "lead_sell"):
        # §3: Request only missing basic seller details
        bullets = "\n".join(f"• {m}" for m in missing_fields) if missing_fields else (
            "• Telefonnummer und passende Uhrzeit für ein kurzes persönliches Gespräch"
        )
        if lang == "en":
            body = (
                f"Dear {greet_name},\n\n"
                f"Thank you for contacting CAR-AGENTS regarding the sale of {veh}.\n\n"
                f"To prepare our personal consultation, could you briefly share the following details?\n"
                f"{bullets}\n\n"
                f"(Optional details such as mileage, price expectation, or VIN are also welcome.)\n\n"
                f"Best regards,\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        else:
            body = (
                f"Sehr geehrte/r {greet_name},\n\n"
                f"vielen Dank für Ihre Anfrage zur Vermittlung / zum Verkauf Ihres Fahrzeugs ({veh}) über CAR-AGENTS.\n\n"
                f"Zur Vorbereitung unseres persönlichen Gesprächs bitten wir Sie noch kurz um folgende Angaben:\n"
                f"{bullets}\n\n"
                f"(Weitere Angaben wie Kilometerstand, Preisvorstellung oder FIN können Sie gerne optional ergänzen.)\n\n"
                f"Mit freundlichen Grüßen\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        return subj_out, body

    if cat in ("sourcing", "lead_buy"):
        # §5: Sourcing — budget is NOT mandatory in initial written message
        bullets = "\n".join(f"• {m}" for m in missing_fields) if missing_fields else (
            "• Telefonnummer und passende Uhrzeit für ein persönliches Beratungsgespräch"
        )
        if lang == "en":
            body = (
                f"Dear {greet_name},\n\n"
                f"Thank you for your vehicle sourcing inquiry with CAR-AGENTS.\n\n"
                f"So that we can prepare effectively for a personal call, please let us know:\n"
                f"{bullets}\n\n"
                f"Best regards,\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        else:
            body = (
                f"Sehr geehrte/r {greet_name},\n\n"
                f"vielen Dank für Ihre Suchanfrage bei CAR-AGENTS!\n\n"
                f"Damit wir uns optimal auf ein persönliches Gespräch vorbereiten können, teilen Sie uns bitte noch kurz mit:\n"
                f"{bullets}\n\n"
                f"Mit freundlichen Grüßen\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
            )
        return subj_out, body

    if cat == "sell_and_source":
        # §6: Combined sale & sourcing — essential info on both vehicles + timing relationship
        body = (
            f"Sehr geehrte/r {greet_name},\n\n"
            f"vielen Dank für Ihre kombinierte Anfrage zum Verkauf Ihres aktuellen Fahrzeugs und zur Suche eines neuen Fahrzeugs über CAR-AGENTS.\n\n"
            f"Für unser persönliches Erstgespräch bitten wir Sie kurz um:\n"
            f"• Eckdaten Ihres aktuellen Fahrzeugs (Marke/Modell, Erstzulassung, Standort)\n"
            f"• Ihr gewünschtes neues Fahrzeug (Marke/Modell oder Fahrzeugtyp & Einsatzzweck)\n"
            f"• Den gewünschten zeitlichen Zusammenhang zwischen Verkauf und Neuanschaffung\n"
            f"• Ihre Telefonnummer und wann wir Sie am besten erreichen können\n\n"
            f"Mit freundlichen Grüßen\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
        )
        return subj_out, body

    if cat in ("b2b_cooperation", "b2b_offer", "b2b_solicitation"):
        body = (
            f"Sehr geehrte/r {greet_name},\n\n"
            f"vielen Dank für Ihre Nachricht und Ihr Interesse an einer Zusammenarbeit mit CAR-AGENTS.\n"
            f"Wir haben Ihr Anliegen intern vermerkt und melden uns bei Bedarf persönlich bei Ihnen.\n\n"
            f"Mit freundlichen Grüßen\nCAR-AGENTS Team"
        )
        return subj_out, body

    # Other / unclear
    body = (
        f"Sehr geehrte/r {greet_name},\n\n"
        f"vielen Dank für Ihre Nachricht an CAR-AGENTS. "
        f"Teilen Sie uns gerne kurz mit, wie wir Ihnen weiterhelfen können und unter welcher Telefonnummer wir Sie erreichen.\n\n"
        f"Mit freundlichen Grüßen\nCAR-AGENTS Team\ninfo@car-agents.de | www.car-agents.de"
    )
    return subj_out, body


def layer0(mail: Dict) -> Optional[Tuple[str, str, str]]:
    """Return (decision, category, reason) if a hard rule fires, else None."""
    sender = (mail.get("sender_email") or "").lower().strip()
    dom = _domain(sender)
    headers = mail.get("headers") or {}
    subject = mail.get("subject") or ""
    body = (mail.get("body") or "").strip()
    combined = f"{subject}\n{body[:1200]}"

    own = (mail.get("own_address") or "").lower()
    if own and sender == own:
        return "drop", "automated", "own outbound address"

    if _domain_in(dom, MARKETPLACE_DOMAINS):
        if any(sender.startswith(p) for p in BLOCKED_PREFIXES):
            return "drop", "automated", f"marketplace system notification ({sender})"
        if INVOICE_RE.search(subject):
            return "review", "invoice", f"marketplace invoice ({dom})"
        return "lead", "marketplace", f"marketplace relay ({dom}) - reply to Reply-To buyer"

    # §7: Invoices, receipts and financial documents -> flagged for manual processing, NOT dropped
    if INVOICE_RE.search(subject) and not _domain_in(dom, ("sixt.com", "sixt.de")):
        return "review", "invoice", "invoice/financial document detected in subject"

    auto_sub = _h(headers, "Auto-Submitted").lower()
    if auto_sub and auto_sub != "no":
        return "drop", "automated", f"Auto-Submitted: {auto_sub}"
    if _h(headers, "Precedence").lower() in ("bulk", "list", "junk"):
        return "drop", "marketing", "Precedence bulk/list"
    if _h(headers, "List-Unsubscribe") or _h(headers, "X-Bulk-Unsubscribe"):
        return "drop", "marketing", "List-Unsubscribe header"
    if any(m in _h(headers, "X-Mailer").lower() for m in ("mailchimp", "sendinblue", "hubspot", "klaviyo", "brevo")):
        return "drop", "marketing", "bulk mailer"
    if "spam" in _h(headers, "X-Spam-Flag").lower() or _h(headers, "X-Spam-Status").lower().startswith("yes"):
        return "drop", "spam", "provider spam flag"
    auth = _h(headers, "Authentication-Results").lower()
    if "dkim=fail" in auth or "spf=fail" in auth:
        return "drop", "spam", "SPF/DKIM failure"

    if _domain_in(dom, BLOCKED_DOMAINS):
        return "drop", "automated", f"blocked domain {dom}"
    if any(sender.startswith(p) for p in BLOCKED_PREFIXES):
        return "drop", "automated", "automated sender prefix"
    if AUTO_SUBJECT.search(subject):
        return "drop", "automated", "automated/transactional subject"
    if len(body) < 15:
        return "drop", "automated", "empty/very short body"
    return None


# ─── Layer 1: scoring ─────────────────────────────────────────────────────

_BRANDS = (
    "audi bmw mercedes benz vw volkswagen porsche opel ford skoda seat cupra toyota honda mazda nissan "
    "hyundai kia renault peugeot citroen fiat volvo tesla mini jeep land rover jaguar lexus subaru suzuki "
    "mitsubishi dacia alfa romeo ferrari lamborghini maserati bentley bugatti golf passat polo tiguan "
    "a3 a4 a6 q5 x3 x5 c-klasse e-klasse 911 cayenne m3 m4 rs4 rs6 alhambra giulietta"
).split()
_BRAND_RE = re.compile(r"\b(" + "|".join(re.escape(b) for b in _BRANDS) + r")\b", re.IGNORECASE)

_VEHICLE_TERMS = re.compile(
    r"\b(auto|autos|fahrzeug|fahrzeuge|wagen|pkw|limousine|kombi|suv|cabrio|coupe|coupé|kleinwagen|"
    r"gebrauchtwagen|neuwagen|jahreswagen|diesel|benzin|hybrid|elektro|automatik|schaltung|"
    r"car|vehicle|sedan|estate|hatchback|convertible)\b", re.IGNORECASE)
_INTENT_TERMS = re.compile(
    r"\b(kaufen|kauf|suche|suchen|gesucht|interesse|interessiert|verkaufen|verkaufe|ankauf|anbieten|"
    r"verfügbar|vorrätig|probefahrt|besichtigung|preis|preisvorstellung|budget|finanzierung|inzahlungnahme|"
    r"buy|sell|looking for|interested|available|test drive|price)\b", re.IGNORECASE)
_QUESTION = re.compile(r"(haben sie|hätten sie|können sie|gibt es|do you have|is it available|\?)", re.IGNORECASE)
_SPEC = re.compile(r"(\b\d{1,3}[.\s]?\d{3}\s?(km|kilometer)\b|\b\d{4,6}\s?(€|eur|euro)\b|€\s?\d{3,6}|\b(19|20)\d{2}\b|\bbaujahr\b|\berstzulassung\b|\bps\b|\bkw\b)", re.IGNORECASE)

_NEG_MARKETING = re.compile(
    r"(unsubscribe|abmelden|newsletter|% rabatt|% off|gutschein|coupon|sonderangebot|black friday|"
    r"jetzt (sichern|sparen|bestellen)|nur heute|limited offer|exklusiv für sie|view in browser|"
    r"im browser (ansehen|öffnen))", re.IGNORECASE)
_NEG_B2B = re.compile(
    r"(zusammenarbeit|dienstleistung|dienstleister|unsere (lösung|lösungen|leistungen|agentur|plattform)|"
    r"wir (bieten|unterstützen|helfen|sind spezialisiert)|personal(e|elle)? unterstützung|recruiting|"
    r"personalvermittlung|marketing|seo\b|webdesign|lead generation|kooperation|partnerschaft|"
    r"we offer|our (services|solution|platform)|book a (call|demo)|schedule a call)", re.IGNORECASE)
_STRONG_PHRASE = re.compile(
    r"(ich (möchte|will|würde gerne|suche|interessiere mich).{0,40}(kaufen|verkaufen|auto|fahrzeug|wagen)|"
    r"ich bin interessiert|haben sie .{0,40}(da|verfügbar|vorrätig)|i (want|would like) to (buy|sell)|"
    r"mein (auto|fahrzeug|wagen))", re.IGNORECASE)


def layer1_score(mail: Dict) -> Tuple[int, List[str]]:
    subject = mail.get("subject") or ""
    body = mail.get("body") or ""
    text = f"{subject}\n{body[:2000]}"
    sender = (mail.get("sender_email") or "").lower()
    score = 0
    signals: List[str] = []

    def add(n: int, why: str):
        nonlocal score
        score += n
        signals.append(f"{n:+d} {why}")

    if _BRAND_RE.search(text):
        add(2, "car brand/model")
    if _VEHICLE_TERMS.search(text):
        add(1, "vehicle term")
    if _INTENT_TERMS.search(text):
        add(1, "buy/sell intent term")
    if _STRONG_PHRASE.search(text):
        add(3, "strong buy/sell phrase")
    if _QUESTION.search(text):
        add(1, "question")
    if _SPEC.search(text):
        add(1, "price/km/year spec")
    if _domain_in(_domain(sender), FREEMAIL):
        add(1, "personal mailbox")
    if len(body.strip()) <= 600:
        add(1, "short human-length body")

    if _NEG_MARKETING.search(text):
        add(-4, "marketing phrase")
    if _NEG_B2B.search(text):
        add(-3, "B2B/pitch phrase")
    if len(re.findall(r"https?://", body)) >= 5:
        add(-2, "many links")
    if re.search(r"<(table|td|img)\b", body, re.IGNORECASE):
        add(-1, "html-heavy")
    return score, signals


# ─── Layer 2: Claude Haiku Phase 1 Classifier & Parameter Extractor ───────

def clean_for_ai(body: str, limit: int = AI_BODY_CHARS) -> str:
    """Strip quoted replies, signatures and link noise so the model sees only fresh text."""
    lines = []
    for ln in (body or "").splitlines():
        s = ln.strip()
        if s.startswith(">"):
            continue
        if re.match(r"^(am .{5,60} schrieb|on .{5,60} wrote|von:|from:|-----original)", s, re.IGNORECASE):
            break
        if s in ("--", "-- ") or s.lower().startswith(("mit freundlichen grüßen", "viele grüße", "best regards")):
            break
        lines.append(s)
    txt = re.sub(r"https?://\S+", "<link>", " ".join(lines))
    return re.sub(r"\s+", " ", txt).strip()[:limit]


_AI_PROMPT = """Du bist der Phase-1 KI-Assistent von CAR-AGENTS (deutsche Autovermittlung: Verkauf, Suchauftrag/Beschaffung, Inserate).
Analysiere die E-Mail nach den Phase-1-Anforderungen und antworte NUR mit gültigem JSON:
{{
  "category": "seller|sourcing|sell_and_source|advertised_buyer|b2b_cooperation|b2b_offer|b2b_advertising|invoice|spam|other",
  "multi_requests": ["optional weitere Kategorien falls mehrere Anliegen in einer Nachricht"],
  "confidence": 0.0-1.0,
  "language": "de|en",
  "priority": "HIGH|NORMAL|LOW",
  "priority_reason": "kurze Begründung der Priorität (z.B. konkretes Kaufangebot, Besichtigungswunsch, dringender Verkauf)",
  "params": {{
    "manufacturer_model": null or "Marke & Modell / Fahrzeugtyp",
    "first_registration": null or "Erstzulassung / Baujahr",
    "mileage": null or "Kilometerstand",
    "price_or_budget": null or "Preisvorstellung / Preisangebot / freiwilliges Budget",
    "timeframe": null or "Gewünschter Verkaufs-/Kaufzeitraum",
    "location": null or "Standort / Suchregion",
    "phone": null or "Telefonnummer",
    "preferred_channel": null or "Bevorzugter Kontaktweg & Uhrzeit",
    "intended_use": null or "Einsatzzweck & wichtige Anforderungen",
    "payment_deadline": null or "Zahlungsziel bei Rechnungen"
  }},
  "reason": "max 14 Wörter Zusammenfassung des Anliegens"
}}

Kategorien-Regeln:
- seller: Kunde möchte sein eigenes Fahrzeug über CAR-AGENTS verkaufen.
- sourcing: Kunde beauftragt/sucht über CAR-AGENTS ein Fahrzeug (auch ohne Wort 'kaufen', z.B. "Haben Sie eine BMW Limousine?").
- sell_and_source: Kunde möchte gleichzeitig ein Fahrzeug verkaufen UND ein anderes suchen.
- advertised_buyer: Interessent für ein bereits von CAR-AGENTS inseriertes Fahrzeug (Verfügbarkeit, Besichtigung, Preisangebot, Reservierung).
- b2b_cooperation: Konkrete B2B-Kooperationsanfrage (z.B. Händler-/Flottenpartnerschaft).
- b2b_offer: Allgemeines B2B-Dienstleistungsangebot (z.B. Personalvermittlung, Werkstatt, Sachverständiger, Software).
- b2b_advertising: Erkennbare Werbung / Newsletter.
- invoice: Rechnung, Quittung, Zahlungsbeleg.
- spam: Phishing, Betrug, gefälschte Bank-/Paket-Mails, automatische Systemcodes.
- other: Sonstige oder unklare Nachricht.

Absender: {sender}
Betreff: {subject}
Text: {body}"""


def _parse_json(raw: str) -> Dict:
    raw = (raw or "").strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    return json.loads(m.group(0) if m else raw)


async def classify_ai(mail: Dict) -> Optional[Dict]:
    """Call Claude Haiku. Returns the parsed dict or None if unavailable/failed."""
    from config import settings
    if not settings.ANTHROPIC_API_KEY:
        return None
    from app.services.claude_service import call_claude
    prompt = _AI_PROMPT.format(
        sender=mail.get("sender_email") or "",
        subject=(mail.get("subject") or "")[:220],
        body=clean_for_ai(mail.get("body") or ""),
    )
    try:
        raw = await call_claude(prompt, max_tokens=420, model=HAIKU_MODEL)
        return _parse_json(raw)
    except Exception as e:
        logger.warning(f"AI triage failed: {e}")
        return None


# ─── Orchestration ────────────────────────────────────────────────────────

def _enrich_result(
    mail: Dict,
    decision: str,
    category: str,
    layer,
    score: int = 0,
    confidence: Optional[float] = None,
    reason: str = "",
    ai_data: Optional[Dict] = None,
    signals: Optional[List[str]] = None,
) -> Dict:
    subject = mail.get("subject") or ""
    body = mail.get("body") or ""
    sender_name = mail.get("sender_name") or mail.get("sender_email") or ""
    lang = (ai_data or {}).get("language") or _detect_lang(f"{subject}\n{body}")

    regex_params = _extract_regex_params(subject, body)
    ai_params = {k: v for k, v in ((ai_data or {}).get("params") or {}).items() if v}
    merged_params = {**regex_params, **ai_params}

    missing = compute_missing_fields(category, merged_params, lang=lang)
    is_Customer_lead = category in LEAD_CATEGORIES
    is_qualified = bool(is_Customer_lead and (len(missing) <= 1 or category in ("advertised_buyer", "marketplace")))

    draft_subj, draft_body = build_draft_reply(
        category=category,
        sender_name=sender_name,
        subject=subject,
        params=merged_params,
        missing_fields=missing,
        lang=lang,
    )

    priority = (ai_data or {}).get("priority") or (
        "HIGH" if (category in ("advertised_buyer", "marketplace") or merged_params.get("viewing_requested") or merged_params.get("buyer_offer_price") or merged_params.get("reservation_requested") or merged_params.get("phone"))
        else "LOW" if category in ("spam", "automated", "b2b_advertising")
        else "NORMAL"
    )
    priority_reason = (ai_data or {}).get("priority_reason") or (
        "Konkretes Preisangebot / Reservierungswunsch (§4)" if (merged_params.get("buyer_offer_price") or merged_params.get("reservation_requested"))
        else "Direkte Fahrzeug-/Inseratsanfrage" if priority == "HIGH"
        else reason
    )

    adv_match = {}
    if category in ("advertised_buyer", "marketplace"):
        adv_match = match_advertised_vehicle(merged_params.get("manufacturer_model"))

    return {
        "decision": decision,
        "category": category,
        "layer": layer,
        "score": score,
        "confidence": confidence,
        "reason": reason,
        "extracted": {
            "vehicle": merged_params.get("manufacturer_model"),
            "budget": merged_params.get("price_or_budget"),
            **merged_params,
        },
        "extracted_params": merged_params,
        "missing_fields": missing,
        "is_qualified": is_qualified,
        "draft_subject": draft_subj,
        "draft_reply": draft_body,
        "draft_status": "pending" if draft_body else "none",
        "priority": priority,
        "priority_reason": priority_reason,
        "payment_deadline": merged_params.get("payment_deadline"),
        "multi_requests": (ai_data or {}).get("multi_requests") or [],
        "matched_project_id": adv_match.get("matched_project_id"),
        "matched_vehicle_title": adv_match.get("matched_vehicle_title") or (merged_params.get("manufacturer_model") if category in ("advertised_buyer", "marketplace") else None),
        "advertised_price": adv_match.get("advertised_price"),
        "buyer_offer_price": merged_params.get("buyer_offer_price") or (merged_params.get("price_or_budget") if category in ("advertised_buyer", "marketplace") else None),
        "viewing_requested_time": merged_params.get("viewing_requested_time"),
        "reservation_requested": bool(merged_params.get("reservation_requested")),
        "dependency_notes": merged_params.get("dependency_notes"),
        "signals": signals or [],
    }


async def triage(mail: Dict, use_ai: bool = True, sender_rule: Optional[str] = None) -> Dict:
    """
    sender_rule: 'allow' | 'deny' | None (from sender_rules table, founder decisions)
    """
    if sender_rule == "deny":
        return _enrich_result(mail, "drop", "spam", 0, reason="sender on deny list")

    if mail.get("in_thread"):
        subj = mail.get("subject") or ""
        if AUTO_SUBJECT.search(subj) or _h(mail.get("headers"), "Auto-Submitted").lower() not in ("", "no"):
            return _enrich_result(mail, "drop", "automated", "thread", reason="auto-reply inside thread")
        return _enrich_result(mail, "reply", "reply", "thread", reason="reply in our conversation")

    if sender_rule != "allow":
        hit = layer0(mail)
        if hit:
            decision, category, reason = hit
            return _enrich_result(mail, decision, category, 0, reason=reason)

    score, signals = layer1_score(mail)
    if sender_rule == "allow":
        score += 3

    if score <= DROP_SCORE:
        # Check if it's a B2B offer so we categorize it accurately instead of generic 'unknown'
        combined = f"{mail.get('subject') or ''}\n{mail.get('body') or ''}"
        cat_l1 = "b2b_offer" if _NEG_B2B.search(combined) else ("b2b_advertising" if _NEG_MARKETING.search(combined) else "unknown")
        return _enrich_result(
            mail, "drop", cat_l1, 1, score,
            reason="score too low: " + ", ".join(signals[:4]),
            signals=signals,
        )

    ai = await classify_ai(mail) if use_ai else None
    if ai is None:
        if score >= 4:
            return _enrich_result(mail, "review", "sourcing", 1, score, reason="no AI; high score -> review", signals=signals)
        return _enrich_result(mail, "drop", "unknown", 1, score, reason="no AI; weak score", signals=signals)

    cat = str(ai.get("category") or "other").lower()
    conf = float(ai.get("confidence") or 0)
    reason = f"AI: {ai.get('reason') or cat}"

    if cat in LEAD_CATEGORIES:
        if conf >= AUTO_LEAD_CONFIDENCE:
            return _enrich_result(mail, "lead", cat, 2, score, conf, reason, ai_data=ai, signals=signals)
        if conf >= REVIEW_CONFIDENCE:
            return _enrich_result(mail, "review", cat, 2, score, conf, reason, ai_data=ai, signals=signals)
        return _enrich_result(mail, "review", "other", 2, score, conf, reason + " (low confidence -> owner review)", ai_data=ai, signals=signals)

    if cat in ("b2b_cooperation", "b2b_offer", "b2b_solicitation"):
        return _enrich_result(mail, "b2b", cat, 2, score, conf, reason, ai_data=ai, signals=signals)

    if cat == "invoice":
        return _enrich_result(mail, "invoice", "invoice", 2, score, conf, reason, ai_data=ai, signals=signals)

    if cat == "other":
        return _enrich_result(mail, "review", "other", 2, score, conf, reason, ai_data=ai, signals=signals)

    if cat == "reply":
        return _enrich_result(mail, "review", "reply", 2, score, conf, reason, ai_data=ai, signals=signals)

    # spam / automated / b2b_advertising -> flagged (decision='drop' kept for backward test compatibility, stored in email_triage)
    return _enrich_result(mail, "drop", cat, 2, score, conf, reason, ai_data=ai, signals=signals)
