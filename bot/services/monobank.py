"""Monobank Open API client."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import aiohttp

from bot.constants import KOPECKS_PER_UAH
from bot.services.mcc import mcc_to_category
from bot.services.classifiers import is_internal_transfer, is_credit

BASE_URL = "https://api.monobank.ua"

# Rate-limit: 1 request per 60s per endpoint.
_last_call: dict[str, float] = {}
_RATE_LIMIT_SECONDS = 60

# Shared aiohttp session — created lazily, closed on app shutdown.
_session: aiohttp.ClientSession | None = None
_session_lock = asyncio.Lock()


class MonobankError(Exception):
    """Error from Monobank API."""

    def __init__(self, status: int, description: str) -> None:
        self.status = status
        self.description = description
        super().__init__(f"Monobank API {status}: {description}")


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        async with _session_lock:
            if _session is None or _session.closed:
                _session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=15)
                )
    return _session


async def close_session() -> None:
    global _session
    if _session is not None and not _session.closed:
        await _session.close()
    _session = None


async def _rate_limit_wait(endpoint: str) -> None:
    last = _last_call.get(endpoint)
    if last is not None:
        diff = time.monotonic() - last
        if diff < _RATE_LIMIT_SECONDS:
            await asyncio.sleep(_RATE_LIMIT_SECONDS - diff)
    _last_call[endpoint] = time.monotonic()


async def _request(
    method: str,
    path: str,
    token: str,
    *,
    json_body: dict | None = None,
    rate_limit_key: str | None = None,
) -> Any:
    if rate_limit_key:
        await _rate_limit_wait(rate_limit_key)

    headers = {"X-Token": token}
    url = f"{BASE_URL}{path}"
    session = await get_session()

    async with session.request(method, url, headers=headers, json=json_body) as resp:
        if resp.status == 200:
            text = await resp.text()
            if not text.strip():
                return {}
            return await resp.json()

        if resp.status == 429:
            if rate_limit_key:
                _last_call[rate_limit_key] = time.monotonic()
            raise MonobankError(429, "Забагато запитів до Monobank. Зачекайте 1 хвилину.")

        try:
            data = await resp.json()
            desc = data.get("errorDescription", str(data))
        except Exception:
            desc = await resp.text()
        raise MonobankError(resp.status, desc)


async def get_client_info(token: str) -> dict[str, Any]:
    """GET /personal/client-info — account list, balances, jars."""
    return await _request("GET", "/personal/client-info", token, rate_limit_key="client-info")


async def get_statement(
    token: str,
    account: str,
    from_ts: int,
    to_ts: int | None = None,
) -> list[dict[str, Any]]:
    """GET /personal/statement/{account}/{from}/{to} — transaction list.

    Max period: 31 days + 1 hour. Max 500 transactions per response.
    """
    path = f"/personal/statement/{account}/{from_ts}"
    if to_ts is not None:
        path += f"/{to_ts}"
    return await _request("GET", path, token, rate_limit_key=f"statement_{account}")


async def set_webhook(token: str, webhook_url: str) -> dict:
    """POST /personal/webhook — set webhook URL for real-time transactions."""
    return await _request(
        "POST",
        "/personal/webhook",
        token,
        json_body={"webHookUrl": webhook_url},
        rate_limit_key="webhook",
    )


def parse_statement_item(item: dict[str, Any], telegram_id: int) -> dict[str, Any]:
    """Convert a Monobank StatementItem into our transaction document."""
    amount_raw = item.get("amount", 0)  # in kopecks, negative = expense
    amount_uah = abs(amount_raw) / KOPECKS_PER_UAH
    tx_type = "income" if amount_raw > 0 else "expense"

    op_amount_raw = item.get("operationAmount", amount_raw)
    original_amount = abs(op_amount_raw) / KOPECKS_PER_UAH

    mcc = item.get("mcc", 0)
    category = mcc_to_category(mcc)

    tx_time = item.get("time", 0)
    tx_date = datetime.fromtimestamp(tx_time, tz=timezone.utc) if tx_time else datetime.now(timezone.utc)

    cashback_raw = item.get("cashbackAmount", 0)
    balance_raw = item.get("balance")
    balance_after = balance_raw / KOPECKS_PER_UAH if balance_raw is not None else None

    description = (item.get("description") or "").strip()
    internal = is_internal_transfer(description, mcc)

    if is_credit(description):
        category = "Кредит"
        internal = False

    return {
        "telegram_id": telegram_id,
        "source": "monobank",
        "mono_id": item.get("id"),
        "type": tx_type,
        "amount": amount_uah,
        "original_amount": original_amount,
        "currency_code": item.get("currencyCode"),
        "category": category,
        "mcc": mcc,
        "description": description,
        "comment": item.get("comment") or None,
        "cashback": abs(cashback_raw) / KOPECKS_PER_UAH,
        "balance_after": balance_after,
        "hold": bool(item.get("hold", False)),
        "internal_transfer": internal,
        "deleted": False,
        "date": tx_date,
        "created_at": datetime.now(timezone.utc),
    }
