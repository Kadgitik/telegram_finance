"""Чисті обчислення бюджетних метрик для головного екрана (без БД)."""
from __future__ import annotations

from datetime import datetime
from typing import Any


def compute_budget_metrics(
    *,
    spent: float,
    budgets: dict[str, float] | None,
    start: datetime,
    end_excl: datetime,
    now: datetime,
) -> dict[str, Any]:
    """Повертає метрики для карток «Темп витрат» та «Можна витрати».

    spent       — сума витрат за період (з bootstrap).
    budgets     — map {категорія: ліміт}.
    start/end   — межі фінансового місяця [start, end_excl).
    now         — поточний момент (UTC).
    """
    budgets = budgets or {}
    total_budget = float(
        sum(v for v in budgets.values() if isinstance(v, (int, float)))
    )
    days_in_period = max(1, (end_excl - start).days)
    # Сьогодні рахуємо «прожитим» (+1). Клампимо в [1, days_in_period]:
    # для минулих місяців → days_in_period, для майбутніх → 1.
    days_elapsed = max(1, min(days_in_period, (now - start).days + 1))
    days_left = days_in_period - days_elapsed

    can_spend = total_budget - spent
    daily_pace = spent / days_elapsed
    safe_pace = (total_budget / days_in_period) if total_budget > 0 else None
    if safe_pace and safe_pace > 0:
        pace_vs_budget_pct = round((daily_pace / safe_pace - 1) * 100)
    else:
        pace_vs_budget_pct = None

    return {
        "total_budget": total_budget,
        "days_in_period": days_in_period,
        "days_elapsed": days_elapsed,
        "days_left": days_left,
        "can_spend": can_spend,
        "daily_pace": daily_pace,
        "safe_pace": safe_pace,
        "pace_vs_budget_pct": pace_vs_budget_pct,
    }
