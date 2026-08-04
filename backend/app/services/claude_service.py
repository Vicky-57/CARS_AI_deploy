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


async def summarize_email(subject: str, body: str) -> dict:
    """Summarise an inbound email, classify intent, and draft an AI response."""
    prompt = f"""You are an assistant for CAR-AGENTS, a German automotive broker.

Email Subject: {subject}
Email Body: {body}

Respond ONLY with this JSON (no markdown):
{{
  "intent": "BUY_INTENT | SELL_INTENT | UNKNOWN",
  "summary": "2-3 sentence German summary",
  "urgency": "high | medium | low",
  "suggested_reply": "Short professional German reply"
}}"""
    raw = await call_claude(prompt, max_tokens=512)
    result = _parse_json(raw)
    return {
        "intent": result.get("intent", "UNKNOWN"),
        "summary": result.get("summary", body[:200]),
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
