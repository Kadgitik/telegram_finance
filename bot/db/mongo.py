from __future__ import annotations

import logging
import re

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from bot import config

_LOGGER = logging.getLogger(__name__)
_client: AsyncIOMotorClient | None = None


def _mask_uri(uri: str) -> str:
    """Strip user:password@ from a Mongo URI so tracebacks don't leak creds."""
    return re.sub(r"://[^@/]+@", "://***:***@", uri or "")


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        try:
            _client = AsyncIOMotorClient(config.MONGODB_URI)
        except Exception as e:
            _LOGGER.error("Mongo client init failed (uri=%s): %s",
                          _mask_uri(config.MONGODB_URI), type(e).__name__)
            raise RuntimeError("MongoDB connection unavailable") from None
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[config.MONGODB_DB]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    users = db["users"]
    await users.create_index("telegram_id", unique=True)
    await users.create_index("mono_accounts.id", sparse=True)

    tx = db["transactions"]
    await tx.create_index([("telegram_id", 1), ("date", -1)])
    await tx.create_index([("telegram_id", 1), ("type", 1), ("date", -1)])
    # Stats by-category & filtered list queries.
    await tx.create_index(
        [("telegram_id", 1), ("category", 1), ("date", -1)],
        name="tx_by_user_category_date",
    )
    # Mono webhook lookup by mono_id is already covered by unique_mono_tx.
    try:
        await tx.create_index(
            [("telegram_id", 1), ("mono_id", 1)],
            unique=True,
            partialFilterExpression={"mono_id": {"$type": "string"}},
            name="unique_mono_tx",
        )
    except Exception:
        # If parameters changed, drop and recreate
        try:
            await tx.drop_index("unique_mono_tx")
            await tx.create_index(
                [("telegram_id", 1), ("mono_id", 1)],
                unique=True,
                partialFilterExpression={"mono_id": {"$type": "string"}},
                name="unique_mono_tx",
            )
        except Exception:
            pass

    savings = db["savings"]
    await savings.create_index([("telegram_id", 1), ("created_at", -1)])

    # TTL index for single-use export tokens.
    from backend.app.services.export_tokens import ensure_indexes as _export_idx
    await _export_idx(db)
