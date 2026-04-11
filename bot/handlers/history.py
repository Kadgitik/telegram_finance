from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries

router = Router(name="history")


@router.message(Command("history"))
async def cmd_history(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    items = await queries.list_transactions(
        db, message.from_user.id, limit=10
    )
    if not items:
        await message.answer("Історія порожня.")
        return

    lines = ["Останні 10 опера��ій:\n"]
    for tx in items:
        sign = "+" if tx["type"] == "income" else "-"
        src = "mono" if tx.get("source") == "monobank" else "cash"
        desc = tx.get("description") or tx.get("category", "")
        d = tx.get("date")
        date_str = d.strftime("%d.%m %H:%M") if hasattr(d, "strftime") else str(d)[:16]
        lines.append(f"  {sign}{tx['amount']:,.0f} ₴ [{src}] {desc} ({date_str})")

    await message.answer("\n".join(lines))
