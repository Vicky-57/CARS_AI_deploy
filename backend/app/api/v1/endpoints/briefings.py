from fastapi import APIRouter
from app.services.scheduler_service import run_daily_briefing, run_inactivity_check

router = APIRouter(prefix="/briefings", tags=["Executive Briefings"])


@router.post("/trigger-daily")
async def trigger_daily_briefing_now():
    """
    Manually trigger W5 Daily Executive Briefing (delivers summary via WhatsApp & Email).
    """
    await run_daily_briefing()
    return {"status": "success", "message": "Daily briefing delivered via WhatsApp & Email"}


@router.post("/trigger-inactivity-check")
async def trigger_inactivity_check_now():
    """
    Manually trigger W6 Deal Inactivity check and send WhatsApp alerts for silent deals.
    """
    await run_inactivity_check()
    return {"status": "success", "message": "Inactivity check completed"}
