"""Тести валідації BudgetUpdate."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.models.schemas import BudgetUpdate


def test_valid_budgets_pass_and_strip_keys():
    m = BudgetUpdate(budgets={"  Їжа  ": 5000, "Транспорт": 1500.5})
    assert m.budgets == {"Їжа": 5000.0, "Транспорт": 1500.5}


def test_zero_is_dropped():
    # 0 means "no limit" — we drop it so it isn't stored.
    m = BudgetUpdate(budgets={"Їжа": 0})
    assert m.budgets == {}


def test_negative_amount_rejected():
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets={"Їжа": -10})


def test_infinity_rejected():
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets={"Їжа": float("inf")})


def test_too_many_categories_rejected():
    big = {f"cat{i}": 1 for i in range(101)}
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets=big)


def test_empty_key_rejected():
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets={"   ": 100})


def test_default_is_empty_dict():
    assert BudgetUpdate().budgets == {}
