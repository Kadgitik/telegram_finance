from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import SavingsCreate, GoalCreate, GoalDeposit
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "amount": float(doc["amount"]),
        "comment": doc.get("comment", ""),
        "created_at": doc["created_at"].isoformat(),
    }


@router.get("/savings")
async def get_savings(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    rows = await queries.list_savings(db, telegram_id, limit=200)
    total = await queries.savings_total(db, telegram_id)
    return {"total": total, "history": [_out(x) for x in rows]}


@router.post("/savings", status_code=201)
async def add_savings(
    body: SavingsCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    oid = await queries.add_saving(db, telegram_id, body.amount, body.comment)
    doc = await db["savings"].find_one({"_id": oid})
    assert doc
    return _out(doc)


@router.delete("/savings/{item_id}")
async def delete_savings(
    item_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(item_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
    ok = await queries.delete_saving(db, telegram_id, oid)
    if not ok:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}


def _goal_out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "target_amount": float(doc["target_amount"]),
        "current_amount": float(doc["current_amount"]),
        "created_at": doc["created_at"].isoformat(),
    }


@router.get("/goals")
async def get_goals(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    rows = await queries.list_goals(db, telegram_id)
    return {"items": [_goal_out(x) for x in rows]}


@router.post("/goals", status_code=201)
async def create_goal(
    body: GoalCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    oid = await queries.add_goal(db, telegram_id, body.name, body.target_amount)
    doc = await db["goals"].find_one({"_id": ObjectId(oid)})
    assert doc
    return _goal_out(doc)


@router.delete("/goals/{goal_id}")
async def delete_goal(
    goal_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(goal_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
    ok = await queries.delete_goal(db, telegram_id, oid)
    if not ok:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}


@router.post("/goals/{goal_id}/deposit")
async def deposit_goal(
    goal_id: str,
    body: GoalDeposit,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(goal_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
        
    ok = await queries.deposit_goal(db, telegram_id, oid, body.amount)
    if not ok:
        raise HTTPException(404, "Не знайдено")
    
    doc = await db["goals"].find_one({"_id": oid})
    return _goal_out(doc)
