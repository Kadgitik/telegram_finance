"""Per-category budgets (GET/PUT)."""

from typing import Any

from fastapi import APIRouter, Depends
from starlette.requests import Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.app.deps import telegram_user_id
from backend.app.limiter import limiter
from backend.app.models.schemas import BudgetUpdate
from bot.db import queries
from bot.db.mongo import get_db

router = APIRouter(prefix="/budgets")


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("")
async def get_budgets(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    user = await queries.get_user(db, telegram_id, decrypt_token=False) or {}
    budgets = user.get("budgets") or {}
    return {"budgets": budgets, "total": float(sum(budgets.values()))}


@router.put("")
@limiter.limit("15/minute")
async def put_budgets(
    request: Request, body: BudgetUpdate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    await queries.set_budgets(db, telegram_id, body.budgets)
    return {
        "ok": True,
        "budgets": body.budgets,
        "total": float(sum(body.budgets.values())),
    }
