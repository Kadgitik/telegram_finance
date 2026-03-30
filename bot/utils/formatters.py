from __future__ import annotations

from datetime import datetime


def format_money(value: float) -> str:
    if value == int(value):
        s = f"{int(value):,}".replace(",", " ")
    else:
        s = f"{value:,.2f}".replace(",", " ")
    if "." in s:
        parts = s.split(".")
        parts[0] = parts[0].replace(",", " ")
        s = ".".join(parts)
    return s


def format_progress_bar(percent: float, width: int = 15) -> str:
    p = max(0.0, min(100.0, percent))
    filled = int(round((p / 100.0) * width))
    filled = min(filled, width)
    return "█" * filled + "░" * (width - filled)


def format_date(dt: datetime) -> str:
    return dt.strftime("%d.%m.%Y, %H:%M")


def format_date_short(dt: datetime) -> str:
    return dt.strftime("%d.%m")


def format_time_only(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def uk_month_year(dt: datetime) -> str:
    months = (
        "січня",
        "лютого",
        "березня",
        "квітня",
        "травня",
        "червня",
        "липня",
        "серпня",
        "вересня",
        "жовтня",
        "листопада",
        "грудня",
    )
    return f"{months[dt.month - 1]} {dt.year}"
