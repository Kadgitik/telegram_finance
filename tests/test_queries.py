from datetime import datetime, timezone

import mongomock
import pytest
from bson import ObjectId

from bot.db.pipelines import month_range_utc, pipeline_balance_month


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    return client["test_finance"]


def test_balance_pipeline(mock_db):
    tid = 111
    y, m = 2026, 3
    start, end_excl = month_range_utc(y, m)
    mock_db["transactions"].insert_many(
        [
            {
                "telegram_id": tid,
                "type": "expense",
                "amount": 100.0,
                "category": "🍔 Їжа",
                "comment": "a",
                "created_at": start,
            },
            {
                "telegram_id": tid,
                "type": "income",
                "amount": 5000.0,
                "category": "💰 Зарплата",
                "comment": "z",
                "created_at": start,
            },
        ]
    )
    res = list(mock_db["transactions"].aggregate(pipeline_balance_month(tid, y, m)))
    d = {r["_id"]: r["total"] for r in res}
    assert d["expense"] == 100.0
    assert d["income"] == 5000.0


def test_add_user_and_transaction_sync_logic(mock_db):
    tid = 222
    now = datetime.now(timezone.utc)
    mock_db["users"].insert_one(
        {
            "telegram_id": tid,
            "username": "u",
            "first_name": "Test",
            "default_currency": "UAH",
            "custom_categories": [],
            "budgets": {},
            "created_at": now,
            "updated_at": now,
        }
    )
    oid = ObjectId()
    mock_db["transactions"].insert_one(
        {
            "_id": oid,
            "telegram_id": tid,
            "type": "expense",
            "amount": 85.0,
            "category": "🍔 Їжа",
            "comment": "кава",
            "created_at": now,
        }
    )
    doc = mock_db["transactions"].find_one({"_id": oid})
    assert doc["amount"] == 85.0


def test_delete_transaction_mock(mock_db):
    tid = 333
    oid = ObjectId()
    mock_db["transactions"].insert_one(
        {
            "_id": oid,
            "telegram_id": tid,
            "type": "expense",
            "amount": 1,
            "category": "x",
            "comment": "",
            "created_at": datetime.now(timezone.utc),
        }
    )
    r = mock_db["transactions"].delete_one({"telegram_id": tid, "_id": oid})
    assert r.deleted_count == 1


def test_custom_category_update(mock_db):
    tid = 444
    mock_db["users"].insert_one(
        {
            "telegram_id": tid,
            "custom_categories": [],
            "budgets": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )
    mock_db["users"].update_one(
        {"telegram_id": tid},
        {"$addToSet": {"custom_categories": "🎨 Хобі"}},
    )
    u = mock_db["users"].find_one({"telegram_id": tid})
    assert "🎨 Хобі" in u["custom_categories"]

