from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from starlette.requests import Request
from backend.app.limiter import limiter

from backend.app.deps import telegram_user_id
from backend.app.routers._common import tx_out as _tx_out
from backend.app.services.csrf import require_action_confirm
from backend.app.services.export_tokens import issue_export_token, verify_and_consume_export_token
from backend.app.services.periods import (
    financial_month_key_for_date,
    human_period,
    month_window_from_key,
    parse_month_key,
    resolve_pay_day,
)
from bot.db import queries
from bot.db.mongo import get_db
from bot.services.classifiers import INTERNAL_TRANSFER_RE
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()
_FX_CACHE: dict[str, Any] = {"rate": None, "updated_at": None}
_FX_TTL_SECONDS = 600


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.post("/me/fix-transfers")
@limiter.limit("2/minute")
async def fix_transfers(
    request: Request, telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    docs = await db["transactions"].find(
        {"telegram_id": telegram_id, "source": "monobank", "internal_transfer": {"$ne": True}}
    ).to_list(None)
    count = 0
    for d in docs:
        desc = d.get("description", "").strip()
        if INTERNAL_TRANSFER_RE.search(desc):
            await db["transactions"].update_one(
                {"_id": d["_id"]},
                {"$set": {"internal_transfer": True}}
            )
            count += 1
    return {"fixed": count}


@router.post("/me/clear-transactions", dependencies=[Depends(require_action_confirm)])
@limiter.limit("2/minute")
async def clear_transactions(
    request: Request, telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    """Delete all transactions for the calling user so they can re-sync from Monobank."""
    result = await db["transactions"].delete_many({"telegram_id": telegram_id})
    return {"deleted": result.deleted_count}


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

    # Get mono balance if connected (token itself not needed here)
    user = await queries.get_user(db, telegram_id, decrypt_token=False)
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
    # Bootstrap is the hottest path; we only need cached fields, not the token.
    user = await queries.get_user(db, telegram_id, decrypt_token=False) or {}

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


@router.post("/export/token")
@limiter.limit("10/minute")
async def export_token(
    request: Request, telegram_id: int = Depends(telegram_user_id),
) -> dict:
    """Issue a short-lived signed token so the SPA can trigger a CSV download
    via window.open without putting initData in the URL.
    """
    token, exp = issue_export_token(telegram_id)
    return {"token": token, "expires_at": exp}


@router.get("/export/csv", response_class=PlainTextResponse)
@limiter.limit("2/minute")
async def export_csv(
    request: Request,
    token: str = Query(..., min_length=10, max_length=200),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> PlainTextResponse:
    try:
        telegram_id = await verify_and_consume_export_token(db, token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    rows = await queries.export_transactions_csv_rows(db, telegram_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Дата", "Тип", "Джерело", "Сума", "Категорія", "Опис", "Коментар банку"])
    for r in rows:
        d = r.get("date") or r.get("created_at")
        d_str = ""
        if d:
            if hasattr(d, "strftime"):
                d_str = d.strftime("%Y-%m-%d %H:%M")
            else:
                d_str = str(d)
                
        type_str = "Дохід" if r.get("type") == "income" else "Витрата"
        source_str = "Monobank" if r.get("source") == "monobank" else "Готівка"
        
        w.writerow([
            d_str,
            type_str,
            source_str,
            r.get("amount"),
            r.get("category"),
            r.get("description"),
            r.get("comment"),
        ])
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions_export.csv"'},
    )


@router.get("/fx/usd-uah")
@limiter.limit("15/minute")
async def usd_uah_rate(request: Request, ) -> dict[str, Any]:
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
    data = None
    last_exc: Exception | None = None
    async with httpx.AsyncClient(timeout=6.0) as client:
        for attempt in range(3):
            try:
                resp = await client.get(
                    "https://api.privatbank.ua/p24api/pubinfo?exchange&coursid=11"
                )
                resp.raise_for_status()
                data = resp.json()
                break
            except (httpx.HTTPError, ValueError) as e:
                last_exc = e
                if attempt < 2:
                    await asyncio.sleep(0.3 * (attempt + 1))
    if data is None:
        raise HTTPException(502, f"Privatbank недоступний: {last_exc}")
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
