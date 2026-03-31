from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import SavingsCreate
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
    rows = await (
        db["savings"]
        .find({"telegram_id": telegram_id})
        .sort("created_at", -1)
        .to_list(length=300)
    )
    total = float(sum(float(x["amount"]) for x in rows))
    month_rows = await (
        db["savings"]
        .aggregate(
            [
                {"$match": {"telegram_id": telegram_id}},
                {
                    "$group": {
                        "_id": {
                            "$dateToString": {
                                "format": "%Y-%m",
                                "date": "$created_at",
                            }
                        },
                        "total": {"$sum": "$amount"},
                    }
                },
                {"$sort": {"_id": -1}},
                {"$limit": 12},
            ]
        )
        .to_list(length=None)
    )
    monthly = [{"month": r["_id"], "amount": float(r["total"])} for r in month_rows]
    return {"total": total, "monthly_breakdown": monthly, "history": [_out(x) for x in rows]}


@router.get("/savings/stats")
async def get_savings_stats(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    month_rows = await (
        db["savings"]
        .aggregate(
            [
                {"$match": {"telegram_id": telegram_id}},
                {
                    "$group": {
                        "_id": {
                            "$dateToString": {
                                "format": "%Y-%m",
                                "date": "$created_at",
                            }
                        },
                        "total": {"$sum": "$amount"},
                    }
                },
                {"$sort": {"_id": 1}},
                {"$limit": 12},
            ]
        )
        .to_list(length=None)
    )
    return {"monthly_breakdown": [{"month": r["_id"], "amount": float(r["total"])} for r in month_rows]}


@router.post("/savings", status_code=201)
async def add_savings(
    body: SavingsCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    doc = {
        "telegram_id": telegram_id,
        "amount": float(body.amount),
        "comment": body.comment.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db["savings"].insert_one(doc)
    saved = await db["savings"].find_one({"_id": res.inserted_id})
    assert saved
    return _out(saved)


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
    r = await db["savings"].delete_one({"_id": oid, "telegram_id": telegram_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Не знайдено")
    return {"ok": True}
