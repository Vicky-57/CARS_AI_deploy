"""
backend/main.py — CAR-AGENTS Production FastAPI Backend v5.0
─────────────────────────────────────────────────────────────
Modular FastAPI Application with Integrated Background Automation

Features:
  ✅ OCR Document & Fahrzeugdatenträger Spec Extraction
  ✅ Whisper Audio Transcription & Voice Action Extraction
  ✅ AI Intent Classification (BUY_INTENT / SELL_INTENT)
  ✅ 1-Click PDF Contract Pre-filling (4 Templates)
  ✅ Net Broker Profit & Investment Financial Calculator
  ✅ Meta WhatsApp Business Cloud API Webhook Handler (W2)
  ✅ Strato Inbound Email IMAP Listener (W1)
  ✅ APScheduler Automated Daily Briefings & Inactivity Checks (W5, W6)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1.router import api_router
from app.services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to handle startup & shutdown events."""
    print("Starting CAR-AGENTS FastAPI backend & background automation scheduler...")
    start_scheduler()
    yield
    print("Shutting down CAR-AGENTS backend...")
    stop_scheduler()


app = FastAPI(
    title="CAR-AGENTS AI Operations API",
    description="Automated AI services, OCR document parsing, contract pre-filling, WhatsApp webhooks, and executive briefings for CAR-AGENTS.",
    version="5.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # React dev server (Vite)
        "http://localhost:3000",   # Production web client
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Include API Router v1 ───────────────────────────────────────────────────
app.include_router(api_router)

# ─── Legacy route aliases for backward compatibility ──────────────────────────
from app.api.v1.endpoints import ocr, voice, classify
app.include_router(ocr.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(classify.router)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "system": "CAR-AGENTS AI Operations API",
        "version": "5.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)
