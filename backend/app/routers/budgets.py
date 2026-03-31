from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import BudgetCreate, BudgetPatch
from backend.app.services.periods import human_period, month_window_from_key, resolve_pay_day
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
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    budgets = {k: float(v) for k, v in ((user or {}).get("budgets") or {}).items()}
    pd = await resolve_pay_day(db, telegram_id, pay_day, month)
    start, end_excl, month_key = month_window_from_key(month, pd)
    spent_rows = await (
        db["transactions"]
        .aggregate(
            [
                {
                    "$match": {
                        "telegram_id": telegram_id,
                        "type": "expense",
                        "created_at": {"$gte": start, "$lt": end_excl},
                    }
                },
                {
                    "$group": {
                        "_id": "$category",
                        "spent": {"$sum": "$amount"},
                        "transactions_count": {"$sum": 1},
                    }
                },
            ]
        )
        .to_list(length=None)
    )
    spent_by_cat = {r["_id"]: {"spent": float(r["spent"]), "count": int(r["transactions_count"])} for r in spent_rows}
    out = []
    for category, limit in budgets.items():
        spent = spent_by_cat.get(category, {}).get("spent", 0.0)
        tx_count = spent_by_cat.get(category, {}).get("count", 0)
        percent = (spent / limit) * 100 if limit > 0 else 0.0
        out.append(
            {
                "category": category,
                "limit": limit,
                "spent": spent,
                "percent": round(percent, 1),
                "remaining": round(limit - spent, 2),
                "transactions_count": tx_count,
            }
        )
    total_limit = sum(x["limit"] for x in out)
    total_spent = sum(x["spent"] for x in out)
    return {
        "month": month_key,
        "pay_day": pd,
        "period_label": human_period(start, end_excl),
        "budgets": out,
        "total_limit": total_limit,
        "total_spent": total_spent,
        "total_percent": round((total_spent / total_limit) * 100, 1) if total_limit else 0.0,
    }


@router.post("/budgets", status_code=201)
async def save_budget(
    body: BudgetCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    amount = body.limit if body.limit is not None else body.amount
    if amount is None:
        raise HTTPException(400, "Потрібен limit або amount")
    await queries.set_budget(db, telegram_id, body.category.strip(), amount)
    return {"category": body.category.strip(), "limit": float(amount)}


@router.patch("/budgets/{category}")
async def patch_budget(
    category: str,
    body: BudgetPatch,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    cat = unquote(category).strip()
    if not cat:
        raise HTTPException(400, "Порожня категорія")
    amount = body.limit if body.limit is not None else body.amount
    if amount is None:
        raise HTTPException(400, "Потрібен limit або amount")
    await queries.set_budget(db, telegram_id, cat, amount)
    return {"category": cat, "limit": float(amount)}


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
