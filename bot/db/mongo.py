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
    tx = db["transactions"]
    await tx.create_index([("telegram_id", 1), ("created_at", -1)])
    await tx.create_index([("telegram_id", 1), ("type", 1), ("created_at", -1)])
    savings = db["savings"]
    await savings.create_index([("telegram_id", 1), ("created_at", -1)])
    goals = db["goals"]
    await goals.create_index([("telegram_id", 1), ("created_at", -1)])
