from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_user_key(request: Request):
    # Try to get telegram_id from Authorization header
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("tma "):
        # Use the whole 'tma ...' string as the limit key.
        # It's unique per user and session.
        return auth
    return get_remote_address(request)

# In-memory rate limiting
limiter = Limiter(key_func=get_user_key)
