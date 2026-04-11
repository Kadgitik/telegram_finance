from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router(name="help")


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    text = (
        "Фінансовий Трекер\n\n"
        "Команди:\n"
        "/start — Відкрити застосунок\n"
        "/balance — Баланс за місяць\n"
        "/stats — Статистика витрат\n"
        "/history — Останні операції\n"
        "/export — Експорт CSV\n"
        "/help — Довідка\n\n"
        "Підключи Monobank у налаштуваннях додатку."
    )
    await message.answer(text)
