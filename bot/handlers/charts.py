from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import BufferedInputFile, CallbackQuery, Message
from motor.motor_asyncio import AsyncIOMotorDatabase

from bot.db import queries
from bot.keyboards import inline as ik
from bot.services import charts as chart_svc
from bot.utils import formatters as fmt

router = Router(name="charts")


@router.message(Command("chart"))
async def cmd_chart(message: Message) -> None:
    await message.answer("📊 Оберіть графік:", reply_markup=ik.chart_type_keyboard())


@router.callback_query(F.data.startswith("ch:"))
async def cb_chart(
    query: CallbackQuery,
    db: AsyncIOMotorDatabase,
    bot: Bot,
) -> None:
    assert query.data and query.from_user
    kind = query.data.split(":")[1]
    now = datetime.now(timezone.utc)
    start_m, end_m = queries.period_month_now()

    if kind == "pie":
        stats = await queries.get_expense_stats(
            db, query.from_user.id, start_m, end_m, end_inclusive=False
        )
        labels = [row["_id"] or "?" for row in stats]
        values = [float(row["total"]) for row in stats]
        title = f"Витрати — {fmt.uk_month_year(now)}"
        buf = chart_svc.generate_pie_chart(title, labels, values)
        await bot.send_photo(
            query.from_user.id,
            photo=BufferedInputFile(buf.getvalue(), filename="pie.png"),
        )
    elif kind == "bar":
        start_w = now - timedelta(days=7)
        series = await queries.get_daily_expense_series(
            db,
            query.from_user.id,
            start_w,
            now,
            end_inclusive=True,
        )
        day_map = {row["_id"]: float(row["total"]) for row in series}
        labels = []
        values = []
        for i in range(7):
            d = (now - timedelta(days=6 - i)).date()
            key = d.isoformat()
            labels.append(d.strftime("%a"))
            values.append(day_map.get(key, 0.0))
        buf = chart_svc.generate_bar_chart("Витрати по днях (7 днів)", labels, values)
        await bot.send_photo(
            query.from_user.id,
            photo=BufferedInputFile(buf.getvalue(), filename="bar.png"),
        )
    else:
        start_30 = now - timedelta(days=30)
        series = await queries.get_daily_expense_series(
            db,
            query.from_user.id,
            start_30,
            now,
            end_inclusive=True,
        )
        labels = [row["_id"][-5:] for row in series]
        values = [float(row["total"]) for row in series]
        buf = chart_svc.generate_line_chart("Тренд витрат (30 днів)", labels, values)
        await bot.send_photo(
            query.from_user.id,
            photo=BufferedInputFile(buf.getvalue(), filename="line.png"),
        )

    await query.answer()
