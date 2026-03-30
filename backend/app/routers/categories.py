from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import CategoryCreate
from bot.constants import DEFAULT_CATEGORIES, INCOME_CATEGORIES
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("/categories")
async def list_categories(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    expense = [{"label": k, "kind": "expense"} for k in DEFAULT_CATEGORIES]
    income = [{"label": k, "kind": "income"} for k in INCOME_CATEGORIES]
    custom = user.get("custom_categories") or [] if user else []
    custom_out = [{"label": c, "kind": "expense"} for c in custom]
    return {"expense_defaults": expense, "income": income, "custom": custom_out}


@router.post("/categories", status_code=201)
async def add_category(
    body: CategoryCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    label = body.label.strip()
    await queries.add_custom_category(db, telegram_id, label)
    return {"label": label}


@router.delete("/categories/{name}")
async def delete_category(
    name: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    label = unquote(name).strip()
    if not label:
        raise HTTPException(400, "Порожня категорія")
    await queries.remove_custom_category(db, telegram_id, label)
    return {"ok": True}
