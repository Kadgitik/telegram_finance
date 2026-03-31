from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import UserSettingsPatch
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("/users/settings")
async def get_settings(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await db["users"].find_one({"telegram_id": telegram_id}) or {}
    return {
        "pay_day": int(user.get("pay_day", 1)),
        "currency": user.get("default_currency", "UAH"),
    }


@router.patch("/users/settings")
async def patch_settings(
    body: UserSettingsPatch,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    patch: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.pay_day is not None:
        patch["pay_day"] = int(body.pay_day)
    if body.currency:
        patch["default_currency"] = body.currency.upper()
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": patch, "$setOnInsert": {"telegram_id": telegram_id}},
        upsert=True,
    )
    user = await db["users"].find_one({"telegram_id": telegram_id}) or {}
    return {
        "pay_day": int(user.get("pay_day", 1)),
        "currency": user.get("default_currency", "UAH"),
    }
