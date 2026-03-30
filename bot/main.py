from __future__ import annotations

import logging
import time

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application

from bot import config
from bot.db.mongo import close_client, ensure_indexes, get_db
from bot.handlers import balance, budgets, categories, charts, export, help as help_h
from bot.handlers import history, start, stats, transactions
from bot.middlewares.db import DbMiddleware

_STARTED = time.monotonic()


def _build_dp() -> Dispatcher:
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


async def on_startup(bot: Bot) -> None:
    db = get_db()
    await ensure_indexes(db)
    wh_url = f"{config.WEBHOOK_BASE_URL}{config.WEBHOOK_PATH}"
    await bot.set_webhook(
        url=wh_url,
        secret_token=config.WEBHOOK_SECRET or None,
    )
    logging.getLogger(__name__).info("Webhook set: %s", wh_url)


async def on_shutdown(bot: Bot) -> None:
    await bot.delete_webhook(drop_pending_updates=True)
    await close_client()


async def health(_: web.Request) -> web.Response:
    return web.json_response(
        {"status": "ok", "uptime_s": round(time.monotonic() - _STARTED, 2)}
    )


async def index(_: web.Request) -> web.Response:
    return web.json_response({"app": "telegram-finance-bot", "version": "1.0.0"})


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    bot = Bot(config.BOT_TOKEN)
    dp = _build_dp()
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    app = web.Application()
    handler = SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=config.WEBHOOK_SECRET or None,
    )
    handler.register(app, path=config.WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)

    app.router.add_get("/health", health)
    app.router.add_get("/", index)

    web.run_app(app, host="0.0.0.0", port=config.PORT)


if __name__ == "__main__":
    main()
