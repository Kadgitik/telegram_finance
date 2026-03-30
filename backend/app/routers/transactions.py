from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import TransactionCreate, TransactionUpdate
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
    month: int | None = None,
    year: int | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    type_ = tx_type if tx_type in ("expense", "income") else None
    items = await queries.list_transactions(
        db,
        telegram_id,
        type_=type_,
        category=category,
        year=year,
        month=month,
        search=search,
        skip=offset,
        limit=limit,
    )
    total = await queries.count_transactions_filtered(
        db,
        telegram_id,
        type_=type_,
        category=category,
        year=year,
        month=month,
        search=search,
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
