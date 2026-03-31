from __future__ import annotations

from datetime import datetime, timezone
from math import ceil

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import GoalContribute, GoalCreate, GoalPatch
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _parse_deadline(v: str | None) -> datetime | None:
    if not v:
        return None
    return datetime.fromisoformat(v).replace(tzinfo=timezone.utc)


def _goal_out(doc: dict) -> dict:
    current = float(doc.get("current_amount", 0.0))
    target = float(doc.get("target_amount", 0.0))
    percent = round((current / target) * 100, 1) if target else 0.0
    deadline = doc.get("deadline")
    days_left = None
    monthly_needed = None
    if deadline:
        now = datetime.now(timezone.utc)
        days = max(0, ceil((deadline - now).total_seconds() / 86400))
        days_left = days
        months_left = max(1, ceil(days / 30))
        monthly_needed = max(0.0, round((target - current) / months_left, 1))
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name"),
        "emoji": doc.get("emoji", "🎯"),
        "target_amount": target,
        "current_amount": current,
        "percent": percent,
        "deadline": deadline.date().isoformat() if deadline else None,
        "days_left": days_left,
        "monthly_needed": monthly_needed,
        "completed": bool(current >= target) or bool(doc.get("completed")),
        "contributions": [
            {"amount": float(x["amount"]), "date": x["date"].isoformat()}
            for x in doc.get("contributions", [])
        ],
        "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat(),
    }


@router.get("/goals")
async def list_goals(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    rows = await db["goals"].find({"telegram_id": telegram_id}).sort("created_at", -1).to_list(length=200)
    return {"items": [_goal_out(x) for x in rows]}


@router.get("/goals/{goal_id}")
async def get_goal(
    goal_id: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(goal_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
    row = await db["goals"].find_one({"_id": oid, "telegram_id": telegram_id})
    if not row:
        raise HTTPException(404, "Не знайдено")
    return _goal_out(row)


@router.post("/goals", status_code=201)
async def create_goal(
    body: GoalCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "telegram_id": telegram_id,
        "name": body.name.strip(),
        "emoji": body.emoji.strip() or "🎯",
        "target_amount": float(body.target_amount),
        "current_amount": 0.0,
        "deadline": _parse_deadline(body.deadline),
        "contributions": [],
        "created_at": now,
        "updated_at": now,
        "completed": False,
    }
    r = await db["goals"].insert_one(doc)
    saved = await db["goals"].find_one({"_id": r.inserted_id})
    assert saved
    return _goal_out(saved)


@router.patch("/goals/{goal_id}")
async def patch_goal(
    goal_id: str,
    body: GoalPatch,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(goal_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
    patch = {"updated_at": datetime.now(timezone.utc)}
    if body.name is not None:
        patch["name"] = body.name.strip()
    if body.emoji is not None:
        patch["emoji"] = body.emoji.strip() or "🎯"
    if body.target_amount is not None:
        patch["target_amount"] = float(body.target_amount)
    if body.deadline is not None:
        patch["deadline"] = _parse_deadline(body.deadline)
    r = await db["goals"].update_one({"_id": oid, "telegram_id": telegram_id}, {"$set": patch})
    if r.matched_count == 0:
        raise HTTPException(404, "Не знайдено")
    row = await db["goals"].find_one({"_id": oid, "telegram_id": telegram_id})
    assert row
    return _goal_out(row)


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
    r = await db["goals"].delete_one({"_id": oid, "telegram_id": telegram_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}


@router.post("/goals/{goal_id}/contribute")
async def contribute_goal(
    goal_id: str,
    body: GoalContribute,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    try:
        oid = ObjectId(goal_id)
    except InvalidId as exc:
        raise HTTPException(400, "Невірний id") from exc
    now = datetime.now(timezone.utc)
    row = await db["goals"].find_one({"_id": oid, "telegram_id": telegram_id})
    if not row:
        raise HTTPException(404, "Не знайдено")
    current = float(row.get("current_amount", 0.0)) + float(body.amount)
    target = float(row.get("target_amount", 0.0))
    await db["goals"].update_one(
        {"_id": oid, "telegram_id": telegram_id},
        {
            "$set": {"current_amount": current, "updated_at": now, "completed": current >= target},
            "$push": {"contributions": {"amount": float(body.amount), "date": now}},
        },
    )
    updated = await db["goals"].find_one({"_id": oid, "telegram_id": telegram_id})
    assert updated
    return _goal_out(updated)
