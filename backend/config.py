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

    # Google Drive
    GOOGLE_DRIVE_FOLDER_ID: str = ""
    CONTRACT_TEMPLATE_ID: str = ""
    GOOGLE_DRIVE_VOICE_FOLDER_ID: str = ""

    class Config:
        env_file = "../.env"
        extra = "ignore"


settings = Settings()
