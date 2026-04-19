from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.app.deps import telegram_user_id
from backend.app.limiter import limiter
from backend.app.models.schemas import CategoryCreate
from bot.db import queries
from bot.db.mongo import get_db

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.post("/categories", status_code=201)
@limiter.limit("15/minute")
async def create_category(
    body: CategoryCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    ok = await queries.add_custom_category(
        db, telegram_id,
        type_=body.type,
        key=body.key,
        icon=body.icon,
        color=body.color,
    )
    if not ok:
        raise HTTPException(400, "Не вдалося додати категорію")
    return {"ok": True}


@router.delete("/categories/{key}")
@limiter.limit("15/minute")
async def delete_category(
    key: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, bool]:
    ok = await queries.delete_custom_category(db, telegram_id, key)
    if not ok:
        raise HTTPException(404, "Категорію не знайдено")
    return {"ok": True}
