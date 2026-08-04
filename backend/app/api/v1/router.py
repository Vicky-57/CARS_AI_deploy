from fastapi import APIRouter
from app.api.v1.endpoints import ocr, voice, classify, contracts, projects, webhooks, briefings, gmail_auth

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(ocr.router)
api_router.include_router(voice.router)
api_router.include_router(classify.router)
api_router.include_router(contracts.router)
api_router.include_router(projects.router)
api_router.include_router(webhooks.router)
api_router.include_router(briefings.router)
api_router.include_router(gmail_auth.router)
