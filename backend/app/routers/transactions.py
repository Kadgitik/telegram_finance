from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import TransactionCreate, TransactionUpdate
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
        "type": doc["type"],
        "amount": doc["amount"],
        "category": doc.get("category"),
        "comment": doc.get("comment", ""),
        "created_at": doc["created_at"].isoformat(),
    }


@router.post("/transactions", status_code=201)
async def create_transaction(
    body: TransactionCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    oid = await queries.add_transaction(
        db,
        telegram_id,
        body.type,
        body.amount,
        body.category,
        body.comment,
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
    month: str | None = None,
    year: int | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    type_ = tx_type if tx_type in ("expense", "income") else None
    q: dict[str, Any] = {"telegram_id": telegram_id}
    if type_:
        q["type"] = type_
    if category:
        q["category"] = category
    if month:
        pd = await resolve_pay_day(db, telegram_id, pay_day)
        try:
            start, end_excl, _ = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        q["created_at"] = {"$gte": start, "$lt": end_excl}
    elif year is not None and month is None:
        # legacy fallback: year only without month key is ignored
        pass
    if search and search.strip():
        rx = {"$regex": search.strip(), "$options": "i"}
        q["$or"] = [{"comment": rx}, {"category": rx}]
    cur = (
        db["transactions"]
        .find(q)
        .sort("created_at", -1)
        .skip(max(0, offset))
        .limit(min(100, max(1, limit)))
    )
    items = await cur.to_list(length=None)
    total = await db["transactions"].count_documents(q)
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


@router.patch("/transactions/{tx_id}")
async def patch_transaction(
    tx_id: str,
    body: TransactionUpdate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    try:
        oid = ObjectId(tx_id)
    except InvalidId as e:
        raise HTTPException(400, "Невірний id") from e
    ok = await queries.update_transaction_fields(
        db,
        telegram_id,
        oid,
        type_=body.type,
        amount=body.amount,
        category=body.category,
        comment=body.comment,
    )
    if not ok:
        doc = await queries.get_transaction(db, telegram_id, oid)
        if not doc:
            raise HTTPException(404, "Не знайдено")
    doc = await queries.get_transaction(db, telegram_id, oid)
    assert doc
    return _tx_out(doc)
