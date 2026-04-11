from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import TransactionCreate
from backend.app.services.periods import month_window_from_key, resolve_pay_day
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _tx_out(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "source": doc.get("source", "cash"),
        "type": doc["type"],
        "amount": doc["amount"],
        "original_amount": doc.get("original_amount"),
        "currency_code": doc.get("currency_code"),
        "category": doc.get("category", "Інше"),
        "mcc": doc.get("mcc"),
        "description": doc.get("description", ""),
        "comment": doc.get("comment"),
        "cashback": doc.get("cashback", 0),
        "hold": doc.get("hold", False),
        "date": doc.get("date", doc.get("created_at", "")).isoformat()
        if hasattr(doc.get("date", doc.get("created_at", "")), "isoformat")
        else str(doc.get("date", "")),
    }


@router.post("/transactions", status_code=201)
async def create_transaction(
    body: TransactionCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    """Add a manual (cash) transaction."""
    # Idempotency: skip if same tx within 3 seconds
    now = datetime.now(timezone.utc)
    recent = await db["transactions"].find_one(
        {
            "telegram_id": telegram_id,
            "source": "cash",
            "type": body.type,
            "amount": float(body.amount),
            "category": body.category,
            "created_at": {"$gte": now - timedelta(seconds=3)},
        },
        sort=[("created_at", -1)],
    )
    if recent:
        return _tx_out(recent)

    oid = await queries.add_transaction(
        db, telegram_id,
        source="cash",
        type_=body.type,
        amount=body.amount,
        category=body.category,
        description=body.description,
        comment=body.comment or None,
    )
    doc = await queries.get_transaction(db, telegram_id, oid)
    assert doc
    return _tx_out(doc)


@router.get("/transactions")
async def list_transactions(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    tx_type: str | None = Query(None, alias="type"),
    category: str | None = None,
    source: str | None = None,
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    type_ = tx_type if tx_type in ("expense", "income") else None
    src = source if source in ("monobank", "cash") else None

    start_dt = None
    end_dt = None
    if month:
        pd = await resolve_pay_day(db, telegram_id, pay_day, month)
        try:
            start_dt, end_dt, _ = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    items = await queries.list_transactions(
        db, telegram_id,
        type_=type_, category=category, source=src,
        start=start_dt, end=end_dt, search=search,
        skip=offset, limit=limit,
    )
    total = await queries.count_transactions(
        db, telegram_id,
        type_=type_, category=category, source=src,
        start=start_dt, end=end_dt, search=search,
    )
    return {"items": [_tx_out(x) for x in items], "total": total}


@router.delete("/transactions/{tx_id}")
async def delete_transaction(
    tx_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, bool]:
    try:
        oid = ObjectId(tx_id)
    except InvalidId as e:
        raise HTTPException(400, "Невірний id") from e
    ok = await queries.delete_transaction(db, telegram_id, oid)
    if not ok:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}
