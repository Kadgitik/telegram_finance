import logging
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.app.services.auth import get_telegram_id_from_init_data

_LOGGER = logging.getLogger(__name__)

def get_user_key(request: Request) -> str:
    # Try to get telegram_id from Authorization header securely
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("tma "):
        init_data = auth[4:].strip()
        try:
            # Quickly validate HMAC to prevent forged IDs from bypassing limits.
            # If valid, use the authenticated user's ID as the rate limit key.
            uid = get_telegram_id_from_init_data(init_data)
            return f"user:{uid}"
        except Exception:
            # If signature is invalid or expired, fallback to IP address
            # to rate-limit malicious traffic without filling RAM with fake keys.
            pass
            
    # Fallback to remote IP address for unauthenticated requests or invalid tokens
    return get_remote_address(request)

# In-memory rate limiting
limiter = Limiter(key_func=get_user_key)

