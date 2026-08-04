"""
app/api/v1/endpoints/auth.py
─────────────────────────────────────────────────────────────────
Simple single-user JWT authentication for the CAR-AGENTS portal.

Endpoints:
  POST /auth/login   → verify user_id + password, return JWT token
  GET  /auth/me      → verify token, return user info
─────────────────────────────────────────────────────────────────
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ─── Config ───────────────────────────────────────────────────────────────────

# Secret key for signing JWTs – read from env or use a default for local dev
JWT_SECRET = os.getenv("JWT_SECRET", "cars-ai-super-secret-key-2026-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72  # token valid for 3 days

# Single portal user credentials (stored as bcrypt hash)
# user_id: car01 | password: 12345678
PORTAL_USER_ID = "car01"
PORTAL_PASSWORD_HASH = "$2b$12$K8oGJkp9xQJpf9LU6JZy9OQFh6dQTiLXbN4VxlVQ5ZQJPZ6D3K7Gu"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """FastAPI dependency — validates Bearer token and returns user_id."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = _decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user_id

# ─── Request / Response models ────────────────────────────────────────────────

class LoginRequest(BaseModel):
    user_id: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    expires_in: int = JWT_EXPIRE_HOURS * 3600

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """
    Login with user_id + password.
    Returns a JWT access_token valid for 72 hours.
    """
    # Check user_id
    if body.user_id != PORTAL_USER_ID:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID or password")

    # Check password (try bcrypt first, fallback to plain-text comparison for simplicity)
    try:
        password_ok = _verify_password(body.password, PORTAL_PASSWORD_HASH)
    except Exception:
        password_ok = False

    # Plain-text fallback for the default credentials (easier for fresh installs)
    if not password_ok:
        password_ok = (body.password == "12345678" and body.user_id == "car01")

    if not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID or password")

    token = _create_token(PORTAL_USER_ID)
    return TokenResponse(access_token=token, user_id=PORTAL_USER_ID)


@router.get("/me")
async def get_me(current_user: str = Depends(get_current_user)):
    """Return authenticated user info."""
    return {
        "user_id": current_user,
        "role": "admin",
        "portal": "CAR-AGENTS"
    }
