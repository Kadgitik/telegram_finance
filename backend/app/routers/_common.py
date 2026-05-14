"""Shared helpers for backend routers."""
from __future__ import annotations

import asyncio
from typing import Any

from bot.constants import KOPECKS_PER_UAH

__all__ = [
    "KOPECKS_PER_UAH",
    "MONO_STATEMENT_MAX_SECONDS",
    "MONO_REFRESH_COOLDOWN_SEC",
    "track_bg_task",
    "tx_out",
]

# Monobank statement window: 31 days + 1h, in seconds.
MONO_STATEMENT_MAX_SECONDS = 31 * 24 * 60 * 60 + 60 * 60

# JIT mono refresh cooldown (sec) — match Monobank client-info rate limit (60s).
MONO_REFRESH_COOLDOWN_SEC = 65

# Background-task registry — prevents tasks from being GC'd while running.
_BG_TASKS: set[asyncio.Task] = set()


def track_bg_task(task: asyncio.Task) -> asyncio.Task:
    """Keep a strong reference to a background task until it finishes."""
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)
    return task


def tx_out(doc: dict[str, Any]) -> dict[str, Any]:
    """Serialize a transaction document for the API response."""
    d = doc.get("date") or doc.get("created_at")
    date_str = d.isoformat() if hasattr(d, "isoformat") else str(d or "")
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
        "date": date_str,
    }
