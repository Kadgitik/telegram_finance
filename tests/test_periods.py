"""Логіка фінансового місяця (день зарплати)."""
from datetime import datetime, timezone

from backend.app.services.periods import financial_month_key_for_date, resolve_pay_day_from_user


def test_financial_month_key_before_payday_is_previous_label():
    # 01.04.2026, зарплата 9-го → ще фінансовий "березень" (09.03–08.04)
    d = datetime(2026, 4, 1, 12, 0, 0, tzinfo=timezone.utc)
    assert financial_month_key_for_date(d, 9) == "2026-03"


def test_financial_month_key_on_or_after_payday():
    d = datetime(2026, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    assert financial_month_key_for_date(d, 9) == "2026-04"


def test_financial_month_key_january_rollover():
    d = datetime(2026, 1, 5, 12, 0, 0, tzinfo=timezone.utc)
    assert financial_month_key_for_date(d, 9) == "2025-12"


def test_resolve_pay_day_from_user_override():
    user = {"pay_day": 9, "pay_day_overrides": {"2026-03": 15}}
    assert resolve_pay_day_from_user(user, "2026-03") == 15
    assert resolve_pay_day_from_user(user, "2026-04") == 9


def test_resolve_pay_day_from_user_no_override():
    assert resolve_pay_day_from_user({"pay_day": 9}, "2026-04") == 9
