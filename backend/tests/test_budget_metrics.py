"""Тести формул бюджетних метрик (без БД)."""
from __future__ import annotations

from datetime import datetime, timezone

from backend.app.services.budgets import compute_budget_metrics

# Травень 2026: рівно 31 день у вікні [1 May, 1 Jun).
START = datetime(2026, 5, 1, tzinfo=timezone.utc)
END = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_normal_mid_month():
    # День 10 (включно з сьогодні): days_elapsed = 10.
    now = datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=10000, budgets={"Їжа": 20000, "Транспорт": 10000},
        start=START, end_excl=END, now=now,
    )
    assert m["total_budget"] == 30000
    assert m["days_in_period"] == 31
    assert m["days_elapsed"] == 10
    assert m["days_left"] == 21
    assert m["can_spend"] == 20000
    assert round(m["daily_pace"], 2) == 1000.0
    # safe_pace = 30000/31 ≈ 967.74; pace_vs = round((1000/967.74 - 1)*100) = 3
    assert m["pace_vs_budget_pct"] == 3


def test_no_budget():
    now = datetime(2026, 5, 10, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=5000, budgets={}, start=START, end_excl=END, now=now,
    )
    assert m["total_budget"] == 0
    assert m["safe_pace"] is None
    assert m["pace_vs_budget_pct"] is None
    assert m["can_spend"] == -5000  # тратив без бюджету


def test_past_month_elapsed_is_full_period():
    now = datetime(2026, 7, 1, tzinfo=timezone.utc)  # після END
    m = compute_budget_metrics(
        spent=31000, budgets={"Їжа": 31000},
        start=START, end_excl=END, now=now,
    )
    assert m["days_elapsed"] == 31
    assert m["days_left"] == 0
    assert round(m["daily_pace"], 2) == 1000.0


def test_over_budget_gives_negative_can_spend():
    now = datetime(2026, 5, 20, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=12000, budgets={"Їжа": 10000},
        start=START, end_excl=END, now=now,
    )
    assert m["can_spend"] == -2000


def test_future_month_elapsed_clamped_to_one():
    now = datetime(2026, 4, 1, tzinfo=timezone.utc)  # до START
    m = compute_budget_metrics(
        spent=0, budgets={"Їжа": 31000},
        start=START, end_excl=END, now=now,
    )
    assert m["days_elapsed"] == 1
    assert m["daily_pace"] == 0
