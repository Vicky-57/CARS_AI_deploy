from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # Supabase (PostgreSQL Schema v3.0)
    SUPABASE_URL: str = "https://wvzulyxzuntjnzdykstt.supabase.co"
    SUPABASE_SECRET_KEY: str = "sb_secret_qM2kIa6iLOXbv_JAUEXNTA_YLbxemoo"

    # Telegram Master Agent
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # Microsoft Outlook 365 & Strato Email Integration
    OUTLOOK_ICS_URL: str = ""
    IMAP_HOST: str = "mail.strato.de"
    IMAP_PORT: int = 993
    IMAP_USER: str = "info@car-agents.de"
    IMAP_PASSWORD: str = ""
    SMTP_HOST: str = "smtp.strato.de"
    SMTP_PORT: int = 465
    SMTP_USER: str = "info@car-agents.de"
    SMTP_PASSWORD: str = ""

    # Anthropic Claude & Groq LLMs
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Meta WhatsApp Cloud API (Phase 2)
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    BRIEFING_WHATSAPP_RECIPIENT: str = ""
    BRIEFING_EMAIL_RECIPIENT: str = "info@car-agents.de"

    # Local AI Services
    WHISPER_MODEL_SIZE: str = "base"

    # Google OAuth2 (Strictly for Google Drive Cloud Storage)
    GOOGLE_CLIENT_ID: str = "84319482531-ucitebq3ohngvast159nrtklbu2mngq7.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "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"
    GOOGLE_REDIRECT_URI: str = "http://localhost:9000/api/v1/auth/google/callback"
    GOOGLE_AUTH_URI: str = "https://accounts.google.com/o/oauth2/auth"
    GOOGLE_TOKEN_URI: str = "https://oauth2.googleapis.com/token"
    GOOGLE_SCOPES: str = "openid email profile https://www.googleapis.com/auth/drive.file"

    class Config:
        env_file = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        ]
        extra = "ignore"


settings = Settings()
