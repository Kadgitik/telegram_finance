"""Валідація Telegram WebApp initData (HMAC-SHA256)."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl

from bot import config


def validate_init_data(
    init_data: str,
    *,
    bot_token: str | None = None,
    max_age_seconds: int = 3600,
) -> dict[str, Any]:
    """
    Повертає розпарсений об'єкт user (поле user з initData).
    Кидає ValueError при невалідному підписі або простроченому auth_date.
    """
    token = (bot_token or config.BOT_TOKEN).strip()
    if not token:
        raise ValueError("BOT_TOKEN не заданий")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    hash_received = pairs.pop("hash", None)
    if not hash_received:
        raise ValueError("Відсутнє поле hash")

    auth_raw = pairs.get("auth_date")
    if auth_raw:
        try:
            auth_ts = int(auth_raw)
        except ValueError as e:
            raise ValueError("Некоректний auth_date") from e
        if time.time() - auth_ts > max_age_seconds:
            raise ValueError("initData прострочено")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(
        b"WebAppData", token.encode("utf-8"), hashlib.sha256
    ).digest()
    calculated = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(calculated, hash_received):
        raise ValueError("Невірний підпис initData (підпис)")

    user_raw = pairs.get("user")
    if not user_raw:
        raise ValueError("Відсутнє поле user")
    return json.loads(user_raw)


def get_telegram_id_from_init_data(
    init_data: str, *, bot_token: str | None = None
) -> int:
    user = validate_init_data(init_data, bot_token=bot_token)
    uid = user.get("id")
    if uid is None:
        raise ValueError("user.id відсутній")
    return int(uid)
