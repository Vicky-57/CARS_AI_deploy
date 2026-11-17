"""
app/services/whatsapp_flow.py
────────────────────────────────────────────────────────────────────────
Fixed lead-qualification question flow for WhatsApp (NO LLM).

Pure logic: no network, no database. Easy to test and easy to edit.
To change wording, options, or the scoring table, edit ONLY this file.

State (stored per phone number by whatsapp_store):
  {"lang": "de"|"en", "intent": "BUY"|"SELL"|"OTHER"|None,
   "step": "<step name>", "answers": {...}, "done": bool, "label": "HOT"|"WARM"|"COLD"|None}

Public API:
  new_state(first_text)            -> state (language + intent guessed from first message)
  prompt(state)                    -> {"text": str, "buttons": [(id, title), ...] | None}
  handle_input(state, reply_id, text) -> (state, prompt_dict)
  apply_vehicle_document(state, specs) -> (state, prompt_dict) | None   (OCR shortcut)
  score(state)                     -> "HOT" | "WARM" | "COLD"
  summary(state)                   -> one-line summary for the founder alert
────────────────────────────────────────────────────────────────────────
"""
import re
from typing import Dict, List, Optional, Tuple

STEP_INTENT = "intent"
STEP_BUY_URGENCY = "buy_urgency"
STEP_BUY_TIMELINE = "buy_timeline"
STEP_BUY_BUDGET = "buy_budget"
STEP_SELL_URGENCY = "sell_urgency"
STEP_SELL_VEHICLE = "sell_vehicle"   # free text or photo of papers
STEP_SELL_PRICE = "sell_price"       # free text, optional
STEP_DONE = "done"

FREE_TEXT_STEPS = {STEP_SELL_VEHICLE, STEP_SELL_PRICE}

# (option_id, German title, English title)  - titles must stay short (WhatsApp limit)
OPTIONS: Dict[str, List[Tuple[str, str, str]]] = {
    STEP_INTENT: [
        ("buy", "Kaufen", "Buy"),
        ("sell", "Verkaufen", "Sell"),
        ("other", "Andere Frage", "Other question"),
    ],
    STEP_BUY_URGENCY: [
        ("urgent", "Dringend", "Urgent"),
        ("soon", "Bald kaufen", "Buy soon"),
        ("looking", "Nur schauen", "Just looking"),
    ],
    STEP_BUY_TIMELINE: [
        ("week", "Diese Woche", "This week"),
        ("month", "Binnen 1 Monat", "Within a month"),
        ("quarter", "1-3 Monate", "1-3 months"),
    ],
    STEP_BUY_BUDGET: [
        ("b20", "Unter 20.000 EUR", "Under 20,000 EUR"),
        ("b50", "20.000-50.000 EUR", "20,000-50,000 EUR"),
        ("b100", "50.000-100.000 EUR", "50,000-100,000 EUR"),
        ("b100p", "Ueber 100.000 EUR", "Over 100,000 EUR"),
        ("bnone", "Keine Angabe", "Prefer not to say"),
    ],
    STEP_SELL_URGENCY: [
        ("quick", "Schnell verkaufen", "Sell quickly"),
        ("month", "Binnen 1 Monat", "Within a month"),
        ("valuation", "Nur Bewertung", "Valuation only"),
    ],
}

TEXT = {
    "de": {
        "consent": "Mit Ihrer Antwort stimmen Sie zu, dass wir Ihre Angaben speichern, um Sie zu kontaktieren.",
        "welcome": "Hallo! Hier ist CAR-AGENTS. Vielen Dank fuer Ihre Nachricht.",
        STEP_INTENT: "Moechten Sie ein Fahrzeug kaufen oder verkaufen?",
        STEP_BUY_URGENCY: "Wie dringend suchen Sie ein Fahrzeug?",
        STEP_BUY_TIMELINE: "Wann moechten Sie kaufen?",
        STEP_BUY_BUDGET: "Wie hoch ist Ihr Budget?",
        STEP_SELL_URGENCY: "Wie schnell moechten Sie verkaufen?",
        STEP_SELL_VEHICLE: "Welches Fahrzeug moechten Sie verkaufen? (Marke, Modell, Baujahr) - oder senden Sie ein Foto des Fahrzeugscheins.",
        STEP_SELL_PRICE: "Haben Sie eine Preisvorstellung? (Betrag eingeben oder \"-\" zum Ueberspringen)",
        "retry": "Bitte waehlen Sie eine der Optionen unten aus.",
        "done_HOT": "Vielen Dank! Wir melden uns sehr zeitnah persoenlich bei Ihnen.",
        "done_WARM": "Vielen Dank! Wir melden uns in Kuerze bei Ihnen.",
        "done_COLD": "Vielen Dank fuer Ihr Interesse! Schreiben Sie uns jederzeit, wenn wir helfen koennen.",
    },
    "en": {
        "consent": "By replying you agree that we store your details to contact you.",
        "welcome": "Hello! This is CAR-AGENTS. Thank you for your message.",
        STEP_INTENT: "Would you like to buy or sell a vehicle?",
        STEP_BUY_URGENCY: "How urgently are you looking for a car?",
        STEP_BUY_TIMELINE: "When do you want to buy?",
        STEP_BUY_BUDGET: "What is your budget?",
        STEP_SELL_URGENCY: "How quickly do you want to sell?",
        STEP_SELL_VEHICLE: "Which vehicle do you want to sell? (make, model, year) - or send a photo of the registration papers.",
        STEP_SELL_PRICE: "Do you have an asking price? (enter an amount or \"-\" to skip)",
        "retry": "Please choose one of the options below.",
        "done_HOT": "Thank you! We will personally get back to you very soon.",
        "done_WARM": "Thank you! We will get back to you shortly.",
        "done_COLD": "Thank you for your interest! Message us any time if we can help.",
    },
}

_EN_HINTS = {"the", "i", "want", "buy", "sell", "looking", "car", "my", "you", "hello", "hi", "please", "interested", "is", "are"}
_BUY_RE = re.compile(r"\b(kaufen|kaufe|kauf|suche|suchen|interesse|interessiert|buy|buying|looking for|interested in|angebot|verfügbar|verfuegbar|available)\b")
_SELL_RE = re.compile(r"\b(verkaufen|verkaufe|verkauf|ankauf|abgeben|sell|selling|valuation|bewertung|inzahlung)\b")


# ─── Helpers ──────────────────────────────────────────────────────────────

def detect_language(text: str) -> str:
    words = set(re.findall(r"[a-zA-Z]+", (text or "").lower()))
    if re.search(r"[äöüß]", (text or "").lower()):
        return "de"
    return "en" if len(words & _EN_HINTS) >= 2 else "de"


def detect_intent(text: str) -> Optional[str]:
    low = (text or "").lower()
    sell = bool(_SELL_RE.search(low))
    buy = bool(_BUY_RE.search(low))
    if sell and not buy:
        return "SELL"
    if buy and not sell:
        return "BUY"
    return None


def _title(option: Tuple[str, str, str], lang: str) -> str:
    return option[1] if lang == "de" else option[2]


def _buttons(step: str, lang: str):
    return [(o[0], _title(o, lang)) for o in OPTIONS[step]] if step in OPTIONS else None


def _match_option(step: str, reply_id: Optional[str], text: Optional[str], lang: str) -> Optional[str]:
    options = OPTIONS.get(step, [])
    ids = [o[0] for o in options]
    if reply_id and reply_id in ids:
        return reply_id
    t = (text or "").strip().lower()
    if not t:
        return None
    if t.isdigit() and 1 <= int(t) <= len(options):
        return ids[int(t) - 1]
    for o in options:
        if t in (o[1].lower(), o[2].lower(), o[0]):
            return o[0]
    return None


# ─── State machine ────────────────────────────────────────────────────────

def new_state(first_text: str = "") -> Dict:
    intent = detect_intent(first_text)
    state = {
        "lang": detect_language(first_text),
        "intent": intent,
        "step": STEP_INTENT,
        "answers": {},
        "done": False,
        "label": None,
        "first_message": (first_text or "")[:500],
    }
    if intent == "BUY":
        state["step"] = STEP_BUY_URGENCY
    elif intent == "SELL":
        state["step"] = STEP_SELL_URGENCY
    return state


def prompt(state: Dict, first_contact: bool = False) -> Dict:
    lang, step = state["lang"], state["step"]
    t = TEXT[lang]
    if step == STEP_DONE:
        return {"text": t["done_" + (state.get("label") or "COLD")], "buttons": None}
    body = t[step]
    if first_contact:
        body = f"{t['welcome']}\n\n{body}\n\n{t['consent']}"
    return {"text": body, "buttons": _buttons(step, lang)}


def _finish(state: Dict) -> Dict:
    state["step"] = STEP_DONE
    state["done"] = True
    state["label"] = score(state)
    return state


def _advance(state: Dict) -> Dict:
    step, a = state["step"], state["answers"]
    if step == STEP_INTENT:
        if a["intent"] == "buy":
            state["intent"], state["step"] = "BUY", STEP_BUY_URGENCY
        elif a["intent"] == "sell":
            state["intent"], state["step"] = "SELL", STEP_SELL_URGENCY
        else:
            state["intent"] = "OTHER"
            return _finish(state)
    elif step == STEP_BUY_URGENCY:
        if a["buy_urgency"] == "looking":
            return _finish(state)
        state["step"] = STEP_BUY_TIMELINE
    elif step == STEP_BUY_TIMELINE:
        state["step"] = STEP_BUY_BUDGET
    elif step == STEP_BUY_BUDGET:
        return _finish(state)
    elif step == STEP_SELL_URGENCY:
        state["step"] = STEP_SELL_VEHICLE
    elif step == STEP_SELL_VEHICLE:
        if a.get("sell_urgency") == "valuation":
            return _finish(state)
        state["step"] = STEP_SELL_PRICE
    elif step == STEP_SELL_PRICE:
        return _finish(state)
    return state


def handle_input(state: Dict, reply_id: Optional[str] = None, text: Optional[str] = None) -> Tuple[Dict, Dict]:
    """Apply one customer reply. Returns (new_state, next_prompt)."""
    if state.get("done"):
        return state, prompt(state)

    step, lang = state["step"], state["lang"]
    if step in FREE_TEXT_STEPS:
        value = (text or "").strip()
        if not value:
            return state, {"text": TEXT[lang][step], "buttons": None}
        key = "vehicle" if step == STEP_SELL_VEHICLE else "asking_price"
        state["answers"][key] = None if value == "-" else value[:200]
    else:
        choice = _match_option(step, reply_id, text, lang)
        if not choice:
            return state, {"text": TEXT[lang]["retry"] + "\n\n" + TEXT[lang][step], "buttons": _buttons(step, lang)}
        state["answers"][step if step != STEP_INTENT else "intent"] = choice
    state = _advance(state)
    return state, prompt(state)


def apply_vehicle_document(state: Dict, specs: Dict) -> Optional[Tuple[Dict, Dict]]:
    """A photo of the registration papers answers the 'which vehicle' question."""
    if state.get("done") or state.get("step") != STEP_SELL_VEHICLE:
        return None
    parts = [specs.get("manufacturer"), specs.get("model")]
    desc = " ".join(str(p) for p in parts if p) or "Fahrzeugschein"
    if specs.get("vin"):
        desc += f" (VIN {specs['vin']})"
    state["answers"]["vehicle"] = desc
    state = _advance(state)
    return state, prompt(state)


# ─── Scoring table (edit here) ────────────────────────────────────────────

def score(state: Dict) -> str:
    a, intent = state["answers"], state.get("intent")
    if intent == "BUY":
        urgency = a.get("buy_urgency")
        if urgency == "urgent":
            return "HOT"
        if urgency == "soon":
            timeline = a.get("buy_timeline")
            has_budget = a.get("buy_budget") not in (None, "bnone")
            if timeline in ("week", "month") and has_budget:
                return "HOT"
            return "WARM"
        return "COLD"
    if intent == "SELL":
        return {"quick": "HOT", "month": "WARM"}.get(a.get("sell_urgency"), "COLD")
    return "COLD"


_LABEL_ICON = {"HOT": "🔥", "WARM": "🟡", "COLD": "❄️"}


def _option_title(step: str, option_id: Optional[str]) -> Optional[str]:
    for o in OPTIONS.get(step, []):
        if o[0] == option_id:
            return o[2]
    return None


def label_reason(state: Dict) -> str:
    """Human-readable reason for the Hot/Warm/Cold label."""
    a, intent = state["answers"], state.get("intent")
    if intent == "BUY":
        urgency = a.get("buy_urgency")
        if urgency == "urgent":
            return "Urgent purchase request"
        if urgency == "soon":
            timeline = a.get("buy_timeline")
            has_budget = a.get("buy_budget") not in (None, "bnone")
            if timeline in ("week", "month") and has_budget:
                return "Buy soon + budget provided"
            return "Buy soon (exploratory timeline/budget)"
        return "Just looking / general inquiry"
    if intent == "SELL":
        urg = a.get("sell_urgency")
        if urg == "quick":
            return "Sell quickly"
        if urg == "month":
            return "Sell within 1 month"
        return "Valuation / price estimate only"
    return "Inquiry"


def qualification_qa(state: Dict) -> List[Dict[str, str]]:
    """Returns list of { question, answer } dicts for the frontend LeadDetailPanel."""
    a, intent, lang = state["answers"], state.get("intent"), state.get("lang", "en")
    t = TEXT[lang]
    qa = []

    def _opt_title(step: str, opt_id: Optional[str]) -> str:
        for o in OPTIONS.get(step, []):
            if o[0] == opt_id:
                return o[1] if lang == "de" else o[2]
        return str(opt_id or "")

    if "intent" in a:
        qa.append({"question": t[STEP_INTENT], "answer": _opt_title(STEP_INTENT, a["intent"])})

    if intent == "BUY":
        if "buy_urgency" in a:
            qa.append({"question": t[STEP_BUY_URGENCY], "answer": _opt_title(STEP_BUY_URGENCY, a["buy_urgency"])})
        if "buy_timeline" in a:
            qa.append({"question": t[STEP_BUY_TIMELINE], "answer": _opt_title(STEP_BUY_TIMELINE, a["buy_timeline"])})
        if "buy_budget" in a:
            qa.append({"question": t[STEP_BUY_BUDGET], "answer": _opt_title(STEP_BUY_BUDGET, a["buy_budget"])})
    elif intent == "SELL":
        if "sell_urgency" in a:
            qa.append({"question": t[STEP_SELL_URGENCY], "answer": _opt_title(STEP_SELL_URGENCY, a["sell_urgency"])})
        if a.get("vehicle"):
            qa.append({"question": t[STEP_SELL_VEHICLE], "answer": str(a["vehicle"])})
        if a.get("asking_price"):
            qa.append({"question": t[STEP_SELL_PRICE], "answer": str(a["asking_price"])})

    return qa


def summary(state: Dict) -> str:
    """English one-line summary for the founder (alerts, lead notes)."""
    a, intent = state["answers"], state.get("intent") or "UNKNOWN"
    label = state.get("label") or score(state)
    parts = [f"{_LABEL_ICON[label]} {label}", intent]
    if intent == "BUY":
        for step in (STEP_BUY_URGENCY, STEP_BUY_TIMELINE, STEP_BUY_BUDGET):
            v = _option_title(step, a.get(step))
            if v:
                parts.append(v)
    elif intent == "SELL":
        v = _option_title(STEP_SELL_URGENCY, a.get("sell_urgency"))
        if v:
            parts.append(v)
        if a.get("vehicle"):
            parts.append(f"Vehicle: {a['vehicle']}")
        if a.get("asking_price"):
            parts.append(f"Asking: {a['asking_price']}")
    return " | ".join(parts)
