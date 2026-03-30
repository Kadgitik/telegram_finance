from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries

router = Router(name="start")


@router.message(CommandStart())
async def cmd_start(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    await queries.upsert_user(
        db,
        message.from_user.id,
        message.from_user.username,
        message.from_user.first_name,
    )
    name = message.from_user.first_name or "друже"
    text = (
        f"🏦 Привіт, {name}!\n\n"
        "Я — твій особистий фінансовий помічник. Допоможу вести облік витрат та доходів.\n\n"
        "📝 Як записати витрату:\n"
        "   Просто напиши: кава 85\n\n"
        "💰 Як записати дохід:\n"
        "   Напиши: +45000 зарплата\n\n"
        "📊 Корисні команди:\n"
        "├ /balance — баланс за місяць\n"
        "├ /stats — статистика по категоріях\n"
        "├ /chart — графік витрат 📊\n"
        "├ /history — останні 10 записів\n"
        "├ /categories — список категорій\n"
        "├ /export — експорт у CSV\n"
        "└ /help — допомога\n\n"
        "💡 Почни просто: напиши назву витрати та суму!"
    )
    await message.answer(text)
