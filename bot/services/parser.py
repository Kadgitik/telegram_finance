from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from bot.constants import DEFAULT_CATEGORIES, INCOME_CATEGORIES

_AMOUNT_RE = re.compile(r"(\d+[.,]?\d*)")


@dataclass
class ParseResult:
    type: Literal["expense", "income"]
    amount: float
    category: str | None
    comment: str


def _normalize_text(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def _strip_currency_tokens(text: str) -> str:
    for tok in ("грн", "uah", "₴", "гривень"):
        text = re.sub(rf"\b{re.escape(tok)}\b", "", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def _extract_amount(text: str) -> tuple[float | None, str]:
    """First number wins; return (amount, text_without_amount_tokens)."""
    m = _AMOUNT_RE.search(text.replace(",", "."))
    if not m:
        return None, text
    raw = m.group(1).replace(",", ".")
    try:
        amount = float(raw)
    except ValueError:
        return None, text
    rest = text[: m.start()] + " " + text[m.end() :]
    rest = _strip_currency_tokens(rest)
    rest = re.sub(r"\s+", " ", rest).strip()
    return amount, rest


def _best_category_match(text: str, mapping: dict[str, list[str]]) -> str | None:
    if not text:
        return None
    text_l = text.lower()
    candidates: list[tuple[int, int, str]] = []
    for cat, aliases in mapping.items():
        for alias in aliases:
            al = alias.lower()
            if al in text_l:
                pos = text_l.find(al)
                candidates.append((-len(al), pos, cat))
    if not candidates:
        for cat, aliases in mapping.items():
            for alias in aliases:
                al = alias.lower()
                for word in re.findall(r"[\w']+", text_l):
                    if al == word or word.startswith(al) or al.startswith(word):
                        candidates.append((-len(al), text_l.find(word) if word in text_l else 99, cat))
    if not candidates:
        return None
    candidates.sort()
    _score, _pos, cat = candidates[0]
    seen = {c for _, _, c in candidates if _ == candidates[0][0]}
    if len(seen) > 1:
        first = sorted(seen)[0]
        return first
    return candidates[0][2]


def parse_transaction_message(raw: str) -> ParseResult | None:
    text = raw.strip()
    if not text:
        return None
    norm = _normalize_text(text)
    is_income = norm.startswith("+")
    body = norm[1:].strip() if is_income else norm
    body = _strip_currency_tokens(body)

    amount, remainder = _extract_amount(body)
    if amount is None:
        return None

    mapping = INCOME_CATEGORIES if is_income else DEFAULT_CATEGORIES
    cat = _best_category_match(remainder, mapping)
    comment = remainder.strip() if remainder else ""

    return ParseResult(
        type="income" if is_income else "expense",
        amount=amount,
        category=cat,
        comment=comment,
    )
