from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse

from backend.app.deps import telegram_user_id
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
    month: int | None = None,
    year: int | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    income, expense = await queries.balance_totals_month(db, telegram_id, y, m)
    balance_val = income - expense

    pm, py = (m - 1, y) if m > 1 else (12, y - 1)
    _, prev_expense = await queries.balance_totals_month(db, telegram_id, py, pm)

    if prev_expense > 0:
        change = ((expense - prev_expense) / prev_expense) * 100.0
    elif expense > 0:
        change = 100.0
    else:
        change = 0.0

    return {
        "month": f"{y}-{m:02d}",
        "month_key": f"{y}-{m:02d}",
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
) -> dict:
    if period == "week":
        start, end = queries.period_week()
        rows = await queries.get_expense_stats(
            db, telegram_id, start, end, end_inclusive=True
        )
        return _stats_body(period, rows, start, end)
    if period == "month":
        start, end_excl = queries.period_month_now()
        rows = await queries.get_expense_stats(
            db, telegram_id, start, end_excl, end_inclusive=False
        )
        return _stats_body(period, rows, start, end_excl)
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
) -> dict:
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
) -> PlainTextResponse:
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
