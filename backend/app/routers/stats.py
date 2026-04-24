from __future__ import annotations

import asyncio
import csv
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from backend.app.limiter import limiter

from backend.app.deps import telegram_user_id
from backend.app.services.periods import (
    financial_month_key_for_date,
    human_period,
    month_window_from_key,
    parse_month_key,
    resolve_pay_day,
)
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()
_FX_CACHE: dict[str, Any] = {"rate": None, "updated_at": None}
_FX_TTL_SECONDS = 600


def _db() -> AsyncIOMotorDatabase:
    return get_db()

_INTERNAL_RX = re.compile(
    r"^(З|Зі|На)\s+.*(картки|картку|карти|карту|банки|банку|рахунку|рахунок)"
    r"|^Переказ на картку"
    r"|^Переказ на карту"
    r"|^Поповнення картки"
    r"|^Поповнення карти"
    r"|^Між рахунками"
    r"|^Переказ між рахунками"
    r"|^На банку\b"
    r"|^З банки\b"
    r"|^Переказ$"
    r"|^Переказ коштів$",
    re.IGNORECASE,
)

@router.post("/admin/fix-transfers")
@limiter.limit("2/minute")
async def fix_transfers(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    docs = await db["transactions"].find(
        {"telegram_id": telegram_id, "source": "monobank", "internal_transfer": {"$ne": True}}
    ).to_list(None)
    count = 0
    for d in docs:
        desc = d.get("description", "").strip()
        if _INTERNAL_RX.search(desc):
            await db["transactions"].update_one(
                {"_id": d["_id"]},
                {"$set": {"internal_transfer": True}}
            )
            count += 1
    return {"fixed": count}


@router.post("/admin/clear-transactions")
@limiter.limit("2/minute")
async def clear_transactions(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    """Delete all transactions for the user so they can re-sync from Monobank."""
    result = await db["transactions"].delete_many({"telegram_id": telegram_id})
    return {"deleted": result.deleted_count}


def _tx_out(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "source": doc.get("source", "cash"),
        "type": doc["type"],
        "amount": doc["amount"],
        "original_amount": doc.get("original_amount"),
        "currency_code": doc.get("currency_code"),
        "category": doc.get("category", "Інше"),
        "mcc": doc.get("mcc"),
        "description": doc.get("description", ""),
        "comment": doc.get("comment"),
        "cashback": doc.get("cashback", 0),
        "hold": doc.get("hold", False),
        "date": doc.get("date", doc.get("created_at", "")).isoformat()
        if hasattr(doc.get("date", doc.get("created_at", "")), "isoformat")
        else str(doc.get("date", "")),
    }


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

    income, expense = await queries.balance_totals(db, telegram_id, start, end_excl)

    # Get mono balance if connected
    user = await queries.get_user(db, telegram_id)
    mono_balance = None
    if user and user.get("mono_accounts"):
        default_acc = user.get("default_account")
        for acc in user["mono_accounts"]:
            if acc.get("id") == default_acc or (not default_acc and acc.get("currency_code") == 980):
                mono_balance = acc.get("balance")
                break

    return {
        "month_key": month_key,
        "period_label": human_period(start, end_excl),
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "mono_balance": mono_balance,
    }


@router.get("/bootstrap")
async def bootstrap(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    month: str | None = None,
) -> dict[str, Any]:
    user = await queries.get_user(db, telegram_id) or {}

    month_param: str
    if not month or str(month).lower() == "auto":
        month_param = financial_month_key_for_date(datetime.now(timezone.utc), 1)
    else:
        month_param = str(month)
        try:
            parse_month_key(month_param)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    pd = await resolve_pay_day(db, telegram_id, month_key=month_param)
    try:
        start, end_excl, month_key = month_window_from_key(month_param, pd)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    tx_match: dict[str, Any] = {
        "telegram_id": telegram_id, 
        "date": {"$gte": start, "$lt": end_excl},
        "internal_transfer": {"$ne": True},
        "deleted": {"$ne": True},
        "$nor": [{"type": "income", "category": "Кредит"}],
    }

    async def _balance_agg():
        return await (
            db["transactions"]
            .aggregate([
                {"$match": tx_match},
                {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
            ])
            .to_list(length=None)
        )

    async def _tx_recent():
        return await (
            db["transactions"]
            .find({
                "telegram_id": telegram_id, 
                "date": {"$gte": start, "$lt": end_excl},
                "deleted": {"$ne": True},
                "internal_transfer": {"$ne": True},
            })
            .sort("date", -1)
            .limit(10)
            .to_list(length=None)
        )

    async def _stats():
        return await queries.get_expense_stats(
            db, telegram_id, start, end_excl, end_inclusive=False
        )

    async def _trend():
        return await queries.get_daily_expense_series(
            db, telegram_id, start, end_excl, end_inclusive=False
        )

    async def _savings_total():
        return await queries.savings_total(db, telegram_id)

    bal_rows, tx_rows, stats_rows, trend_rows, sav_total = await asyncio.gather(
        _balance_agg(), _tx_recent(), _stats(), _trend(), _savings_total(),
    )

    income = 0.0
    expense = 0.0
    for row in bal_rows:
        if row["_id"] == "income":
            income = float(row["total"])
        if row["_id"] == "expense":
            expense = float(row["total"])

    # Mono balance
    mono_balance = None
    if user.get("mono_accounts"):
        default_acc = user.get("default_account")
        for acc in user["mono_accounts"]:
            if acc.get("id") == default_acc or (not default_acc and acc.get("currency_code") == 980):
                mono_balance = acc.get("balance")
                break

    balance_data = {
        "month_key": month_key,
        "period_label": human_period(start, end_excl),
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "mono_balance": mono_balance,
    }

    transactions = {"items": [_tx_out(x) for x in tx_rows], "total": len(tx_rows)}
    stats_data = _stats_body("month", stats_rows, start, end_excl)
    trend_data = {"points": [{"date": r["_id"], "amount": float(r["total"])} for r in trend_rows]}

    mono_connected = bool(user.get("mono_token"))

    return {
        "month": month_key,
        "balance": balance_data,
        "transactions": transactions,
        "stats": stats_data,
        "trend": trend_data,
        "savings_total": sav_total,
        "mono_connected": mono_connected,
        "custom_categories": user.get("custom_categories", []),
    }


@router.get("/stats")
async def stats(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
    period: str = Query("month", pattern="^(week|month|3months|year|custom)$"),
    month: str | None = None,
    pay_day: int | None = Query(None, ge=1, le=28),
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    if period == "custom":
        if not start_date or not end_date:
            raise HTTPException(400, "start_date and end_date required for custom period")
        try:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            end_raw = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if end_raw.tzinfo is None:
                end_raw = end_raw.replace(tzinfo=timezone.utc)
            # Make end_date include the entire day
            end = end_raw + timedelta(days=1)
        except ValueError:
            raise HTTPException(400, "Invalid date format")
    elif period == "week":
        start, end = queries.period_week()
    elif period == "month":
        pd = await resolve_pay_day(db, telegram_id, pay_day, month)
        try:
            start, end, _ = month_window_from_key(month, pd)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    elif period == "3months":
        start, end = queries.period_three_months()
    else:
        start, end = queries.period_year()

    end_inclusive = period not in ("month", "custom")
    rows = await queries.get_expense_stats(
        db, telegram_id, start, end, end_inclusive=end_inclusive
    )
    body = _stats_body(period, rows, start, end)
    if period == "month" and month:
        body["month"] = month
        body["period_label"] = human_period(start, end)
    elif period == "custom":
        body["period_label"] = f"{start.strftime('%d.%m.%Y')} - {(end - timedelta(days=1)).strftime('%d.%m.%Y')}"
    return body


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
        name = r["_id"] or "Інше"
        amt = float(r["total"])
        pct = (amt / total * 100.0) if total else 0.0
        categories_out.append({
            "name": name,
            "amount": amt,
            "percent": round(pct, 1),
            "count": int(r["count"]),
        })
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
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    if start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            end_raw = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if end_raw.tzinfo is None:
                end_raw = end_raw.replace(tzinfo=timezone.utc)
            end = end_raw + timedelta(days=1)
        except ValueError:
            raise HTTPException(400, "Invalid date format")
    elif month:
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
@limiter.limit("2/minute")
async def export_csv(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> PlainTextResponse:
    rows = await queries.export_transactions_csv_rows(db, telegram_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "type", "source", "amount", "category", "mcc", "description", "comment"])
    for r in rows:
        d = r.get("date") or r.get("created_at")
        w.writerow([
            d.isoformat() if hasattr(d, "isoformat") else str(d),
            r.get("type"),
            r.get("source", "cash"),
            r.get("amount"),
            r.get("category"),
            r.get("mcc"),
            r.get("description"),
            r.get("comment"),
        ])
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
    )


@router.get("/fx/usd-uah")
@limiter.limit("15/minute")
async def usd_uah_rate() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    updated_at = _FX_CACHE.get("updated_at")
    if (
        _FX_CACHE.get("rate") is not None
        and isinstance(updated_at, datetime)
        and (now - updated_at).total_seconds() < _FX_TTL_SECONDS
    ):
        return {
            "pair": "USD/UAH",
            "rate": float(_FX_CACHE["rate"]),
            "source": "cache",
            "updated_at": updated_at.isoformat(),
        }
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.get(
            "https://api.privatbank.ua/p24api/pubinfo?exchange&coursid=11"
        )
        resp.raise_for_status()
        data = resp.json()
    usd = next((x for x in data if x.get("ccy") == "USD" and x.get("base_ccy") == "UAH"), None)
    if not usd:
        raise HTTPException(502, "Не вдалося отримати курс USD/UAH")
    buy = float(usd.get("buy", 0))
    sale = float(usd.get("sale", 0))
    if buy <= 0 or sale <= 0:
        raise HTTPException(502, "Некоректні дані курсу")
    rate = round((buy + sale) / 2, 4)
    _FX_CACHE["rate"] = rate
    _FX_CACHE["updated_at"] = now
    return {
        "pair": "USD/UAH",
        "rate": rate,
        "source": "privatbank",
        "updated_at": now.isoformat(),
    }
