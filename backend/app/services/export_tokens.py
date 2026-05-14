"""Short-lived, single-use signed tokens for browser-initiated downloads.

Used so the SPA can stream a CSV download via fetch without leaking long-lived
Telegram initData through query strings. Tokens are:
  • signed (HMAC-SHA256, key derived from BOT_TOKEN)
  • short-lived (TTL=120s)
  • one-shot — verified-and-consumed atomically in Mongo

Token format: ``<telegram_id>.<exp_unix>.<jti>.<hmac_sha256_hex[:32]>``
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from motor.motor_asyncio import AsyncIOMotorDatabase

from bot import config

_TTL_SECONDS = 120


def _secret() -> bytes:
    raw = (config.BOT_TOKEN or "") + ":export-token"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """TTL index — Mongo auto-deletes spent nonces ~60s after `consumed_at`."""
    await db["export_nonces"].create_index("consumed_at", expireAfterSeconds=60)


def issue_export_token(telegram_id: int) -> tuple[str, int]:
    """Return (token, expires_at_unix)."""
    exp = int(time.time()) + _TTL_SECONDS
    jti = secrets.token_urlsafe(12)
    payload = f"{telegram_id}.{exp}.{jti}"
    return f"{payload}.{_sign(payload)}", exp


async def verify_and_consume_export_token(
    db: AsyncIOMotorDatabase, token: str
) -> int:
    """Return telegram_id if token is valid+unused+unexpired, else raise ValueError.
    Atomically marks the jti as consumed; second call with the same token fails.
    """
    if not token or token.count(".") != 3:
        raise ValueError("Invalid token format")
    tid_str, exp_str, jti, sig = token.split(".")
    try:
        telegram_id = int(tid_str)
        exp = int(exp_str)
    except ValueError as e:
        raise ValueError("Invalid token payload") from e
    if exp < int(time.time()):
        raise ValueError("Token expired")
    expected = _sign(f"{tid_str}.{exp_str}.{jti}")
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Bad signature")
    # Single-shot: insert jti; if it already exists, the token has been used.
    try:
        from datetime import datetime, timezone
        await db["export_nonces"].insert_one({
            "_id": jti,
            "telegram_id": telegram_id,
            "consumed_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            raise ValueError("Token already used") from e
        raise
    return telegram_id
