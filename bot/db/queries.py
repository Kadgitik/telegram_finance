from __future__ import annotations

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
                "default_currency": "UAH",
                "custom_categories": [],
                "budgets": {},
                "created_at": now,
            },
        },
        upsert=True,
    )


async def get_user(db: AsyncIOMotorDatabase, telegram_id: int) -> dict[str, Any] | None:
    return await db["users"].find_one({"telegram_id": telegram_id})


async def add_transaction(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    type_: str,
    amount: float,
    category: str | None,
    comment: str,
) -> ObjectId:
    doc = {
        "telegram_id": telegram_id,
        "type": type_,
        "amount": float(amount),
        "category": category,
        "comment": comment.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    r = await db["transactions"].insert_one(doc)
    return r.inserted_id


async def get_transaction(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId
) -> dict[str, Any] | None:
    return await db["transactions"].find_one({"telegram_id": telegram_id, "_id": oid})


async def delete_transaction(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId
) -> bool:
    r = await db["transactions"].delete_one({"telegram_id": telegram_id, "_id": oid})
    return r.deleted_count > 0


async def update_transaction_category(
    db: AsyncIOMotorDatabase, telegram_id: int, oid: ObjectId, category: str
) -> bool:
    r = await db["transactions"].update_one(
        {"telegram_id": telegram_id, "_id": oid},
        {"$set": {"category": category}},
    )
    return r.modified_count > 0


async def balance_totals_month(
    db: AsyncIOMotorDatabase, telegram_id: int, year: int, month: int
) -> tuple[float, float]:
    cur = db["transactions"].aggregate(
        pipeline_balance_month(telegram_id, year, month)
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


async def get_history_page(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    cur = (
        db["transactions"]
        .find({"telegram_id": telegram_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return await cur.to_list(length=None)


async def count_transactions(db: AsyncIOMotorDatabase, telegram_id: int) -> int:
    return await db["transactions"].count_documents({"telegram_id": telegram_id})


async def list_transactions(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    type_: str | None = None,
    category: str | None = None,
    year: int | None = None,
    month: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[dict[str, Any]]:
    q: dict[str, Any] = {"telegram_id": telegram_id}
    if type_ in ("expense", "income"):
        q["type"] = type_
    if category:
        q["category"] = category
    if year is not None and month is not None:
        start, end_excl = month_range_utc(year, month)
        q["created_at"] = {"$gte": start, "$lt": end_excl}
    if search and search.strip():
        rx = {"$regex": search.strip(), "$options": "i"}
        q["$or"] = [{"comment": rx}, {"category": rx}]
    cur = (
        db["transactions"]
        .find(q)
        .sort("created_at", -1)
        .skip(max(0, skip))
        .limit(min(100, max(1, limit)))
    )
    return await cur.to_list(length=None)


async def count_transactions_filtered(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    type_: str | None = None,
    category: str | None = None,
    year: int | None = None,
    month: int | None = None,
    search: str | None = None,
) -> int:
    q: dict[str, Any] = {"telegram_id": telegram_id}
    if type_ in ("expense", "income"):
        q["type"] = type_
    if category:
        q["category"] = category
    if year is not None and month is not None:
        start, end_excl = month_range_utc(year, month)
        q["created_at"] = {"$gte": start, "$lt": end_excl}
    if search and search.strip():
        rx = {"$regex": search.strip(), "$options": "i"}
        q["$or"] = [{"comment": rx}, {"category": rx}]
    return await db["transactions"].count_documents(q)


async def update_transaction_fields(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    oid: ObjectId,
    *,
    type_: str | None = None,
    amount: float | None = None,
    category: str | None = None,
    comment: str | None = None,
) -> bool:
    patch: dict[str, Any] = {}
    if type_ in ("expense", "income"):
        patch["type"] = type_
    if amount is not None:
        patch["amount"] = float(amount)
    if category is not None:
        patch["category"] = category
    if comment is not None:
        patch["comment"] = comment.strip()
    if not patch:
        return False
    patch["updated_at"] = datetime.now(timezone.utc)
    r = await db["transactions"].update_one(
        {"telegram_id": telegram_id, "_id": oid},
        {"$set": patch},
    )
    return r.modified_count > 0


async def remove_budget(
    db: AsyncIOMotorDatabase, telegram_id: int, category_label: str
) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$unset": {f"budgets.{category_label}": ""},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )


async def add_custom_category(
    db: AsyncIOMotorDatabase, telegram_id: int, category_label: str
) -> None:
    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$addToSet": {"custom_categories": category_label},
            "$set": {"updated_at": now},
            "$setOnInsert": {
                "telegram_id": telegram_id,
                "default_currency": "UAH",
                "budgets": {},
                "created_at": now,
            },
        },
        upsert=True,
    )


async def remove_custom_category(
    db: AsyncIOMotorDatabase, telegram_id: int, category_label: str
) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$pull": {"custom_categories": category_label},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )


async def set_budget(
    db: AsyncIOMotorDatabase, telegram_id: int, category: str, amount: float
) -> None:
    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                f"budgets.{category}": float(amount),
                "updated_at": now,
            },
            "$setOnInsert": {
                "telegram_id": telegram_id,
                "default_currency": "UAH",
                "custom_categories": [],
                "created_at": now,
            },
        },
        upsert=True,
    )


async def export_transactions_csv_rows(
    db: AsyncIOMotorDatabase, telegram_id: int
) -> list[dict[str, Any]]:
    cur = db["transactions"].find({"telegram_id": telegram_id}).sort("created_at", -1)
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
