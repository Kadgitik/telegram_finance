from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.limiter import limiter
from backend.app.models.schemas import DebtCreate
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _debt_out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "type": doc["type"],
        "contact": doc["contact"],
        "amount": float(doc["amount"]),
        "comment": doc.get("comment", ""),
        "original_amount": float(doc["original_amount"]) if "original_amount" in doc else None,
        "original_currency": doc.get("original_currency"),
        "resolved": doc.get("resolved", False),
        "created_at": doc["created_at"].isoformat(),
    }


@router.get("/debts")
async def get_debts(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    rows = await queries.list_debts(db, telegram_id)
    return {"items": [_debt_out(x) for x in rows]}


@router.post("/debts", status_code=201)
@limiter.limit("15/minute")
async def create_debt(
    request: Request, body: DebtCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    oid_str = await queries.add_debt(
        db, telegram_id, body.type, body.contact, body.amount, body.comment, body.original_amount, body.original_currency
    )
    doc = await db["debts"].find_one({"_id": ObjectId(oid_str)})
    assert doc
    return _debt_out(doc)


@router.post("/debts/{item_id}/resolve")
@limiter.limit("15/minute")
async def resolve_debt_endpoint(
    request: Request, item_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(item_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc

    ok = await queries.resolve_debt(db, telegram_id, oid)
    if not ok:
        raise HTTPException(404, "Не знайдено")
        
    doc = await db["debts"].find_one({"_id": oid})
    return _debt_out(doc)


@router.delete("/debts/{item_id}")
@limiter.limit("15/minute")
async def delete_debt_endpoint(
    request: Request, item_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(item_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
        
    ok = await queries.delete_debt(db, telegram_id, oid)
    if not ok:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}
