from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def month_range_utc(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_excl = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_excl = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end_excl


def pipeline_balance_month(
    telegram_id: int,
    start: datetime,
    end_excl: datetime,
) -> list[dict[str, Any]]:
    return [
        {
            "$match": {
                "telegram_id": telegram_id,
                "date": {"$gte": start, "$lt": end_excl},
                "internal_transfer": {"$ne": True},
                "deleted": {"$ne": True},
            }
        },
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]


def pipeline_stats_expense_by_category(
    telegram_id: int,
    start: datetime,
    end: datetime,
    *,
    end_inclusive: bool = False,
) -> list[dict[str, Any]]:
    bound: dict[str, Any] = {"$gte": start}
    bound["$lte" if end_inclusive else "$lt"] = end
    return [
        {
            "$match": {
                "telegram_id": telegram_id,
                "type": "expense",
                "date": bound,
                "internal_transfer": {"$ne": True},
                "deleted": {"$ne": True},
            }
        },
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]


def pipeline_daily_expense_totals(
    telegram_id: int,
    start: datetime,
    end: datetime,
    *,
    end_inclusive: bool = False,
) -> list[dict[str, Any]]:
    bound: dict[str, Any] = {"$gte": start}
    bound["$lte" if end_inclusive else "$lt"] = end
    return [
        {
            "$match": {
                "telegram_id": telegram_id,
                "type": "expense",
                "date": bound,
                "internal_transfer": {"$ne": True},
                "deleted": {"$ne": True},
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$date"},
                },
                "total": {"$sum": "$amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
