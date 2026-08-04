from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: str = ""

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""

    # Groq (Llama fallback)
    GROQ_API_KEY: str = ""

    # WhatsApp Cloud API
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    BRIEFING_WHATSAPP_RECIPIENT: str = ""

    # Email (Gmail / Custom IMAP & SMTP)
    IMAP_SERVER: str = "imap.gmail.com"
    IMAP_PORT: int = 993
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    BRIEFING_EMAIL_RECIPIENT: str = ""

    # Local AI services
    WHISPER_MODEL_SIZE: str = "base"

    # Google Calendar OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:9000/api/v1/auth/google/callback"
    GOOGLE_CALENDAR_ID: str = "primary"
    GOOGLE_AUTH_URI: str = "https://accounts.google.com/o/oauth2/auth"
    GOOGLE_TOKEN_URI: str = "https://oauth2.googleapis.com/token"
    GOOGLE_SCOPES: str = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy"

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        extra = "ignore"


settings = Settings()
