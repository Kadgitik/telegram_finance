"""Shared regex classifiers for Monobank transactions."""
from __future__ import annotations

import re

INTERNAL_TRANSFER_RE = re.compile(
    r"^(З|Зі|На)\s+.*(картки|картку|карти|карту|рахунку|рахунок)"
    r"|^Переказ на картку"
    r"|^Переказ на карту"
    r"|^Поповнення картки"
    r"|^Поповнення карти"
    r"|^Між рахунками"
    r"|^Переказ між рахунками"
    r"|^Переказ$"
    r"|^Переказ коштів$",
    re.IGNORECASE,
)

SAVINGS_RE = re.compile(
    r"^(З|Зі|На)\s+.*(банки|банку)"
    r"|^На банку\b"
    r"|^З банки\b"
    r"|^Накопичення\b",
    re.IGNORECASE,
)

CREDIT_RE = re.compile(
    r"погашення кредит|кредит до зарплати|відсотки за|погашення заборгованості|кредит до завтра",
    re.IGNORECASE,
)


def is_internal_transfer(description: str, mcc: int | None = 0) -> bool:
    if INTERNAL_TRANSFER_RE.search(description or ""):
        return True
    if mcc == 4829 and not (description or "").strip():
        return True
    return False

def is_savings(description: str) -> bool:
    return bool(SAVINGS_RE.search(description or ""))

def is_credit(description: str) -> bool:
    return bool(CREDIT_RE.search(description or ""))
