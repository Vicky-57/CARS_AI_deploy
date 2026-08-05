"""
app/services/claude_service.py
────────────────────────────────────────────────────────────────────────
Claude AI operations for CAR-AGENTS:
  - Intent classification (BUY_INTENT / SELL_INTENT)
  - Inbound email summarisation & AI reply drafting
  - Client details extraction from OCR documents
  - Vehicle specs extraction from Fahrzeugdatenträger / Fahrzeugschein
  - Voice transcript action item parsing
"""
import json
import httpx
from config import settings

MODEL = "claude-sonnet-4-5"


async def call_claude(prompt: str, max_tokens: int = 1024) -> str:
    """Call Anthropic Claude API and return text response."""
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        res.raise_for_status()
        return res.json()["content"][0]["text"]


def _parse_json(raw: str) -> dict:
    """Safely extract JSON payload from Claude response."""
    try:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start:end + 1])
    except Exception:
        return {}


async def classify_intent(text: str) -> dict:
    """Classify inbound message intent as BUY_INTENT, SELL_INTENT, or UNKNOWN."""
    prompt = f"""You are an automotive broker assistant for CAR-AGENTS Germany.
Classify this inbound message intent.

Message: {text}

Respond ONLY with this exact JSON (no markdown):
{{
  "intent": "BUY_INTENT | SELL_INTENT | UNKNOWN",
  "confidence": 0.9,
  "summary": "1-sentence German summary"
}}"""
    raw = await call_claude(prompt, max_tokens=200)
    result = _parse_json(raw)
    return {
        "intent": result.get("intent", "UNKNOWN"),
        "confidence": float(result.get("confidence", 0.0)),
        "summary": result.get("summary", ""),
    }


CAR_KEYWORDS = [
    "car", "auto", "fahrzeug", "kauf", "verkauf", "vermittlung", "beschaffung",
    "suche", "anfrage", "angebot", "bmw", "porsche", "mercedes", "audi", "vw", "volkswagen",
    "ferrari", "lamborghini", "maserati", "bentley", "aston", "mclaren", "bugatti", "jaguar",
    "tesla", "volvo", "toyota", "ford", "nissan", "honda", "hyundai", "kia", "peugeot", "renault",
    "vermittlungsvertrag", "kaufvertrag", "beschaffungsvertrag", "übergabe", "fahrzeugschein",
    "tüv", "inspection", "erstzulassung", "probefahrt", "test drive", "inspektion", "unfallfrei",
    "besichtigung", "termin", "preis", "angebot", "preisvorstellung", "kilometerstand", "leasing"
]

IGNORE_KEYWORDS = [
    "newsletter", "unsubscribe", "security alert", "deletion warning", "naukri", "kaggle",
    "cloudflare", "github", "view image", "pre-prod engineer", "mock", "beehiiv"
]


def is_car_related_subject(subject: str) -> bool:
    """
    Stage 1 Pre-Filter: Fast keyword check on email subject.
    Returns True if the subject is related to buying, selling, or car brokerage inquiries.
    """
    if not subject:
        return False
    sub_lower = subject.lower().strip()

    # Fast drop for automated noise / marketing / newsletters
    if any(ignore in sub_lower for ignore in IGNORE_KEYWORDS):
        return False

    # Check for car or brokerage keywords
    for kw in CAR_KEYWORDS:
        if kw in sub_lower:
            return True

    return False


async def summarize_email(subject: str, body: str) -> dict:
    """Summarise an inbound email, validate if it's a genuine car lead, classify intent, and extract specs."""
    prompt = f"""You are an expert AI assistant for CAR-AGENTS, a German automotive brokerage.
Analyze this inbound email.

Email Subject: {subject}
Email Body: {body}

Tasks:
1. Determine if this email is a genuine car buying, selling, or brokerage inquiry (is_valid_lead: true/false).
2. Classify intent: BUY_INTENT (client wants us to source a car), SELL_INTENT (client wants us to sell their car), FOLLOW_UP (client asking update/info on active lead), or GENERAL_INQUIRY.
3. Extract any vehicle details (model, budget/price limit, year, mileage).
4. Provide a concise 2-sentence summary IN THE EXACT SAME LANGUAGE as the incoming email (if the email is written in English, write the summary in English; if in German, write in German).
5. Draft a short, polite suggested reply in the same language.

Respond ONLY with this JSON format (no markdown codeblocks):
{{
  "is_valid_lead": true,
  "intent": "BUY_INTENT | SELL_INTENT | FOLLOW_UP | GENERAL_INQUIRY",
  "summary": "Concise summary of email content",
  "extracted_specs": {{
    "vehicle": "e.g. BMW 320i",
    "target_price": "e.g. 31500 €",
    "mileage": "e.g. 42500 km"
  }},
  "urgency": "high | medium | low",
  "suggested_reply": "Short professional reply"
}}"""
    raw = await call_claude(prompt, max_tokens=600)
    result = _parse_json(raw)
    return {
        "is_valid_lead": bool(result.get("is_valid_lead", True)),
        "intent": result.get("intent", "UNKNOWN"),
        "summary": result.get("summary", body[:200]),
        "extracted_specs": result.get("extracted_specs", {}),
        "urgency": result.get("urgency", "low"),
        "suggested_reply": result.get("suggested_reply", ""),
    }


async def extract_client_details(raw_text: str) -> dict:
    """Extract personal client details from document text."""
    prompt = f"""You are a data extraction assistant for a German automotive broker.
Extract personal client/contact details from this document text.

Document Text:
{raw_text[:3000]}

Respond ONLY with this JSON (no markdown, use null for missing fields):
{{
  "first_name": null,
  "last_name": null,
  "email": null,
  "phone": null,
  "address": null,
  "city": null,
  "postcode": null,
  "id_number": null,
  "nationality": null
}}"""
    raw = await call_claude(prompt, max_tokens=400)
    result = _parse_json(raw)
    return {k: v for k, v in result.items() if v is not None}


async def extract_vehicle_specs(raw_text: str) -> dict:
    """Extract vehicle specs from German vehicle document text (Fahrzeugdatenträger)."""
    prompt = f"""You are a vehicle data extraction expert for a German car broker.
Extract vehicle specifications from this German vehicle document text.

Document Text:
{raw_text[:3000]}

Respond ONLY with this JSON (no markdown, use null for missing fields):
{{
  "vin": null,
  "manufacturer": null,
  "model": null,
  "power_kw": null,
  "power_ps": null,
  "displacement_ccm": null,
  "transmission_code": null,
  "colour_code": null,
  "initial_registration": null,
  "tuv_expiry": null,
  "licence_plate": null,
  "mileage": null
}}"""
    raw = await call_claude(prompt, max_tokens=400)
    result = _parse_json(raw)
    return {k: v for k, v in result.items() if v is not None}


async def extract_voice_actions(transcript: str) -> dict:
    """Extract CRM action items from a voice note transcript."""
    prompt = f"""You are a CRM assistant at a German car brokerage.

Voice Transcript: {transcript}

Respond ONLY with this JSON (no markdown):
{{
  "summary": "1-2 sentence summary",
  "action_items": ["action 1", "action 2"],
  "intent": "sales | service | support | general",
  "urgency": "high | medium | low",
  "suggested_reply": "Professional response or N/A",
  "task_title": "Short CRM task title"
}}"""
    raw = await call_claude(prompt, max_tokens=512)
    result = _parse_json(raw)
    return {
        "summary": result.get("summary", transcript[:100]),
        "action_items": result.get("action_items", []),
        "intent": result.get("intent", "general"),
        "urgency": result.get("urgency", "low"),
        "suggested_reply": result.get("suggested_reply", ""),
        "task_title": result.get("task_title", "Voice Note"),
    }
