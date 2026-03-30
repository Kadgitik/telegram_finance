from __future__ import annotations

import re
from datetime import datetime

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.constants import DEFAULT_CATEGORIES
from bot.db import queries
from bot.utils import formatters as fmt

router = Router(name="budgets")

_CAT_KEYS = list(DEFAULT_CATEGORIES.keys())


def _match_budget_category(text: str) -> str | None:
    t = text.strip().lower()
    if not t:
        return None
    for k in _CAT_KEYS:
        if k.lower() == text.strip().lower():
            return k
        short = k.split(maxsplit=1)[-1].lower()
        if short in t or t in k.lower():
            return k
    for k in _CAT_KEYS:
        for alias in DEFAULT_CATEGORIES[k]:
            if alias.lower() in t:
                return k
    return None


@router.message(Command("setbudget"))
async def cmd_setbudget(
    message: Message,
    command: CommandObject,
    db: AsyncIOMotorDatabase,
) -> None:
    assert message.from_user
    if not command.args:
        await message.answer("Приклад: /setbudget 🍔 Їжа 5000")
        return
    m = re.search(r"(\d+[.,]?\d*)\s*$", command.args.strip())
    if not m:
        await message.answer("Вкажіть суму в кінці, наприклад: /setbudget Їжа 5000")
        return
    amount = float(m.group(1).replace(",", "."))
    cat_part = command.args[: m.start()].strip()
    cat = _match_budget_category(cat_part)
    if not cat:
        await message.answer("Не зрозумів категорію. Оберіть з /categories")
        return
    await queries.set_budget(db, message.from_user.id, cat, amount)
    await message.answer(f"✅ Бюджет для {cat}: {fmt.format_money(amount)} грн")


@router.message(Command("budgets"))
async def cmd_budgets(message: Message, db: AsyncIOMotorDatabase) -> None:
    assert message.from_user
    user = await queries.get_user(db, message.from_user.id)
    budgets = (user or {}).get("budgets") or {}
    from datetime import timezone

    now = datetime.now(timezone.utc)
    title = fmt.uk_month_year(now)
    lines = [f"📋 Бюджети на {title}", ""]
    if not budgets:
        lines.append("Ще немає бюджетів. /setbudget")
        await message.answer("\n".join(lines))
        return
    start, end_excl = queries.period_month_now()
    stats = await queries.get_expense_stats(
        db, message.from_user.id, start, end_excl, end_inclusive=False
    )
    spent_map = {row["_id"]: float(row["total"]) for row in stats}
    for cat, limit in budgets.items():
        lim = float(limit)
        spent = spent_map.get(cat, 0.0)
        pct = (spent / lim * 100) if lim else 0
        bar = fmt.format_progress_bar(min(100, pct))
        icon = "🔴" if pct >= 100 else ("⚠️" if pct >= 80 else "✅")
        lines.append(f"{cat}")
        lines.append(f"   {fmt.format_money(spent)} / {fmt.format_money(lim)} грн")
        lines.append(f"   {bar} {pct:.0f}% {icon}")
        lines.append("")
    lines.append("[Додати: /setbudget]")
    await message.answer("\n".join(lines))
