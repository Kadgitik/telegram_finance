"""Тести валідації Telegram WebApp initData."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from backend.app.services.auth import validate_init_data, get_telegram_id_from_init_data

BOT = "123456:ABCDEF"


def _sign(pairs: dict[str, str]) -> str:
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    sk = hmac.new(b"WebAppData", BOT.encode(), hashlib.sha256).digest()
    return hmac.new(sk, data_check_string.encode(), hashlib.sha256).hexdigest()


def test_validate_init_data_ok():
    pairs = {
        "user": json.dumps({"id": 42, "first_name": "T"}),
        "auth_date": str(int(time.time())),
    }
    h = _sign(pairs)
    init = urlencode({**pairs, "hash": h})
    user = validate_init_data(init, bot_token=BOT)
    assert user["id"] == 42


def test_validate_bad_hash():
    pairs = {
        "user": json.dumps({"id": 1}),
        "auth_date": str(int(time.time())),
    }
    init = urlencode({**pairs, "hash": "deadbeef"})
    with pytest.raises(ValueError, match="підпис"):
        validate_init_data(init, bot_token=BOT)


def test_get_telegram_id():
    pairs = {
        "user": json.dumps({"id": 99}),
        "auth_date": str(int(time.time())),
    }
    init = urlencode({**pairs, "hash": _sign(pairs)})
    assert get_telegram_id_from_init_data(init, bot_token=BOT) == 99
