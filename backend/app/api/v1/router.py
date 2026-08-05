from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, ocr, voice, classify, contracts, projects,
    webhooks, briefings, gmail_auth, google_auth, meetings_sync, forms
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(ocr.router)
api_router.include_router(voice.router)
api_router.include_router(classify.router)
api_router.include_router(contracts.router)
api_router.include_router(projects.router)
api_router.include_router(webhooks.router)
api_router.include_router(briefings.router)
api_router.include_router(gmail_auth.router)
api_router.include_router(google_auth.router)
api_router.include_router(meetings_sync.router)
api_router.include_router(forms.router)
