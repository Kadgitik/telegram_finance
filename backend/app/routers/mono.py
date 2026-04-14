"""Monobank API integration endpoints."""

from __future__ import annotations

import asyncio
import hmac
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import MonoConnectRequest, MonoSetDefaultAccount
from bot import config
from bot.db import queries
from bot.db.mongo import get_db
from bot.services import monobank
from bot.services.monobank import MonobankError, parse_statement_item
from motor.motor_asyncio import AsyncIOMotorDatabase

_LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/mono")


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.post("/connect")
async def connect_monobank(
    body: MonoConnectRequest,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    """Save Monobank token, fetch client info, set webhook."""
    try:
        info = await monobank.get_client_info(body.token)
    except MonobankError as e:
        raise HTTPException(400, f"Monobank: {e.description}") from e

    accounts = info.get("accounts", [])
    accounts_out = []
    for acc in accounts:
        accounts_out.append({
            "id": acc.get("id"),
            "type": acc.get("type"),
            "currency_code": acc.get("currencyCode"),
            "balance": acc.get("balance", 0) / 100.0,
            "credit_limit": acc.get("creditLimit", 0) / 100.0,
            "masked_pan": acc.get("maskedPan", []),
            "iban": acc.get("iban"),
            "cashback_type": acc.get("cashbackType"),
        })

    jars_out = []
    for jar in info.get("jars", []):
        jars_out.append({
            "id": jar.get("id"),
            "title": jar.get("title", "Банка"),
            "description": jar.get("description", ""),
            "currency_code": jar.get("currencyCode"),
            "balance": jar.get("balance", 0) / 100.0,
            "goal": jar.get("goal", 0) / 100.0,
        })

    await queries.set_mono_token(
        db, telegram_id, body.token,
        client_id=info.get("clientId"),
        accounts=accounts_out,
        jars=jars_out,
    )

    # Auto-select first UAH black account as default
    default_acc = None
    for acc in accounts_out:
        if acc["currency_code"] == 980 and acc["type"] == "black":
            default_acc = acc["id"]
            break
    if not default_acc and accounts_out:
        default_acc = accounts_out[0]["id"]
    if default_acc:
        await queries.set_default_account(db, telegram_id, default_acc)

    # Auto-subscribe webhook. Secret у шляху — захист від підробки ззовні.
    webhook_url = f"{config.WEBHOOK_BASE_URL}/api/mono/webhook/{config.MONO_WEBHOOK_SECRET}"
    try:
        await monobank.set_webhook(body.token, webhook_url)
        await queries.set_mono_webhook_status(db, telegram_id, True)
    except Exception as e:
        _LOGGER.error("Failed to auto-set mono webhook: %s", e)
        await queries.set_mono_webhook_status(db, telegram_id, False)

    return {
        "ok": True,
        "client_name": info.get("name"),
        "accounts": accounts_out,
        "default_account": default_acc,
    }


@router.post("/disconnect")
async def disconnect_monobank(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    await queries.disconnect_mono(db, telegram_id)
    return {"ok": True}


@router.get("/accounts")
async def get_accounts(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    if not user or not user.get("mono_token"):
        raise HTTPException(400, "Monobank не підключено")

    try:
        info = await monobank.get_client_info(user["mono_token"])
    except MonobankError as e:
        raise HTTPException(502, f"Monobank: {e.description}") from e

    accounts = []
    for acc in info.get("accounts", []):
        accounts.append({
            "id": acc.get("id"),
            "type": acc.get("type"),
            "currency_code": acc.get("currencyCode"),
            "balance": acc.get("balance", 0) / 100.0,
            "credit_limit": acc.get("creditLimit", 0) / 100.0,
            "masked_pan": acc.get("maskedPan", []),
            "iban": acc.get("iban"),
            "cashback_type": acc.get("cashbackType"),
        })

    jars = []
    for jar in info.get("jars", []):
        jars.append({
            "id": jar.get("id"),
            "title": jar.get("title", "Банка"),
            "description": jar.get("description", ""),
            "currency_code": jar.get("currencyCode"),
            "balance": jar.get("balance", 0) / 100.0,
            "goal": jar.get("goal", 0) / 100.0,
        })

    # Update cached accounts
    await queries.set_mono_token(
        db, telegram_id, user["mono_token"],
        client_id=info.get("clientId"),
        accounts=accounts,
        jars=jars,
    )

    return {
        "accounts": accounts,
        "default_account": user.get("default_account"),
    }


@router.post("/set-default-account")
async def set_default_account(
    body: MonoSetDefaultAccount,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    await queries.set_default_account(db, telegram_id, body.account_id)
    return {"ok": True}


@router.post("/sync")
async def sync_statement(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    """Sync last 31 days of transactions from Monobank for all accounts."""
    user = await queries.get_user(db, telegram_id)
    if not user or not user.get("mono_token"):
        raise HTTPException(400, "Monobank не підключено")

    token = user["mono_token"]
    now = int(time.time())
    from_ts = now - 2682000  # 31 days + 1 hour

    accounts = user.get("mono_accounts", [])
    if not accounts:
        accounts = [{"id": user.get("default_account") or "0"}]

    new_count = 0
    updated_count = 0
    total_items = 0

    failed = False
    last_err = ""

    for acc in accounts:
        account_id = acc.get("id")
        if not account_id:
            continue
        try:
            items = await monobank.get_statement(token, account_id, from_ts, now)
        except MonobankError as e:
            _LOGGER.error("Monobank sync error for account %s: %s", account_id, e.description)
            failed = True
            last_err = e.description
            continue

        total_items += len(items)
        for item in items:
            doc = parse_statement_item(item, telegram_id)
            is_new = await queries.upsert_mono_transaction(db, doc)
            if is_new:
                new_count += 1
            else:
                updated_count += 1
                
        await asyncio.sleep(0.3)

    if failed and total_items == 0:
        raise HTTPException(502, f"Monobank Error: {last_err}")

    # Refresh cached account balances from Monobank API after sync
    try:
        info = await monobank.get_client_info(token)
        accounts_refreshed = []
        for acc in info.get("accounts", []):
            accounts_refreshed.append({
                "id": acc.get("id"),
                "type": acc.get("type"),
                "currency_code": acc.get("currencyCode"),
                "balance": acc.get("balance", 0) / 100.0,
                "credit_limit": acc.get("creditLimit", 0) / 100.0,
                "masked_pan": acc.get("maskedPan", []),
                "iban": acc.get("iban"),
                "cashback_type": acc.get("cashbackType"),
            })
        jars_refreshed = []
        for jar in info.get("jars", []):
            jars_refreshed.append({
                "id": jar.get("id"),
                "title": jar.get("title", "Банка"),
                "description": jar.get("description", ""),
                "currency_code": jar.get("currencyCode"),
                "balance": jar.get("balance", 0) / 100.0,
                "goal": jar.get("goal", 0) / 100.0,
            })
        await queries.set_mono_token(
            db, telegram_id, token,
            client_id=info.get("clientId"),
            accounts=accounts_refreshed,
            jars=jars_refreshed,
        )
    except Exception as e:
        _LOGGER.warning("Failed to refresh account balances after sync: %s", e)

    return {
        "ok": True,
        "total": total_items,
        "new": new_count,
        "updated": updated_count,
    }


@router.post("/webhook/{secret}")
async def mono_webhook_receiver(secret: str, request: Request) -> dict:
    """Receive real-time transaction notifications from Monobank.

    Secret у шляху — захист від підробки StatementItem сторонніми клієнтами
    (репозиторій публічний, тому endpoint легко знайти). Monobank викликає
    саме той URL, який ми передали у set_webhook → secret збігається.
    """
    expected = config.MONO_WEBHOOK_SECRET
    if not expected or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        data = await request.json()
    except Exception:
        return {"ok": True}

    if data.get("type") != "StatementItem":
        return {"ok": True}

    statement_data = data.get("data", {})
    account_id = statement_data.get("account")
    item = statement_data.get("statementItem")
    if not item:
        return {"ok": True}

    db = get_db()

    # Find user by mono account
    user = await db["users"].find_one({
        "mono_accounts.id": account_id,
    })
    if not user:
        _LOGGER.warning("Mono webhook: no user for account %s", account_id)
        return {"ok": True}

    doc = parse_statement_item(item, user["telegram_id"])
    await queries.upsert_mono_transaction(db, doc)

    return {"ok": True}


@router.get("/status")
async def mono_status(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    if not user:
        return {"connected": False}

    connected = bool(user.get("mono_token"))
    return {
        "connected": connected,
        "client_id": user.get("mono_client_id") if connected else None,
        "accounts": user.get("mono_accounts", []) if connected else [],
        "default_account": user.get("default_account") if connected else None,
        "webhook_set": user.get("mono_webhook_set", False) if connected else False,
    }
