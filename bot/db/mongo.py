from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from bot import config

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGODB_URI)
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
