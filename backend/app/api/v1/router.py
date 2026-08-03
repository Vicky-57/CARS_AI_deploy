from fastapi import APIRouter
from app.api.v1.endpoints import ocr, voice, classify, contracts, projects

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(ocr.router)
api_router.include_router(voice.router)
api_router.include_router(classify.router)
api_router.include_router(contracts.router)
api_router.include_router(projects.router)
