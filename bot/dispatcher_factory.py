"""Shared aiogram Dispatcher for aiohttp entrypoint and FastAPI webhook."""
from __future__ import annotations

from aiogram import Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from bot.handlers import balance, budgets, categories, charts, export, help as help_h
from bot.handlers import history, start, stats, transactions
from bot.middlewares.db import DbMiddleware


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher(storage=MemoryStorage())
    dp.update.middleware(DbMiddleware())
    for r in (
        start.router,
        help_h.router,
        balance.router,
        stats.router,
        history.router,
        categories.router,
        budgets.router,
        export.router,
        charts.router,
        transactions.router,
    ):
        dp.include_router(r)
    return dp
