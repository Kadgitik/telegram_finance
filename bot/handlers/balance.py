from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.db.pipelines import month_range_utc

router = Router(name="balance")


@router.message(Command("balance"))
async def cmd_balance(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    now = datetime.now(timezone.utc)
    start, end_excl = month_range_utc(now.year, now.month)

    income, expense = await queries.balance_totals(
        db, message.from_user.id, start, end_excl
    )
    bal = income - expense

    text = (
        f"Баланс за {now.strftime('%B %Y')}\n\n"
        f"Доходи: {income:,.0f} ₴\n"
        f"Витрати: {expense:,.0f} ₴\n"
        f"Баланс: {bal:,.0f} ₴"
    )
    await message.answer(text)
