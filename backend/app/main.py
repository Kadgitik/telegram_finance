from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from aiogram import Bot
from aiogram.types import Update
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import mono, savings, stats, transactions
from bot import config
from bot.db.mongo import close_client, ensure_indexes, get_client, get_db
from bot.dispatcher_factory import build_dispatcher

_LOGGER = logging.getLogger(__name__)
_ROOT = Path(__file__).resolve().parents[2]
_STATIC = _ROOT / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    get_client()
    db = get_db()
    await ensure_indexes(db)
    bot = Bot(config.BOT_TOKEN)
    dp = build_dispatcher()
    app.state.bot = bot
    app.state.dp = dp
    try:
        config.validate_webhook_base_url(config.WEBHOOK_BASE_URL)
        wh_url = f"{config.WEBHOOK_BASE_URL}{config.WEBHOOK_PATH}"
        await asyncio.wait_for(
            bot.set_webhook(url=wh_url, secret_token=config.WEBHOOK_SECRET or None),
            timeout=15,
        )
        info = await asyncio.wait_for(bot.get_webhook_info(), timeout=15)
        _LOGGER.info(
            "Webhook set: %s | Telegram pending=%s last_error=%s",
            wh_url,
            getattr(info, "pending_update_count", None),
            getattr(info, "last_error_message", None) or "none",
        )
    except Exception as exc:
        _LOGGER.exception("Webhook setup failed, app will still start: %s", exc)
    yield
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    finally:
        await close_client()
        await bot.session.close()


app = FastAPI(
    title="Finance Mini App API",
    lifespan=lifespan,
)

# CORS Policy — фільтруємо порожні значення, щоб не додавати "" у allow_origins.
_cors_origins = [
    o for o in (
        "https://web.telegram.org",
        "https://app.telegram.org",
        config.WEBAPP_URL,
    ) if o
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(transactions.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(savings.router, prefix="/api")
app.include_router(mono.router, prefix="/api")


@app.get("/admin/audit-march")
async def audit_march(request: Request):
    """TEMPORARY: Audit March 2026 transactions. Remove after use."""
    from datetime import datetime, timezone
    key = request.query_params.get("key", "")
    if key != config.BOT_TOKEN:
        raise HTTPException(403, "Forbidden")
    db = get_db()
    start = datetime(2026, 3, 1, tzinfo=timezone.utc)
    end = datetime(2026, 4, 1, tzinfo=timezone.utc)
    
    all_tx = await db["transactions"].find({
        "date": {"$gte": start, "$lt": end}
    }).sort("date", 1).to_list(None)
    
    income_total = 0.0
    expense_total = 0.0
    internal_income = 0.0
    internal_expense = 0.0
    deleted_count = 0
    internal_count = 0
    
    items = []
    for tx in all_tx:
        is_del = tx.get("deleted", False)
        is_int = tx.get("internal_transfer", False)
        amt = float(tx.get("amount", 0))
        tp = tx.get("type", "")
        desc = tx.get("description", "")
        
        if is_del:
            deleted_count += 1
        
        if is_int:
            internal_count += 1
            if tp == "income":
                internal_income += amt
            else:
                internal_expense += amt
        elif not is_del:
            if tp == "income":
                income_total += amt
            else:
                expense_total += amt
        
        items.append({
            "date": tx.get("date").isoformat() if tx.get("date") else "",
            "type": tp,
            "amount": amt,
            "description": desc[:80],
            "category": tx.get("category", ""),
            "internal_transfer": is_int,
            "deleted": is_del,
            "mcc": tx.get("mcc"),
            "source": tx.get("source", ""),
        })
    
    return {
        "month": "March 2026",
        "total_transactions": len(all_tx),
        "deleted_count": deleted_count,
        "internal_transfer_count": internal_count,
        "active_transactions": len(all_tx) - deleted_count - internal_count,
        "summary": {
            "income_without_transfers": round(income_total, 2),
            "expense_without_transfers": round(expense_total, 2),
            "balance": round(income_total - expense_total, 2),
            "internal_income": round(internal_income, 2),
            "internal_expense": round(internal_expense, 2),
        },
        "items": items,
    }


@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/live")
@app.head("/health/live")
async def health_live():
    return {"status": "ok", "kind": "live"}


@app.get("/health/ready")
@app.head("/health/ready")
async def health_ready():
    db = get_db()
    try:
        await db.command("ping")
        return {"status": "ok", "kind": "ready", "db": "ok"}
    except Exception:
        return JSONResponse(
            {"status": "degraded", "kind": "ready", "db": "down"},
            status_code=503,
        )


@app.post("/webhook")
async def telegram_webhook(request: Request) -> Response:
    if config.WEBHOOK_SECRET:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if token != config.WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid secret")
    bot: Bot = request.app.state.bot
    dp = request.app.state.dp
    try:
        data = await request.json()
        update = Update.model_validate(data)
        await dp.feed_update(bot, update)
    except Exception:
        _LOGGER.exception("Webhook handler error")
        raise
    return Response(status_code=200)


def _mount_static() -> None:
    assets = _STATIC / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")
    else:
        _LOGGER.warning("Static assets not found at %s", assets)


_mount_static()


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404)
    index = _STATIC / "index.html"
    if index.is_file():
        return FileResponse(
            index,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            },
        )
    return JSONResponse(
        {"detail": "Frontend not built — run npm run build in frontend/"},
        status_code=503,
    )
