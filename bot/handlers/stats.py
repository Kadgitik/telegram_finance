from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.db.pipelines import month_range_utc
from bot.keyboards import inline as ik
from bot.utils import formatters as fmt

router = Router(name="stats")


async def _build_stats_text(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    start: datetime,
    end: datetime,
    *,
    end_inclusive: bool,
    title_suffix: str,
) -> str:
    rows = await queries.get_expense_stats(
        db,
        telegram_id,
        start,
        end,
        end_inclusive=end_inclusive,
    )
    total = sum(float(r["total"]) for r in rows)
    lines = [f"📊 Статистика ({title_suffix})", ""]
    if total <= 0:
        lines.append("Немає витрат за період.")
        return "\n".join(lines)
    for r in rows:
        cat = r["_id"] or "❓"
        val = float(r["total"])
        cnt = int(r["count"])
        pct = val / total * 100
        bar = fmt.format_progress_bar(min(100, pct), width=12)
        lines.append(f"{cat}    {fmt.format_money(val)} грн  {bar}  {pct:.0f}%")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━")
    n = sum(int(r["count"]) for r in rows)
    avg = total / n if n else 0
    lines.append(f"💸 Всього:     {fmt.format_money(total)} грн")
    lines.append(f"📝 Записів: {n} | Середня витрата: {fmt.format_money(avg)} грн")
    return "\n".join(lines)


def _month_bounds(ref: datetime) -> tuple[datetime, datetime]:
    return month_range_utc(ref.year, ref.month)


@router.message(Command("stats"))
async def cmd_stats(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    now = datetime.now(timezone.utc)
    start, end_excl = _month_bounds(now)
    text = await _build_stats_text(
        db,
        message.from_user.id,
        start,
        end_excl,
        end_inclusive=False,
        title_suffix=fmt.uk_month_year(now),
    )
    await message.answer(text, reply_markup=ik.stats_period_keyboard())


@router.callback_query(F.data.startswith("st:"))
async def cb_stats_period(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.from_user and query.message
    code = query.data.split(":")[1]
    now = datetime.now(timezone.utc)
    end_ref = now

    if code == "week":
        start = now - timedelta(days=7)
        title = "тиждень"
        text = await _build_stats_text(
            db,
            query.from_user.id,
            start,
            end_ref,
            end_inclusive=True,
            title_suffix=title,
        )
    elif code == "month":
        start, end_excl = _month_bounds(now)
        title = fmt.uk_month_year(now)
        text = await _build_stats_text(
            db,
            query.from_user.id,
            start,
            end_excl,
            end_inclusive=False,
            title_suffix=title,
        )
    elif code == "3m":
        start = now - timedelta(days=90)
        title = "3 місяці"
        text = await _build_stats_text(
            db,
            query.from_user.id,
            start,
            end_ref,
            end_inclusive=True,
            title_suffix=title,
        )
    else:
        start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        title = str(now.year)
        text = await _build_stats_text(
            db,
            query.from_user.id,
            start,
            end_ref,
            end_inclusive=True,
            title_suffix=title,
        )

    await query.message.edit_text(text, reply_markup=ik.stats_period_keyboard())
    await query.answer()
