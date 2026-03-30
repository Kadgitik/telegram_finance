from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot.constants import DEFAULT_CATEGORIES, INCOME_CATEGORIES


def chunk_buttons(
    items: list[tuple[str, str]], row_size: int = 2
) -> list[list[InlineKeyboardButton]]:
    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for text, data in items:
        row.append(InlineKeyboardButton(text=text, callback_data=data))
        if len(row) >= row_size:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    return rows


def transaction_actions(oid_hex: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✏️ Змінити категорію", callback_data=f"ec:{oid_hex}"
                ),
                InlineKeyboardButton(text="🗑 Видалити", callback_data=f"d:{oid_hex}"),
            ],
        ]
    )


def expense_category_pick(prefix: str) -> InlineKeyboardMarkup:
    cats = list(DEFAULT_CATEGORIES.keys())
    items = [(c, f"{prefix}:{i}") for i, c in enumerate(cats)]
    return InlineKeyboardMarkup(inline_keyboard=chunk_buttons(items, 2))


def income_category_pick(prefix: str) -> InlineKeyboardMarkup:
    cats = list(INCOME_CATEGORIES.keys())
    items = [(c, f"{prefix}:{i}") for i, c in enumerate(cats)]
    return InlineKeyboardMarkup(inline_keyboard=chunk_buttons(items, 2))


def stats_period_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📅 Тиждень", callback_data="st:week"),
                InlineKeyboardButton(text="📅 Місяць", callback_data="st:month"),
            ],
            [
                InlineKeyboardButton(text="📅 3 місяці", callback_data="st:3m"),
                InlineKeyboardButton(text="📅 Рік", callback_data="st:year"),
            ],
        ]
    )


def chart_type_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🥧 По категоріях", callback_data="ch:pie"),
                InlineKeyboardButton(text="📊 По днях", callback_data="ch:bar"),
            ],
            [InlineKeyboardButton(text="📈 Тренд 30 днів", callback_data="ch:line")],
        ]
    )


def history_nav(page: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data=f"h:{max(0, page - 1)}"),
                InlineKeyboardButton(text="Далі ▶️", callback_data=f"h:{page + 1}"),
            ],
        ]
    )
