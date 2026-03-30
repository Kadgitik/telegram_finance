from __future__ import annotations

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot import config
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
        f"🏦 Фінансовий Трекер\n\n"
        f"Привіт, {name}! Веди облік витрат та доходів прямо в Telegram.\n\n"
        "📊 Графіки та статистика\n"
        "💰 Бюджети по категоріях\n"
        "📱 Зручний мобільний інтерфейс\n\n"
        "👇 Натисни кнопку, щоб відкрити додаток"
    )
    webapp_url = config.WEBAPP_URL or config.WEBHOOK_BASE_URL
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📱 Відкрити додаток",
                    web_app=WebAppInfo(url=webapp_url),
                )
            ],
        ]
    )
    await message.answer(text, reply_markup=kb)
