"""
backend/main.py
─────────────────────────────────────────────────────────────────────────────
CAR-AGENTS Local AI Services Server — v5.0.0

Responsibilities after Frappe CRM integration:
  ✅ OCR document parsing   (client details + vehicle specs via Claude/Tesseract)
  ✅ Voice transcription    (Whisper via faster-whisper)
  ✅ Intent classification  (BUY/SELL intent via Claude/Llama)

  ❌ Leads / Contacts       → Now handled by Frappe CRM
  ❌ Projects / Deals       → Now handled by Frappe CRM
  ❌ Communications log     → Now handled by Frappe CRM
  ❌ Contracts generation   → Now handled by Frappe car_agents_crm
  ❌ Calendar / Meetings    → Now handled by Frappe CRM + Google/Outlook sync

This server is called by Frappe's car_agents_crm app via HTTP bridge.
─────────────────────────────────────────────────────────────────────────────
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import ocr
from routes.voice import router as voice_router
from routes.classify import router as classify_router

app = FastAPI(
    title="CAR-AGENTS Local AI Services",
    description="OCR extraction, voice transcription, and intent classification for CAR-AGENTS.",
    version="5.0.0",
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # React dev server
        "http://localhost:8080",   # Frappe CRM
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ROUTERS (only AI service routes remain) ──────────────────────────────────
app.include_router(ocr.router)           # /api/ocr/client-details  /api/ocr/vehicle-specs
app.include_router(voice_router)         # /api/voice/transcribe
app.include_router(classify_router)      # /classify-intent


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "version": "5.0.0",
        "service": "CAR-AGENTS Local AI Services",
        "endpoints": ["/api/ocr/client-details", "/api/ocr/vehicle-specs",
                      "/api/voice/transcribe", "/classify-intent"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)
