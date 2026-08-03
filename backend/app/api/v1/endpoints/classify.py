from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.claude_service import classify_intent

router = APIRouter(tags=["Intent Classification"])


class ClassifyRequest(BaseModel):
    message: str


@router.post("/classify-intent")
async def classify_message_intent(req: ClassifyRequest):
    """
    Classify incoming communication message intent (BUY_INTENT / SELL_INTENT / UNKNOWN).
    """
    try:
        result = await classify_intent(req.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
