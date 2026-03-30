from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import BudgetCreate
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("/budgets")
async def list_budgets(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    budgets = (user or {}).get("budgets") or {}
    return {"budgets": {k: float(v) for k, v in budgets.items()}}


@router.post("/budgets", status_code=201)
async def save_budget(
    body: BudgetCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    await queries.set_budget(db, telegram_id, body.category.strip(), body.amount)
    return {"category": body.category.strip(), "amount": body.amount}


@router.delete("/budgets/{category}")
async def delete_budget(
    category: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    cat = unquote(category).strip()
    if not cat:
        raise HTTPException(400, "Порожня категорія")
    await queries.remove_budget(db, telegram_id, cat)
    return {"ok": True}
