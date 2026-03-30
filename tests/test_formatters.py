from datetime import datetime

from bot.utils.formatters import (
    format_date,
    format_date_short,
    format_money,
    format_progress_bar,
)


def test_format_money_int():
    assert format_money(1200) == "1 200"


def test_format_money_decimal():
    assert format_money(85.5) == "85.50"


def test_format_money_big():
    assert format_money(1000000) == "1 000 000"


def test_progress_bar():
    bar = format_progress_bar(84, width=15)
    assert len(bar) == 15
    assert bar.count("█") + bar.count("░") == 15
    assert bar.startswith("█")


def test_format_date():
    dt = datetime(2026, 3, 30, 14, 23, 0)
    assert format_date(dt) == "30.03.2026, 14:23"


def test_format_date_short():
    dt = datetime(2026, 3, 30, 14, 23, 0)
    assert format_date_short(dt) == "30.03"
