from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router(name="help")


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "📖 Допомога\n\n"
        "Команди: /balance, /stats, /chart, /history, /categories, "
        "/addcategory, /deletecategory, /setbudget, /budgets, /export\n\n"
        "Витрата: `кава 85`\n"
        "Дохід: `+5000 зарплата`",
        parse_mode="Markdown",
    )
