import httpx
from config import settings


async def call_claude(prompt: str, max_tokens: int = 1024) -> str:
    """Call Anthropic Claude API and return the text response."""
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-sonnet-4-5",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        res.raise_for_status()
        data = res.json()
        return data["content"][0]["text"]


async def classify_intent(text: str) -> dict:
    """Classify inbound message intent as BUY / SELL / UNKNOWN."""
    prompt = f"""You are an automotive broker assistant. Classify this message intent.

Message: {text}

Respond ONLY with this exact JSON (no markdown):
{{
  "intent": "BUY | SELL | UNKNOWN",
  "summary": "1-sentence German summary",
  "urgency": "high | medium | low"
}}"""
    raw = await call_claude(prompt, max_tokens=200)
    import json
    try:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start:end + 1])
    except Exception:
        return {"intent": "UNKNOWN", "summary": text[:100], "urgency": "low"}


async def summarize_email(subject: str, body: str) -> dict:
    """Summarize an inbound email and classify intent."""
    prompt = f"""You are an assistant for CAR-AGENTS, a German automotive broker.

Email Subject: {subject}
Email Body: {body}

Respond ONLY with this JSON (no markdown):
{{
  "intent": "BUY | SELL | UNKNOWN",
  "summary": "2-3 sentence German summary of customer request",
  "urgency": "high | medium | low",
  "suggested_reply": "Short professional German reply"
}}"""
    raw = await call_claude(prompt, max_tokens=512)
    import json
    try:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start:end + 1])
    except Exception:
        return {"intent": "UNKNOWN", "summary": body[:200], "urgency": "low", "suggested_reply": ""}


async def extract_voice_actions(transcript: str) -> dict:
    """Extract CRM action items from a voice note transcript."""
    prompt = f"""You are a CRM assistant at a German car brokerage.

Voice Transcript: {transcript}

Respond ONLY with this JSON (no markdown):
{{
  "summary": "1-2 sentence summary in the language of the transcript",
  "action_items": ["action 1", "action 2"],
  "intent": "sales | service | support | general | spam",
  "urgency": "high | medium | low",
  "suggested_reply": "Professional response in the transcript's language or N/A if spam",
  "task_title": "Short CRM task title"
}}"""
    raw = await call_claude(prompt, max_tokens=512)
    import json
    try:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start:end + 1])
    except Exception:
        return {"summary": transcript[:100], "action_items": [], "intent": "general", "urgency": "low", "suggested_reply": "", "task_title": "Voice Note"}
