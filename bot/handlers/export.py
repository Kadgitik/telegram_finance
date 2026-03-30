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
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "type", "amount", "category", "comment", "created_at"])
    for doc in rows:
        w.writerow(
            [
                str(doc["_id"]),
                doc["type"],
                doc["amount"],
                doc.get("category") or "",
                doc.get("comment") or "",
                doc["created_at"].isoformat(),
            ]
        )
    data = buf.getvalue().encode("utf-8-sig")
    f = BufferedInputFile(data, filename="finance_export.csv")
    await message.answer_document(f, caption="📎 Експорт транзакцій")
