from __future__ import annotations

import re
from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.constants import DEFAULT_CATEGORIES, INCOME_CATEGORIES
from bot.db import queries
from bot.db.pipelines import month_range_utc
from bot.keyboards import inline as ik
from bot.services.parser import parse_transaction_message
from bot.states import PendingTx
from bot.utils import formatters as fmt

router = Router(name="transactions")

EXP_KEYS = list(DEFAULT_CATEGORIES.keys())
INC_KEYS = list(INCOME_CATEGORIES.keys())


async def _format_confirmation(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    *,
    type_: str,
    amount: float,
    category: str | None,
    comment: str,
    created_at: datetime,
) -> str:
    sym = "грн"
    if type_ == "expense":
        lines = [
            "✅ Записано!",
            "",
            f"{category or '❓'} — {fmt.format_money(amount)} {sym}",
            f"📝 {comment or '—'}",
            f"📅 {fmt.format_date(created_at)}",
            "",
        ]
        user = await queries.get_user(db, telegram_id)
        budgets = (user or {}).get("budgets") or {}
        if category and category in budgets:
            limit = float(budgets[category])
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            ms, me = month_range_utc(created_at.year, created_at.month)
            stats_rows = await queries.get_expense_stats(
                db,
                telegram_id,
                ms,
                me,
                end_inclusive=False,
            )
            spent = 0.0
            for row in stats_rows:
                if row["_id"] == category:
                    spent = float(row["total"])
                    break
            pct = (spent / limit * 100) if limit else 0
            bar = fmt.format_progress_bar(min(100, pct))
            lines.append(
                f'💰 Залишок бюджету "{category.rsplit(" ", 1)[-1]}": '
                f"{fmt.format_money(max(0, limit - spent))} / {fmt.format_money(limit)} {sym}"
            )
            lines.append(f"{bar} {min(100, pct):.0f}%")
        return "\n".join(lines)
    lines = [
        "✅ Дохід записано!",
        "",
        f"{category or '❓'} — {fmt.format_money(amount)} {sym}",
        f"📅 {fmt.format_date(created_at)}",
        "",
    ]
    now = datetime.now(timezone.utc)
    inc, exp = await queries.balance_totals_month(db, telegram_id, now.year, now.month)
    bal = inc - exp
    title = fmt.uk_month_year(now)
    lines.append(f"📊 Баланс {title.split()[0]}: {'+' if bal >= 0 else ''}{fmt.format_money(bal)} грн")
    return "\n".join(lines)


@router.message(F.text & ~F.text.startswith("/"))
async def on_free_text(
    message: Message,
    db: AsyncIOMotorDatabase,
    state: FSMContext,
) -> None:
    assert message.text and message.from_user
    parsed = parse_transaction_message(message.text)
    if parsed is None:
        await message.answer(
            "❓ Не знайшов суму. Приклад: `кава 85` або `+5000 зарплата`",
            parse_mode="Markdown",
        )
        return

    await queries.upsert_user(
        db,
        message.from_user.id,
        message.from_user.username,
        message.from_user.first_name,
    )

    if parsed.type == "expense" and parsed.category is None:
        await state.set_state(PendingTx.waiting_expense_category)
        await state.update_data(
            amount=parsed.amount,
            comment=parsed.comment,
            type="expense",
        )
        await message.answer(
            "Оберіть категорію:",
            reply_markup=ik.expense_category_pick("pex"),
        )
        return

    if parsed.type == "income" and parsed.category is None:
        await state.set_state(PendingTx.waiting_income_category)
        await state.update_data(
            amount=parsed.amount,
            comment=parsed.comment,
            type="income",
        )
        await message.answer(
            "Оберіть категорію доходу:",
            reply_markup=ik.income_category_pick("pin"),
        )
        return

    oid = await queries.add_transaction(
        db,
        message.from_user.id,
        parsed.type,
        parsed.amount,
        parsed.category,
        parsed.comment,
    )
    doc = await queries.get_transaction(db, message.from_user.id, oid)
    assert doc
    text = await _format_confirmation(
        db,
        message.from_user.id,
        type_=parsed.type,
        amount=parsed.amount,
        category=parsed.category,
        comment=parsed.comment,
        created_at=doc["created_at"],
    )
    await message.answer(text, reply_markup=ik.transaction_actions(str(oid)))


@router.callback_query(F.data.startswith("pex:"))
async def pick_pending_expense_cat(
    query: CallbackQuery,
    db: AsyncIOMotorDatabase,
    state: FSMContext,
) -> None:
    assert query.data and query.message and query.from_user
    idx = int(query.data.split(":")[1])
    data = await state.get_data()
    await state.clear()
    cat = EXP_KEYS[idx]
    oid = await queries.add_transaction(
        db,
        query.from_user.id,
        "expense",
        float(data["amount"]),
        cat,
        str(data.get("comment", "")),
    )
    doc = await queries.get_transaction(db, query.from_user.id, oid)
    assert doc
    text = await _format_confirmation(
        db,
        query.from_user.id,
        type_="expense",
        amount=float(data["amount"]),
        category=cat,
        comment=str(data.get("comment", "")),
        created_at=doc["created_at"],
    )
    await query.message.edit_text(text)
    await query.message.answer(
        "Дії:", reply_markup=ik.transaction_actions(str(oid))
    )
    await query.answer()


@router.callback_query(F.data.startswith("pin:"))
async def pick_pending_income_cat(
    query: CallbackQuery,
    db: AsyncIOMotorDatabase,
    state: FSMContext,
) -> None:
    assert query.data and query.message and query.from_user
    idx = int(query.data.split(":")[1])
    data = await state.get_data()
    await state.clear()
    cat = INC_KEYS[idx]
    oid = await queries.add_transaction(
        db,
        query.from_user.id,
        "income",
        float(data["amount"]),
        cat,
        str(data.get("comment", "")),
    )
    doc = await queries.get_transaction(db, query.from_user.id, oid)
    assert doc
    text = await _format_confirmation(
        db,
        query.from_user.id,
        type_="income",
        amount=float(data["amount"]),
        category=cat,
        comment=str(data.get("comment", "")),
        created_at=doc["created_at"],
    )
    await query.message.edit_text(text)
    await query.message.answer(
        "Дії:", reply_markup=ik.transaction_actions(str(oid))
    )
    await query.answer()


@router.callback_query(F.data.startswith("d:"))
async def cb_delete(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.message and query.from_user
    hex_id = query.data.split(":", 1)[1]
    try:
        oid = ObjectId(hex_id)
    except InvalidId:
        await query.answer("Невірний id", show_alert=True)
        return
    ok = await queries.delete_transaction(db, query.from_user.id, oid)
    if ok:
        await query.message.edit_text("🗑 Запис видалено.")
    else:
        await query.answer("Не знайдено", show_alert=True)
        return
    await query.answer()


@router.callback_query(F.data.startswith("ec:"))
async def cb_edit_cat_start(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.message and query.from_user
    hex_id = query.data.split(":", 1)[1]
    try:
        oid = ObjectId(hex_id)
    except InvalidId:
        await query.answer("Невірний id", show_alert=True)
        return
    doc = await queries.get_transaction(db, query.from_user.id, oid)
    if not doc:
        await query.answer("Не знайдено", show_alert=True)
        return
    if doc["type"] == "expense":
        await query.message.answer(
            "Оберіть нову категорію:",
            reply_markup=ik.expense_category_pick(f"nc:{hex_id}"),
        )
    else:
        await query.message.answer(
            "Оберіть нову категорію:",
            reply_markup=ik.income_category_pick(f"nci:{hex_id}"),
        )
    await query.answer()


NC_EXP = re.compile(r"^nc:([a-f\d]{24}):(\d+)$", re.I)


@router.callback_query(lambda c: bool(c.data and NC_EXP.match(c.data)))
async def cb_new_cat_expense(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.from_user
    m = NC_EXP.match(query.data)
    assert m
    oid_hex, idx_s = m.group(1), m.group(2)
    idx = int(idx_s)
    oid = ObjectId(oid_hex)
    cat = EXP_KEYS[idx]
    await queries.update_transaction_category(db, query.from_user.id, oid, cat)
    await query.answer("Категорію оновлено!")
    if query.message:
        await query.message.edit_text(f"✅ Категорія: {cat}")


NC_INC = re.compile(r"^nci:([a-f\d]{24}):(\d+)$", re.I)


@router.callback_query(lambda c: bool(c.data and NC_INC.match(c.data)))
async def cb_new_cat_income(query: CallbackQuery, db: AsyncIOMotorDatabase) -> None:
    assert query.data and query.from_user
    m = NC_INC.match(query.data)
    assert m
    oid_hex, idx_s = m.group(1), m.group(2)
    idx = int(idx_s)
    oid = ObjectId(oid_hex)
    cat = INC_KEYS[idx]
    await queries.update_transaction_category(db, query.from_user.id, oid, cat)
    await query.answer("Категорію оновлено!")
    if query.message:
        await query.message.edit_text(f"✅ Категорія: {cat}")
