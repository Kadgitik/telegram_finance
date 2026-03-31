from datetime import datetime, timezone

import mongomock

from backend.app.routers.categories import _normalize_custom_categories, _upsert_custom_category
from bot.db.pipelines import pipeline_stats_expense_by_category


def test_custom_category_upsert_is_deduplicated():
    existing = [
        "🛒 Супермаркет",
        {"label": "🛒 Супермаркет", "emoji": "🛒", "name": "Супермаркет", "keywords": ["silpo"]},
    ]
    updated = _upsert_custom_category(existing, "🛒", "Супермаркет", ["novus", "varus"])
    assert len(updated) == 1
    assert updated[0]["label"] == "🛒 Супермаркет"
    assert updated[0]["keywords"] == ["novus", "varus"]


def test_stats_includes_transactions_with_custom_category():
    db = mongomock.MongoClient()["test_finance"]
    tid = 777
    created = datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc)
    db["users"].insert_one(
        {
            "telegram_id": tid,
            "custom_categories": [{"label": "🛒 Супермаркет", "emoji": "🛒", "name": "Супермаркет"}],
        }
    )
    db["transactions"].insert_many(
        [
            {
                "telegram_id": tid,
                "type": "expense",
                "amount": 300.0,
                "category": "🛒 Супермаркет",
                "comment": "Сільпо",
                "created_at": created,
            },
            {
                "telegram_id": tid,
                "type": "expense",
                "amount": 120.0,
                "category": "🛒 Супермаркет",
                "comment": "VARUS",
                "created_at": created,
            },
        ]
    )
    start = datetime(2026, 3, 9, tzinfo=timezone.utc)
    end = datetime(2026, 4, 9, tzinfo=timezone.utc)
    rows = list(
        db["transactions"].aggregate(
            pipeline_stats_expense_by_category(tid, start, end, end_inclusive=False)
        )
    )
    names = {r["_id"]: float(r["total"]) for r in rows}
    assert "🛒 Супермаркет" in names
    assert names["🛒 Супермаркет"] == 420.0


def test_normalize_custom_categories_handles_legacy_strings():
    normalized = _normalize_custom_categories(["🎵 Музика", "Хобі"])
    assert normalized[0]["label"] == "🎵 Музика"
    assert normalized[0]["name"] == "Музика"
    assert normalized[1]["emoji"] == "🏷"
    assert normalized[1]["name"] == "Хобі"
