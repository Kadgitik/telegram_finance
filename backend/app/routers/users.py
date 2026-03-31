from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import PayDayOverrideUpsert, UserSettingsPatch
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
    overrides = user.get("pay_day_overrides") or {}
    return {
        "pay_day": int(user.get("pay_day", 1)),
        "currency": user.get("default_currency", "UAH"),
        "pay_day_overrides": {k: int(v) for k, v in overrides.items()},
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
        "pay_day_overrides": {
            k: int(v) for k, v in (user.get("pay_day_overrides") or {}).items()
        },
    }


@router.put("/users/pay-day-overrides/{month_key}")
async def upsert_pay_day_override(
    month_key: str,
    body: PayDayOverrideUpsert,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    if len(month_key) != 7 or month_key[4] != "-":
        raise HTTPException(400, "Очікується month_key у форматі YYYY-MM")
    try:
        year = int(month_key[:4])
        month = int(month_key[5:])
        if year < 2000 or month < 1 or month > 12:
            raise ValueError("bad month")
    except Exception as exc:
        raise HTTPException(400, "Очікується month_key у форматі YYYY-MM") from exc
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                f"pay_day_overrides.{month_key}": int(body.day),
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"telegram_id": telegram_id},
        },
        upsert=True,
    )
    return {"month": month_key, "day": int(body.day)}


@router.delete("/users/pay-day-overrides/{month_key}")
async def delete_pay_day_override(
    month_key: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$unset": {f"pay_day_overrides.{month_key}": ""},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    return {"ok": True}
