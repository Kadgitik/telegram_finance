from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.db.pipelines import month_range_utc

router = Router(name="stats")


@router.message(Command("stats"))
async def cmd_stats(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    now = datetime.now(timezone.utc)
    start, end_excl = month_range_utc(now.year, now.month)

    rows = await queries.get_expense_stats(
        db, message.from_user.id, start, end_excl, end_inclusive=False
    )
    if not rows:
        await message.answer("Немає витрат за цей місяць.")
        return

    total = sum(float(r["total"]) for r in rows)
    lines = [f"Витрати за {now.strftime('%B %Y')}: {total:,.0f} ₴\n"]
    for r in rows:
        name = r["_id"] or "Інше"
        amt = float(r["total"])
        pct = (amt / total * 100) if total else 0
        lines.append(f"  {name}: {amt:,.0f} ₴ ({pct:.0f}%)")

    await message.answer("\n".join(lines))
