from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import leads, projects, communications, contracts, calendar, ocr, webhooks

app = FastAPI(
    title="CAR-AGENTS Operations API",
    description="Backend for the CAR-AGENTS broker operations portal.",
    version="4.0.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ROUTERS ──────────────────────────────────────────────────────────────────
app.include_router(leads.router)
app.include_router(projects.router)
app.include_router(communications.router)
app.include_router(contracts.router)
app.include_router(calendar.router)
app.include_router(ocr.router)
app.include_router(webhooks.router)


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": "4.0.0", "service": "CAR-AGENTS API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)
