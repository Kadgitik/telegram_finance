from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.constants import DEFAULT_CATEGORIES
from bot.db import queries

router = Router(name="categories")


@router.message(Command("categories"))
async def cmd_categories(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    user = await queries.get_user(db, message.from_user.id)
    custom = (user or {}).get("custom_categories") or []
    lines = ["📂 Категорії витрат (дефолтні):", ""]
    for c in DEFAULT_CATEGORIES:
        lines.append(f"• {c}")
    if custom:
        lines.append("")
        lines.append("Ваші категорії:")
        for c in custom:
            lines.append(f"• {c}")
    await message.answer("\n".join(lines))


@router.message(Command("addcategory"))
async def cmd_addcategory(
    message: Message,
    command: CommandObject,
    db: AsyncIOMotorDatabase,
) -> None:
    assert message.from_user
    if not command.args or not command.args.strip():
        await message.answer("Використання: /addcategory 🎨 Моя категорія")
        return
    label = command.args.strip()
    await queries.add_custom_category(db, message.from_user.id, label)
    await message.answer(f"✅ Додано категорію: {label}")


@router.message(Command("deletecategory"))
async def cmd_delcategory(
    message: Message,
    command: CommandObject,
    db: AsyncIOMotorDatabase,
) -> None:
    assert message.from_user
    if not command.args or not command.args.strip():
        await message.answer("Використання: /deletecategory Назва")
        return
    label = command.args.strip()
    await queries.remove_custom_category(db, message.from_user.id, label)
    await message.answer(f"🗑 Видалено з кастомних: {label}")
