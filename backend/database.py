import logging
from typing import Any
from config import settings

logger = logging.getLogger(__name__)


class SupabaseRestClient:
    """
    Robust Supabase PostgREST Client Wrapper.
    Supports both traditional JWT keys (anon / service_role) and modern
    Supabase publishable keys (sb_publishable_...) seamlessly without
    strict JWT decoding failures.
    """
    def __init__(self, url: str, key: str):
        from postgrest import SyncPostgrestClient
        self.url = url.rstrip("/")
        self.key = key
        self._client = SyncPostgrestClient(
            f"{self.url}/rest/v1",
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}"
            }
        )

    def table(self, table_name: str):
        return self._client.from_(table_name)

    def from_(self, table_name: str):
        return self._client.from_(table_name)


_supabase_client = None


def get_supabase() -> Any:
    global _supabase_client
    if _supabase_client is None:
        url = getattr(settings, "SUPABASE_URL", "https://wvzulyxzuntjnzdykstt.supabase.co")
        key = (
            getattr(settings, "SUPABASE_PUBLISHABLE_KEY", None)
            or getattr(settings, "SUPABASE_SECRET_KEY", None)
            or "sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm"
        )
        if not key or key.startswith("your_"):
            key = "sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm"

        # If key is standard JWT, try supabase SDK first, fallback to SupabaseRestClient
        if key.startswith("eyJ"):
            try:
                from supabase import create_client
                _supabase_client = create_client(url, key)
                return _supabase_client
            except Exception as e:
                logger.warning(f"supabase create_client failed, falling back to RestClient: {e}")

        _supabase_client = SupabaseRestClient(url, key)
    return _supabase_client
