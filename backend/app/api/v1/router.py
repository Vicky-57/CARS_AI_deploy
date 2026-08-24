from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, ocr, voice, classify, contracts, projects,
    webhooks, briefings, google_auth, forms,
    telegram_bot, outlook, leads
)

api_router = APIRouter(prefix="/api/v1")

# ─── Core Auth & Settings ─────────────────────────────────────────────────────
api_router.include_router(auth.router)
api_router.include_router(google_auth.router)    # Google Drive OAuth only

# ─── Telegram Master Agent ────────────────────────────────────────────────────
api_router.include_router(telegram_bot.router)

# ─── Outlook 365 Email & Calendar ────────────────────────────────────────────
api_router.include_router(outlook.router)

# ─── CRM: Leads & Projects ───────────────────────────────────────────────────
api_router.include_router(leads.router)
api_router.include_router(projects.router)

# ─── AI Services ─────────────────────────────────────────────────────────────
api_router.include_router(ocr.router)
api_router.include_router(voice.router)
api_router.include_router(classify.router)

# ─── Contracts & Documents ───────────────────────────────────────────────────
api_router.include_router(contracts.router)
api_router.include_router(forms.router)

# ─── Automation & Webhooks ───────────────────────────────────────────────────
api_router.include_router(webhooks.router)
api_router.include_router(briefings.router)
