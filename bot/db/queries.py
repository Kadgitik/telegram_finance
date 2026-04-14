from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db.mongo import get_db
from bot.db.pipelines import (
    month_range_utc,
    pipeline_balance_month,
    pipeline_daily_expense_totals,
    pipeline_stats_expense_by_category,
)
from backend.app.services.security import security_service


# ── Users ──────────────────────────────────────────────────────────────

async def upsert_user(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
) -> None:
    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "username": username,
                "first_name": first_name,
                "updated_at": now,
            },
            "$setOnInsert": {
                "telegram_id": telegram_id,
                "mono_token": None,
                "mono_client_id": None,
                "mono_accounts": [],
                "mono_webhook_set": False,
                "default_account": None,
                "created_at": now,
            },
        },
        upsert=True,
    )


async def get_user(db: AsyncIOMotorDatabase, telegram_id: int) -> dict[str, Any] | None:
    user = await db["users"].find_one({"telegram_id": telegram_id})
    if user and user.get("mono_token"):
        user["mono_token"] = security_service.decrypt_token(user["mono_token"])
    return user


async def set_mono_token(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    token: str,
    client_id: str | None = None,
    accounts: list | None = None,
    jars: list | None = None,
) -> None:
    update: dict[str, Any] = {
        "mono_token": security_service.encrypt_token(token) if token else None,
        "updated_at": datetime.now(timezone.utc),
    }
    if client_id is not None:
        update["mono_client_id"] = client_id
    if accounts is not None:
        update["mono_accounts"] = accounts
    if jars is not None:
        update["mono_jars"] = jars
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": update},
    )


async def set_mono_webhook_status(
    db: AsyncIOMotorDatabase, telegram_id: int, status: bool
) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": {"mono_webhook_set": status, "updated_at": datetime.now(timezone.utc)}},
    )


async def set_default_account(
    db: AsyncIOMotorDatabase, telegram_id: int, account_id: str
) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": {"default_account": account_id, "updated_at": datetime.now(timezone.utc)}},
    )


async def disconnect_mono(db: AsyncIOMotorDatabase, telegram_id: int) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "mono_token": None,
                "mono_client_id": None,
                "mono_accounts": [],
                "mono_jars": [],
                "mono_webhook_set": False,
                "default_account": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )


# ── Transactions ───────────────────────────────────────────────────────

async def add_transaction(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    source: str,
    type_: str,
    amount: float,
    category: str,
    description: str = "",
    comment: str | None = None,
    mono_id: str | None = None,
    original_amount: float | None = None,
    currency_code: int | str | None = None,
    mcc: int | None = None,
    cashback: float = 0.0,
    balance_after: float | None = None,
    hold: bool = False,
    date: datetime | None = None,
) -> ObjectId:
    doc = {
        "telegram_id": telegram_id,
        "source": source,
        "type": type_,
        "amount": float(amount),
        "original_amount": original_amount,
        "currency_code": currency_code,
        "category": category,
        "mcc": mcc,
        "description": description.strip() if description else "",
        "comment": comment.strip() if comment else None,
        "cashback": cashback,
        "balance_after": balance_after,
        "hold": hold,
        "date": date or datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    if mono_id is not None:
        doc["mono_id"] = mono_id
    r = await db["transactions"].insert_one(doc)
    return r.inserted_id


async def upsert_mono_transaction(
    db: AsyncIOMotorDatabase, doc: dict[str, Any]
) -> bool:
    """Insert or update a Monobank transaction. Returns True if new."""
    existing = await db["transactions"].find_one({
        "telegram_id": doc["telegram_id"],
        "mono_id": doc["mono_id"],
    })
    if existing:
        # If user deleted this transaction, respect the deletion — skip update
        if existing.get("deleted"):
            return False
        await db["transactions"].update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "hold": doc["hold"],
                "balance_after": doc["balance_after"],
                "amount": doc["amount"],
                # Re-evaluate internal_transfer flag on every sync
                "internal_transfer": doc.get("internal_transfer", False),
            }},
        )
        return False
    await db["transactions"].insert_one(doc)
    return True


async def get_transaction(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId
) -> dict[str, Any] | None:
    return await db["transactions"].find_one({"telegram_id": telegram_id, "_id": oid})


async def delete_transaction(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId
) -> bool:
    r = await db["transactions"].update_one(
        {"telegram_id": telegram_id, "_id": oid},
        {"$set": {"deleted": True}}
    )
    return r.modified_count > 0


async def list_transactions(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    type_: str | None = None,
    category: str | None = None,
    source: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[dict[str, Any]]:
    q: dict[str, Any] = {"telegram_id": telegram_id, "deleted": {"$ne": True}, "internal_transfer": {"$ne": True}}
    if type_ in ("expense", "income"):
        q["type"] = type_
    if category:
        q["category"] = category
    if source in ("monobank", "cash"):
        q["source"] = source
    if start or end:
        date_q: dict[str, Any] = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lt"] = end
        q["date"] = date_q
    if search and search.strip():
        # re.escape захищає від regex-injection / ReDoS у Mongo $regex.
        safe = re.escape(search.strip())[:100]
        rx = {"$regex": safe, "$options": "i"}
        q["$or"] = [{"description": rx}, {"comment": rx}, {"category": rx}]
    cur = (
        db["transactions"]
        .find(q)
        .sort("date", -1)
        .skip(max(0, skip))
        .limit(min(100, max(1, limit)))
    )
    return await cur.to_list(length=None)


async def count_transactions(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    type_: str | None = None,
    category: str | None = None,
    source: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    search: str | None = None,
) -> int:
    q: dict[str, Any] = {"telegram_id": telegram_id, "deleted": {"$ne": True}, "internal_transfer": {"$ne": True}}
    if type_ in ("expense", "income"):
        q["type"] = type_
    if category:
        q["category"] = category
    if source in ("monobank", "cash"):
        q["source"] = source
    if start or end:
        date_q: dict[str, Any] = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lt"] = end
        q["date"] = date_q
    if search and search.strip():
        safe = re.escape(search.strip())[:100]
        rx = {"$regex": safe, "$options": "i"}
        q["$or"] = [{"description": rx}, {"comment": rx}, {"category": rx}]
    return await db["transactions"].count_documents(q)


async def get_expense_stats(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    start: datetime,
    end: datetime,
    *,
    end_inclusive: bool = False,
) -> list[dict[str, Any]]:
    cur = db["transactions"].aggregate(
        pipeline_stats_expense_by_category(
            telegram_id, start, end, end_inclusive=end_inclusive
        )
    )
    return await cur.to_list(length=None)


async def get_daily_expense_series(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    start: datetime,
    end: datetime,
    *,
    end_inclusive: bool = False,
) -> list[dict[str, Any]]:
    cur = db["transactions"].aggregate(
        pipeline_daily_expense_totals(
            telegram_id, start, end, end_inclusive=end_inclusive
        )
    )
    return await cur.to_list(length=None)


async def balance_totals(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    start: datetime,
    end_excl: datetime,
) -> tuple[float, float]:
    cur = db["transactions"].aggregate(
        pipeline_balance_month(telegram_id, start, end_excl)
    )
    rows = await cur.to_list(length=None)
    income = 0.0
    expense = 0.0
    for row in rows:
        if row["_id"] == "income":
            income = float(row["total"])
        elif row["_id"] == "expense":
            expense = float(row["total"])
    return income, expense


# ── Savings ────────────────────────────────────────────────────────────

async def add_saving(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    amount: float,
    comment: str = "",
    original_amount: float | None = None,
    original_currency: str | None = None,
) -> ObjectId:
    doc = {
        "telegram_id": telegram_id,
        "amount": float(amount),
        "comment": comment.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    if original_amount is not None:
        doc["original_amount"] = float(original_amount)
    if original_currency is not None:
        doc["original_currency"] = original_currency
    r = await db["savings"].insert_one(doc)
    return r.inserted_id


async def list_savings(
    db: AsyncIOMotorDatabase, telegram_id: int, limit: int = 100
) -> list[dict[str, Any]]:
    cur = (
        db["savings"]
        .find({"telegram_id": telegram_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return await cur.to_list(length=None)


async def savings_total(db: AsyncIOMotorDatabase, telegram_id: int) -> float:
    rows = await (
        db["savings"]
        .aggregate([
            {"$match": {"telegram_id": telegram_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ])
        .to_list(length=1)
    )
    return float(rows[0]["total"]) if rows else 0.0


async def delete_saving(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId
) -> bool:
    r = await db["savings"].delete_one({"_id": oid, "telegram_id": telegram_id})
    return r.deleted_count > 0


# ── Export ─────────────────────────────────────────────────────────────

async def export_transactions_csv_rows(
    db: AsyncIOMotorDatabase, telegram_id: int
) -> list[dict[str, Any]]:
    cur = db["transactions"].find({
        "telegram_id": telegram_id,
        "deleted": {"$ne": True},
        "internal_transfer": {"$ne": True},
    }).sort("date", -1)
    return await cur.to_list(length=None)


# ── Helpers ────────────────────────────────────────────────────────────

def period_week() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    return start, end


def period_month_now() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    return month_range_utc(end.year, end.month)


def period_three_months() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=90)
    return start, end


def period_year() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = datetime(end.year, 1, 1, tzinfo=timezone.utc)
    return start, end


def default_db() -> AsyncIOMotorDatabase:
    return get_db()
    

async def list_goals(db: AsyncIOMotorDatabase, telegram_id: int) -> list[dict[str, Any]]:
    return await db["goals"].find({"telegram_id": telegram_id}).sort("created_at", -1).to_list(length=None)

async def add_goal(db: AsyncIOMotorDatabase, telegram_id: int, name: str, target: float) -> str:
    from bot.db.mongo import get_db
    doc = {
        "telegram_id": telegram_id,
        "name": name,
        "target_amount": target,
        "current_amount": 0.0,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db["goals"].insert_one(doc)
    return str(r.inserted_id)

async def delete_goal(db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId) -> bool:
    r = await db["goals"].delete_one({"telegram_id": telegram_id, "_id": oid})
    return r.deleted_count > 0

async def deposit_goal(db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId, amount: float) -> bool:
    r = await db["goals"].update_one(
        {"telegram_id": telegram_id, "_id": oid},
        {"$inc": {"current_amount": amount}}
    )
    return r.modified_count > 0

# ── Debts ──────────────────────────────────────────────────────────────

async def list_debts(db: AsyncIOMotorDatabase, telegram_id: int) -> list[dict[str, Any]]:
    return await db["debts"].find({"telegram_id": telegram_id}).sort("created_at", -1).to_list(length=None)

async def add_debt(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    type_: str,
    contact: str,
    amount: float,
    comment: str = "",
    original_amount: float | None = None,
    original_currency: str | None = None,
) -> str:
    doc = {
        "telegram_id": telegram_id,
        "type": type_,
        "contact": contact,
        "amount": amount,
        "comment": comment,
        "resolved": False,
        "created_at": datetime.now(timezone.utc),
    }
    if original_amount is not None:
        doc["original_amount"] = float(original_amount)
    if original_currency is not None:
        doc["original_currency"] = original_currency
    r = await db["debts"].insert_one(doc)
    return str(r.inserted_id)

async def resolve_debt(db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId) -> bool:
    r = await db["debts"].update_one(
        {"telegram_id": telegram_id, "_id": oid},
        {"$set": {"resolved": True}}
    )
    return r.modified_count > 0

async def delete_debt(db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId) -> bool:
    r = await db["debts"].delete_one({"telegram_id": telegram_id, "_id": oid})
    return r.deleted_count > 0
