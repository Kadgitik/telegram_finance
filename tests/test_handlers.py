from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, User
from bson import ObjectId

from bot.db import queries
from bot.handlers.start import cmd_start
from bot.handlers.transactions import cb_delete, on_free_text


class FakeDB:
    pass


@pytest.mark.asyncio
async def test_start_creates_user(monkeypatch):
    calls = []

    async def fake_upsert(db, tid, username, first_name):
        calls.append((tid, username, first_name))

    monkeypatch.setattr(queries, "upsert_user", fake_upsert)

    user = User(id=42, is_bot=False, first_name="Vlad")
    message = MagicMock(spec=Message)
    message.from_user = user
    message.answer = AsyncMock()

    db = FakeDB()
    await cmd_start(message, db)

    assert calls == [(42, None, "Vlad")]
    message.answer.assert_awaited_once()


@pytest.mark.asyncio
async def test_free_text_expense_triggers_add(monkeypatch):
    oid = ObjectId()
    monkeypatch.setattr(queries, "upsert_user", AsyncMock())
    monkeypatch.setattr(queries, "get_user", AsyncMock(return_value=None))
    monkeypatch.setattr(queries, "add_transaction", AsyncMock(return_value=oid))
    monkeypatch.setattr(
        queries,
        "get_transaction",
        AsyncMock(
            return_value={
                "_id": oid,
                "created_at": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ),
            }
        ),
    )

    user = User(id=7, is_bot=False, first_name="T")
    message = MagicMock(spec=Message)
    message.from_user = user
    message.text = "кава 85"
    message.answer = AsyncMock()

    state = MagicMock(spec=FSMContext)
    state.set_state = AsyncMock()
    state.update_data = AsyncMock()
    state.get_data = AsyncMock(return_value={})

    await on_free_text(message, FakeDB(), state)

    queries.add_transaction.assert_awaited()
    message.answer.assert_awaited()


@pytest.mark.asyncio
async def test_delete_callback(monkeypatch):
    oid = ObjectId()
    monkeypatch.setattr(queries, "delete_transaction", AsyncMock(return_value=True))

    query = MagicMock()
    query.data = f"d:{oid}"
    query.from_user = User(id=1, is_bot=False, first_name="X")
    query.answer = AsyncMock()
    msg = MagicMock()
    msg.edit_text = AsyncMock()
    query.message = msg

    await cb_delete(query, FakeDB())

    queries.delete_transaction.assert_awaited()
    msg.edit_text.assert_awaited_with("🗑 Запис видалено.")
