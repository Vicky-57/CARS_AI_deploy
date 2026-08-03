"""
backend/routes/classify.py — AI intent classification endpoint (kept)
Called by Frappe car_agents_crm.api.classify_lead_intent
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.claude_service import classify_intent

router = APIRouter(tags=["Classification"])


class ClassifyRequest(BaseModel):
    message: str


@router.post("/classify-intent")
async def classify_lead_intent(req: ClassifyRequest):
    """
    Classifies a message as BUY_INTENT, SELL_INTENT, or UNKNOWN.
    Returns: { intent, confidence }
    """
    try:
        result = await classify_intent(req.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
