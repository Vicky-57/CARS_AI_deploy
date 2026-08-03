"""
backend/main.py — CAR-AGENTS Production FastAPI Backend v5.0
─────────────────────────────────────────────────────────────
Modular FastAPI system providing:
  ✅ OCR Document & Fahrzeugdatenträger Spec Extraction
  ✅ Whisper Audio Transcription & Voice Action Extraction
  ✅ AI Intent Classification (BUY_INTENT / SELL_INTENT)
  ✅ 1-Click PDF Contract Pre-filling (4 Templates)
  ✅ Net Broker Profit & Investment Financial Calculator
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router

app = FastAPI(
    title="CAR-AGENTS AI Operations API",
    description="Automated AI services, OCR document parsing, contract pre-filling, and financial calculations for CAR-AGENTS.",
    version="5.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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

# ─── Also include legacy route aliases for backward compatibility ─────────────
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
