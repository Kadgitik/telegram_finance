from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.utils import formatters as fmt

router = Router(name="balance")


@router.message(Command("balance"))
async def cmd_balance(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    now = datetime.now(timezone.utc)
    y, m = now.year, now.month
    inc, exp = await queries.balance_totals_month(db, message.from_user.id, y, m)
    if m == 1:
        py, pm = y - 1, 12
    else:
        py, pm = y, m - 1
    _, exp_prev = await queries.balance_totals_month(db, message.from_user.id, py, pm)
    bal = inc - exp
    title = fmt.uk_month_year(now)
    lines = [
        f"📊 Баланс за {title}",
        "",
        f"💰 Доходи:    {fmt.format_money(inc)} грн",
        f"💸 Витрати:   {fmt.format_money(exp)} грн",
        "━━━━━━━━━━━━━━━━━━━",
        f"💵 Залишок:   {fmt.format_money(bal)} грн",
        "",
        "📈 Порівняння з попереднім місяцем:",
    ]
    if exp_prev > 0:
        diff = ((exp - exp_prev) / exp_prev) * 100
        arr = "▼" if diff < 0 else "▲"
        lines.append(
            f"   Витрати: {fmt.format_money(exp)} грн vs {fmt.format_money(exp_prev)} грн ({arr} {abs(diff):.0f}%)"
        )
    else:
        lines.append(f"   Витрати: {fmt.format_money(exp)} грн (немає даних за минулий місяць)")
    await message.answer("\n".join(lines))
