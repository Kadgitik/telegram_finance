"""Monobank Open API client."""

from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timezone
from typing import Any

import aiohttp

from bot.services.mcc import mcc_to_category

# Опис Mono для внутрішніх переказів (між своїми картками/рахунками/банками).
_INTERNAL_TRANSFER_RE = re.compile(
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

_CREDIT_RE = re.compile(
    r"погашення кредит|кредит до зарплати|відсотки за|погашення заборгованості",
    re.IGNORECASE,
)

BASE_URL = "https://api.monobank.ua"

# Rate-limit: 1 request per 60s per endpoint
_last_call: dict[str, float] = {}
_RATE_LIMIT_SECONDS = 60


class MonobankError(Exception):
    """Error from Monobank API."""

    def __init__(self, status: int, description: str) -> None:
        self.status = status
        self.description = description
        super().__init__(f"Monobank API {status}: {description}")


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

    async with aiohttp.ClientSession() as session:
        async with session.request(method, url, headers=headers, json=json_body, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                text = await resp.text()
                if not text.strip():
                    return {}
                return await resp.json()
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

    Max period: 31 days + 1 hour (2682000 seconds).
    Max 500 transactions per response.
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
    amount_uah = abs(amount_raw) / 100.0
    tx_type = "income" if amount_raw > 0 else "expense"

    op_amount_raw = item.get("operationAmount", amount_raw)
    original_amount = abs(op_amount_raw) / 100.0

    mcc = item.get("mcc", 0)
    category = mcc_to_category(mcc)

    tx_time = item.get("time", 0)
    tx_date = datetime.fromtimestamp(tx_time, tz=timezone.utc) if tx_time else datetime.now(timezone.utc)

    cashback_raw = item.get("cashbackAmount", 0)
    balance_raw = item.get("balance", 0)

    # Mono може надіслати description: null — тому (... or "").
    description = (item.get("description") or "").strip()
    # Detect internal transfers by description regex OR by MCC 4829 (money transfer)
    # with typical internal transfer descriptions
    is_internal = bool(_INTERNAL_TRANSFER_RE.search(description))
    # MCC 4829 = грошовий переказ — if combined with empty/generic description, likely internal
    if not is_internal and mcc == 4829 and not description:
        is_internal = True
        
    if _CREDIT_RE.search(description):
        category = "Кредит"
        is_internal = False

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
        "cashback": abs(cashback_raw) / 100.0,
        "balance_after": balance_raw / 100.0,
        "hold": bool(item.get("hold", False)),
        "internal_transfer": is_internal,
        "deleted": False,
        "date": tx_date,
        "created_at": datetime.now(timezone.utc),
    }
