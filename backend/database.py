from supabase import create_client, Client
from config import settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        key = getattr(settings, "SUPABASE_PUBLISHABLE_KEY", None) or getattr(settings, "SUPABASE_SECRET_KEY", "")
        _supabase_client = create_client(settings.SUPABASE_URL, key)
    return _supabase_client
