from __future__ import annotations
import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request

from backend.app.deps import telegram_user_id
from backend.app.limiter import limiter
from backend.app.models.schemas import SavingsCreate, GoalCreate, GoalDeposit
from backend.app.routers._common import (
    KOPECKS_PER_UAH,
    MONO_REFRESH_COOLDOWN_SEC,
    track_bg_task,
)
from bot.db import queries
from bot.db.mongo import get_db
from bot.services import monobank
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

_LOGGER = logging.getLogger(__name__)

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "amount": float(doc["amount"]),
        "comment": doc.get("comment", ""),
        "original_amount": float(doc["original_amount"]) if "original_amount" in doc else None,
        "original_currency": doc.get("original_currency"),
        "created_at": doc["created_at"].isoformat(),
    }

async def _refresh_mono_bg(db: AsyncIOMotorDatabase, telegram_id: int, token: str) -> None:
    try:
        info = await monobank.get_client_info(token)
        accounts_out = [
            {
                "id": acc.get("id"),
                "type": acc.get("type"),
                "currency_code": acc.get("currencyCode"),
                "balance": (acc.get("balance") or 0) / KOPECKS_PER_UAH,
                "credit_limit": (acc.get("creditLimit") or 0) / KOPECKS_PER_UAH,
                "masked_pan": acc.get("maskedPan", []),
                "iban": acc.get("iban"),
                "cashback_type": acc.get("cashbackType"),
            }
            for acc in info.get("accounts", [])
        ]
        jars_out = [
            {
                "id": jar.get("id"),
                "title": jar.get("title", "Банка"),
                "description": jar.get("description", ""),
                "currency_code": jar.get("currencyCode"),
                "balance": (jar.get("balance") or 0) / KOPECKS_PER_UAH,
                "goal": (jar.get("goal") or 0) / KOPECKS_PER_UAH,
            }
            for jar in info.get("jars", [])
        ]
        await queries.set_mono_token(
            db, telegram_id, token,
            client_id=info.get("clientId"),
            accounts=accounts_out,
            jars=jars_out,
        )
    except Exception as e:
        _LOGGER.warning("Background mono refresh failed: %s", e)


def _schedule_mono_refresh(db: AsyncIOMotorDatabase, user: dict | None) -> None:
    """Kick off a non-blocking mono refresh if the cache is stale."""
    if not user:
        return
    token = user.get("mono_token")
    if not token:
        return

    synced_at = user.get("mono_synced_at")
    if synced_at:
        if synced_at.tzinfo is None:
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - synced_at).total_seconds() < MONO_REFRESH_COOLDOWN_SEC:
            return

    track_bg_task(asyncio.create_task(_refresh_mono_bg(db, user["telegram_id"], token)))




@router.get("/savings")
async def get_savings(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    rows = await queries.list_savings(db, telegram_id, limit=200)
    total = await queries.savings_total(db, telegram_id)
    
    user = await queries.get_user(db, telegram_id)
    _schedule_mono_refresh(db, user)
    mono_jars = user.get("mono_jars", []) if user else []

    mono_savings = []
    mono_total = 0.0
    for j in mono_jars:
        if not j.get("goal") or j.get("goal") <= 0:
            mono_savings.append({
                "id": j["id"],
                "name": j.get("title", "Банка"),
                "amount": j["balance"],
                "currency": j.get("currency_code")
            })
            mono_total += j["balance"]

    return {
        "total": total + mono_total,
        "manual_total": total,
        "mono_total": mono_total,
        "history": [_out(x) for x in rows],
        "mono_savings": mono_savings
    }


@router.post("/savings", status_code=201)
@limiter.limit("15/minute")
async def add_savings(
    request: Request, body: SavingsCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    oid = await queries.add_saving(db, telegram_id, body.amount, body.comment, body.original_amount, body.original_currency)
    doc = await db["savings"].find_one({"_id": oid})
    assert doc
    return _out(doc)


@router.delete("/savings/{item_id}")
@limiter.limit("15/minute")
async def delete_savings(
    request: Request, item_id: str,
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
    user = await queries.get_user(db, telegram_id)
    _schedule_mono_refresh(db, user)
    mono_jars = user.get("mono_jars", []) if user else []
    
    items = [_goal_out(x) for x in rows]
    
    for j in mono_jars:
        if j.get("goal") and j.get("goal") > 0:
            items.append({
                "id": j["id"],
                "name": j.get("title", "Банка"),
                "target_amount": float(j["goal"]),
                "current_amount": float(j["balance"]),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_mono": True
            })
            
    return {"items": items}


@router.post("/goals", status_code=201)
@limiter.limit("15/minute")
async def create_goal(
    request: Request, body: GoalCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    oid = await queries.add_goal(db, telegram_id, body.name, body.target_amount)
    doc = await db["goals"].find_one({"_id": ObjectId(oid)})
    assert doc
    return _goal_out(doc)


@router.delete("/goals/{goal_id}")
@limiter.limit("15/minute")
async def delete_goal(
    request: Request, goal_id: str,
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
@limiter.limit("15/minute")
async def deposit_goal(
    request: Request, goal_id: str,
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
