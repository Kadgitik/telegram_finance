from __future__ import annotations

from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase


def parse_month_key(month_key: str | None) -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    if not month_key:
        return now.year, now.month
    try:
        year_s, month_s = month_key.split("-", 1)
        year = int(year_s)
        month = int(month_s)
        if month < 1 or month > 12:
            raise ValueError("month out of range")
        return year, month
    except Exception as exc:
        raise ValueError("Очікується month у форматі YYYY-MM") from exc


def financial_month_key_for_date(dt: datetime, pay_day: int) -> str:
    """YYYY-MM ключа фінансового місяця для дати (період [pay_day; наступний pay_day))."""
    pay = max(1, min(28, int(pay_day or 1)))
    y, m, d = dt.year, dt.month, dt.day
    if d >= pay:
        return f"{y}-{m:02d}"
    if m == 1:
        return f"{y - 1}-12"
    return f"{y}-{m - 1:02d}"


def month_window(year: int, month: int, pay_day: int) -> tuple[datetime, datetime]:
    pay = max(1, min(28, int(pay_day or 1)))
    start = datetime(year, month, pay, tzinfo=timezone.utc)
    if month == 12:
        next_month = datetime(year + 1, 1, pay, tzinfo=timezone.utc)
    else:
        next_month = datetime(year, month + 1, pay, tzinfo=timezone.utc)
    return start, next_month


def month_window_from_key(month_key: str | None, pay_day: int) -> tuple[datetime, datetime, str]:
    year, month = parse_month_key(month_key)
    start, end_excl = month_window(year, month, pay_day)
    return start, end_excl, f"{year}-{month:02d}"


def resolve_pay_day_from_user(user: dict | None, month_key: str | None) -> int:
    """День зарплати для ключа місяця без повторного find_one."""
    base = max(1, min(28, int((user or {}).get("pay_day", 1))))
    if month_key:
        overrides = (user or {}).get("pay_day_overrides") or {}
        val = overrides.get(month_key)
        if val is not None:
            return max(1, min(28, int(val)))
    return base


async def resolve_pay_day(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    pay_day: int | None = None,
    month_key: str | None = None,
) -> int:
    if pay_day is not None:
        return max(1, min(28, int(pay_day)))
    user = await db["users"].find_one(
        {"telegram_id": telegram_id},
        {"pay_day": 1, "pay_day_overrides": 1},
    )
    return resolve_pay_day_from_user(user, month_key)


def human_period(start: datetime, end_excl: datetime) -> str:
    end_inclusive = end_excl - timedelta(seconds=1)
    return f"{start.day:02d}.{start.month:02d}.{start.year} — {end_inclusive.day:02d}.{end_inclusive.month:02d}.{end_inclusive.year}"
