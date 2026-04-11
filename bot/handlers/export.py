from __future__ import annotations

import csv
import io

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import BufferedInputFile, Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries

router = Router(name="export")


@router.message(Command("export"))
async def cmd_export(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    rows = await queries.export_transactions_csv_rows(db, message.from_user.id)
    if not rows:
        await message.answer("Немає даних для експорту.")
        return

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "type", "source", "amount", "category", "mcc", "description", "comment"])
    for r in rows:
        d = r.get("date") or r.get("created_at")
        w.writerow([
            d.isoformat() if hasattr(d, "isoformat") else str(d),
            r.get("type"),
            r.get("source", "cash"),
            r.get("amount"),
            r.get("category"),
            r.get("mcc"),
            r.get("description"),
            r.get("comment"),
        ])

    file = BufferedInputFile(buf.getvalue().encode("utf-8"), filename="transactions.csv")
    await message.answer_document(file, caption="Експорт транзакцій")
