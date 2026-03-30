from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.keyboards import inline as ik
from bot.utils import formatters as fmt

router = Router(name="history")

PAGE = 10


def _rel_day(dt: datetime, now: datetime) -> str:
    d = dt.date()
    t = now.date()
    if d == t:
        return fmt.format_time_only(dt)
    if d == t - timedelta(days=1):
        return "вчора"
    return fmt.format_date_short(dt.replace(tzinfo=timezone.utc))


@router.message(Command("history"))
async def cmd_history(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    await _send_page(message, db, message.from_user.id, 0)


async def _send_page(
    message: Message,
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    page: int,
) -> None:
    skip = page * PAGE
    items = await queries.get_history_page(db, telegram_id, skip, PAGE)
    total = await queries.count_transactions(db, telegram_id)
    if not items and page > 0:
        await message.answer("Це початок списку.")
        return
    if not items:
        await message.answer("📋 Поки немає записів.")
        return
    now = datetime.now(timezone.utc)
    lines = ["📋 Останні записи:", ""]
    for i, doc in enumerate(items, start=skip + 1):
        dt = doc["created_at"]
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        cat = doc.get("category") or "❓"
        amt = float(doc["amount"])
        com = doc.get("comment") or ""
        tim = _rel_day(dt, now)
        lines.append(f"{i}. {cat} — {fmt.format_money(amt)} грн ({com}) — {tim}")
    await message.answer("\n".join(lines), reply_markup=ik.history_nav(page))
    max_page = max(0, (total - 1) // PAGE)
    if page > max_page and page > 0:
        pass


@router.callback_query(lambda c: bool(c.data and c.data.startswith("h:") and c.data[2:].isdigit()))
async def cb_history_page(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.from_user and query.message
    page = int(query.data.split(":")[1])
    if page < 0:
        await query.answer()
        return
    skip = page * PAGE
    items = await queries.get_history_page(db, query.from_user.id, skip, PAGE)
    total = await queries.count_transactions(db, query.from_user.id)
    max_page = max(0, (total - 1) // PAGE)
    if page > max_page:
        await query.answer("Це кінець списку", show_alert=True)
        return
    if not items:
        await query.answer()
        return
    now = datetime.now(timezone.utc)
    lines = ["📋 Останні записи:", ""]
    for i, doc in enumerate(items, start=skip + 1):
        dt = doc["created_at"]
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        cat = doc.get("category") or "❓"
        amt = float(doc["amount"])
        com = doc.get("comment") or ""
        tim = _rel_day(dt, now)
        lines.append(f"{i}. {cat} — {fmt.format_money(amt)} грн ({com}) — {tim}")
    await query.message.edit_text("\n".join(lines), reply_markup=ik.history_nav(page))
    await query.answer()
