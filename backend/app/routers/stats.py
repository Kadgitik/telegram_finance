from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from backend.app.deps import telegram_user_id
from backend.app.services.periods import human_period, month_window_from_key, resolve_pay_day
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("/balance")
async def balance(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
) -> dict:
    pd = await resolve_pay_day(db, telegram_id, pay_day, month)
    try:
        start, end_excl, month_key = month_window_from_key(month, pd)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    rows = await (
        db["transactions"]
        .aggregate(
            [
                {
                    "$match": {
                        "telegram_id": telegram_id,
                        "created_at": {"$gte": start, "$lt": end_excl},
                    }
                },
                {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
            ]
        )
        .to_list(length=None)
    )
    income = 0.0
    expense = 0.0
    for row in rows:
        if row["_id"] == "income":
            income = float(row["total"])
        if row["_id"] == "expense":
            expense = float(row["total"])
    balance_val = income - expense

    prev_start = start - timedelta(days=31)
    prev_key = f"{prev_start.year}-{prev_start.month:02d}"
    prev_from, prev_to, _ = month_window_from_key(prev_key, pd)
    prev_rows = await (
        db["transactions"]
        .aggregate(
            [
                {
                    "$match": {
                        "telegram_id": telegram_id,
                        "type": "expense",
                        "created_at": {"$gte": prev_from, "$lt": prev_to},
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
            ]
        )
        .to_list(length=None)
    )
    prev_expense = float(prev_rows[0]["total"]) if prev_rows else 0.0

    if prev_expense > 0:
        change = ((expense - prev_expense) / prev_expense) * 100.0
    elif expense > 0:
        change = 100.0
    else:
        change = 0.0

    return {
        "month": month_key,
        "month_key": month_key,
        "pay_day": pd,
        "period_label": human_period(start, end_excl),
        "income": income,
        "expense": expense,
        "balance": balance_val,
        "prev_month_expense": prev_expense,
        "change_percent": round(change, 1),
    }


@router.get("/stats")
async def stats(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    period: str = Query("month", pattern="^(week|month|3months|year)$"),
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
) -> dict:
    if period == "week":
        start, end = queries.period_week()
        rows = await queries.get_expense_stats(
            db, telegram_id, start, end, end_inclusive=True
        )
        return _stats_body(period, rows, start, end)
    if period == "month":
        pd = await resolve_pay_day(db, telegram_id, pay_day, month)
        try:
            start, end_excl, _month_key = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        rows = await queries.get_expense_stats(
            db, telegram_id, start, end_excl, end_inclusive=False
        )
        body = _stats_body(period, rows, start, end_excl)
        body["month"] = _month_key
        body["pay_day"] = pd
        body["period_label"] = human_period(start, end_excl)
        body["budget_summary"] = await _budget_summary(db, telegram_id, start, end_excl)
        return body
    if period == "3months":
        start, end = queries.period_three_months()
        rows = await queries.get_expense_stats(
            db, telegram_id, start, end, end_inclusive=True
        )
        return _stats_body(period, rows, start, end)
    start, end = queries.period_year()
    rows = await queries.get_expense_stats(
        db, telegram_id, start, end, end_inclusive=True
    )
    return _stats_body(period, rows, start, end)


def _stats_body(
    period: str,
    rows: list,
    start: datetime,
    end: datetime,
) -> dict:
    total = sum(float(r["total"]) for r in rows)
    count = sum(int(r["count"]) for r in rows)
    categories_out = []
    for r in rows:
        name = r["_id"] or "❓ Інше"
        amt = float(r["total"])
        pct = (amt / total * 100.0) if total else 0.0
        categories_out.append(
            {
                "name": name,
                "amount": amt,
                "percent": round(pct, 1),
                "count": int(r["count"]),
            }
        )
    return {
        "period": period,
        "total": total,
        "count": count,
        "average": round(total / count, 1) if count else 0.0,
        "categories": categories_out,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


@router.get("/stats/trend")
async def stats_trend(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    days: int = Query(30, ge=7, le=90),
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
) -> dict:
    if month:
        pd = await resolve_pay_day(db, telegram_id, pay_day, month)
        try:
            start, end, _ = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    else:
        end = datetime.now(timezone.utc)
        start = end.replace(hour=0, minute=0, second=0, microsecond=0)
        start = start - timedelta(days=days - 1)
    rows = await queries.get_daily_expense_series(
        db, telegram_id, start, end, end_inclusive=True
    )
    return {
        "points": [{"date": r["_id"], "amount": float(r["total"])} for r in rows],
    }


@router.get("/export/csv", response_class=PlainTextResponse)
async def export_csv(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
) -> PlainTextResponse:
    if month:
        pd = await resolve_pay_day(db, telegram_id, pay_day, month)
        try:
            start, end_excl, _ = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        rows = await (
            db["transactions"]
            .find({"telegram_id": telegram_id, "created_at": {"$gte": start, "$lt": end_excl}})
            .sort("created_at", -1)
            .to_list(length=None)
        )
    else:
        rows = await queries.export_transactions_csv_rows(db, telegram_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["created_at", "type", "amount", "category", "comment"])
    for r in rows:
        w.writerow(
            [
                r.get("created_at", "").isoformat()
                if hasattr(r.get("created_at"), "isoformat")
                else r.get("created_at"),
                r.get("type"),
                r.get("amount"),
                r.get("category"),
                r.get("comment"),
            ]
        )
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="transactions.csv"',
        },
    )


async def _budget_summary(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    start: datetime,
    end_excl: datetime,
) -> dict[str, Any]:
    user = await db["users"].find_one({"telegram_id": telegram_id}, {"budgets": 1})
    budgets = ((user or {}).get("budgets") or {}).copy()
    total_limit = float(sum(float(v) for v in budgets.values())) if budgets else 0.0
    spent_rows = await (
        db["transactions"]
        .aggregate(
            [
                {
                    "$match": {
                        "telegram_id": telegram_id,
                        "type": "expense",
                        "created_at": {"$gte": start, "$lt": end_excl},
                    }
                },
                {"$group": {"_id": "$category", "spent": {"$sum": "$amount"}}},
            ]
        )
        .to_list(length=None)
    )
    spent_by_cat = {r["_id"]: float(r["spent"]) for r in spent_rows}
    total_spent = float(sum(spent_by_cat.get(k, 0.0) for k in budgets.keys()))
    return {
        "total_limit": total_limit,
        "total_spent": total_spent,
        "total_percent": round((total_spent / total_limit) * 100, 1) if total_limit else 0.0,
    }
