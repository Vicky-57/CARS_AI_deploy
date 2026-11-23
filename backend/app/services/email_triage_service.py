"""
app/services/email_triage_service.py
────────────────────────────────────────────────────────────────────────
Layered inbound-email triage (cheap first, AI last).

  Layer 0  hard rules   (headers, sender, subject)           free
  Thread   reply to a conversation we started                free, skips filtering
  Layer 1  scoring      (signals, not a keyword gate)        free
  Layer 2  Claude Haiku classifier (only for what is left)   ~300 tokens/mail

`triage(mail)` returns a decision dict:
  {
    "decision":   "drop" | "lead" | "review" | "reply",
    "category":   lead_buy | lead_sell | lead_other | marketplace | reply |
                  marketing | automated | b2b_solicitation | spam | unknown,
    "layer":      0 | 1 | 2 | "thread",
    "score":      int,
    "confidence": float | None,
    "reason":     str,
    "extracted":  {"vehicle": ..., "budget": ...},
  }

This module makes NO side effects (no DB writes, no replies); callers decide.
Input `mail` keys: sender_email, sender_name, subject, body, headers (dict, any
case), in_thread (bool), own_address (str).
────────────────────────────────────────────────────────────────────────
"""
import json
import logging
import re
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("email_triage")

AUTO_LEAD_CONFIDENCE = 0.8
REVIEW_CONFIDENCE = 0.5
DROP_SCORE = -3          # Layer 1: at or below this (and no strong positive) -> drop without AI
AI_BODY_CHARS = 600
HAIKU_MODEL = "claude-haiku-4-5"

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

# Marketplaces whose relay mails are REAL buyer leads (reply to Reply-To, not the relay address)
MARKETPLACE_DOMAINS = ("mobile.de", "autoscout24.de", "autoscout24.com", "kleinanzeigen.de")

BLOCKED_PREFIXES = (
    "no-reply", "noreply", "donotreply", "do-not-reply", "newsletter", "mailer-daemon",
    "postmaster", "bounce", "notifications", "notification", "alerts", "billing", "invoice", "receipt",
)

AUTO_SUBJECT = re.compile(
    r"(automatische antwort|auto-?reply|out of office|abwesenheit|undeliverable|delivery (status|failed)|"
    r"rechnung|invoice|kontoauszug|bestellbestätigung|buchungsbestätigung|zahlungseingang|"
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


def layer0(mail: Dict) -> Optional[Tuple[str, str, str]]:
    """Return (decision, category, reason) if a hard rule fires, else None."""
    sender = (mail.get("sender_email") or "").lower().strip()
    dom = _domain(sender)
    headers = mail.get("headers") or {}
    subject = mail.get("subject") or ""
    body = (mail.get("body") or "").strip()

    own = (mail.get("own_address") or "").lower()
    if own and sender == own:
        return "drop", "automated", "own outbound address"

    if _domain_in(dom, MARKETPLACE_DOMAINS):
        return "lead", "marketplace", f"marketplace relay ({dom}) - reply to Reply-To buyer"

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
    "a3 a4 a6 q5 x3 x5 c-klasse e-klasse 911 cayenne"
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


# ─── Layer 2: Claude Haiku ────────────────────────────────────────────────

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


_AI_PROMPT = """Du bist der E-Mail-Filter eines deutschen Autovermittlers (Kauf-/Verkaufsvermittlung von Fahrzeugen).
Klassifiziere die E-Mail. Antworte NUR mit JSON:
{{"category": "lead_buy|lead_sell|lead_other|reply|marketing|automated|b2b_solicitation|spam",
  "confidence": 0.0-1.0,
  "language": "de|en|other",
  "vehicle": null or "kurze Beschreibung",
  "budget": null or "Betrag",
  "reason": "max 12 Wörter"}}

Regeln:
- lead_buy / lead_sell: eine PRIVATE oder gewerbliche Person will selbst ein Auto kaufen/verkaufen/suchen, auch OHNE Stichworte
  (z.B. "Ich brauche eine BMW Limousine, haben Sie die?" = lead_buy).
- lead_other: echte Autointeressierte Anfrage, Richtung unklar (Beratung, Finanzierung, Inzahlungnahme).
- marketing / b2b_solicitation: Werbung, Newsletter, Dienstleister die UNS etwas verkaufen wollen (Personal, SEO, Software...), auch wenn Autowörter vorkommen.
- automated: Codes, Bestätigungen, Benachrichtigungen, Rechnungen, Plattform-Mails.
- spam: Betrug, Phishing, unsinnig.

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
        subject=(mail.get("subject") or "")[:200],
        body=clean_for_ai(mail.get("body") or ""),
    )
    try:
        raw = await call_claude(prompt, max_tokens=200, model=HAIKU_MODEL)
        return _parse_json(raw)
    except Exception as e:
        logger.warning(f"AI triage failed: {e}")
        return None


# ─── Orchestration ────────────────────────────────────────────────────────

def _result(decision, category, layer, score=0, confidence=None, reason="", extracted=None, signals=None) -> Dict:
    return {
        "decision": decision, "category": category, "layer": layer, "score": score,
        "confidence": confidence, "reason": reason, "extracted": extracted or {}, "signals": signals or [],
    }


async def triage(mail: Dict, use_ai: bool = True, sender_rule: Optional[str] = None) -> Dict:
    """
    sender_rule: 'allow' | 'deny' | None  (from the sender_rules table, founder decisions)
    """
    if sender_rule == "deny":
        return _result("drop", "spam", 0, reason="sender on deny list")

    if mail.get("in_thread"):
        subj = mail.get("subject") or ""
        if AUTO_SUBJECT.search(subj) or _h(mail.get("headers"), "Auto-Submitted").lower() not in ("", "no"):
            return _result("drop", "automated", "thread", reason="auto-reply inside thread")
        return _result("reply", "reply", "thread", reason="reply in our conversation")

    if sender_rule != "allow":
        hit = layer0(mail)
        if hit:
            decision, category, reason = hit
            return _result(decision, category, 0, reason=reason)

    score, signals = layer1_score(mail)
    if sender_rule == "allow":
        score += 3

    if score <= DROP_SCORE:
        return _result("drop", "unknown", 1, score, reason="score too low: " + ", ".join(signals[:4]), signals=signals)

    ai = await classify_ai(mail) if use_ai else None
    if ai is None:
        # No AI available: never auto-reply on rules alone; strong score goes to human review
        if score >= 4:
            return _result("review", "lead_other", 1, score, reason="no AI; high score -> review", signals=signals)
        return _result("drop", "unknown", 1, score, reason="no AI; weak score", signals=signals)

    cat = str(ai.get("category") or "spam")
    conf = float(ai.get("confidence") or 0)
    extracted = {"vehicle": ai.get("vehicle"), "budget": ai.get("budget")}
    reason = f"AI: {ai.get('reason') or cat}"
    if cat.startswith("lead"):
        if conf >= AUTO_LEAD_CONFIDENCE:
            return _result("lead", cat, 2, score, conf, reason, extracted, signals)
        if conf >= REVIEW_CONFIDENCE:
            return _result("review", cat, 2, score, conf, reason, extracted, signals)
        return _result("drop", "unknown", 2, score, conf, reason + " (low confidence)", extracted, signals)
    if cat == "reply":
        return _result("review", cat, 2, score, conf, reason, extracted, signals)
    return _result("drop", cat, 2, score, conf, reason, extracted, signals)
