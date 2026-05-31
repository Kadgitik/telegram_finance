from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float = Field(gt=0)
    category: str
    description: str = ""
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None
    date: str | None = None


class TransactionUpdate(BaseModel):
    category: str | None = None
    description: str | None = None
    date: str | None = None


class CategoryCreate(BaseModel):
    type: Literal["expense", "income"]
    key: str = Field(min_length=1, max_length=50)
    icon: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=3, max_length=20)




class MonoConnectRequest(BaseModel):
    token: str = Field(min_length=10)


class MonoSetDefaultAccount(BaseModel):
    account_id: str


class SavingsCreate(BaseModel):
    amount: float
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)


class GoalDeposit(BaseModel):
    amount: float


class DebtCreate(BaseModel):
    type: Literal["owed_to_me", "i_owe"]
    contact: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None


class BudgetUpdate(BaseModel):
    budgets: dict[str, float] = Field(default_factory=dict)

    @field_validator("budgets")
    @classmethod
    def _validate_budgets(cls, v: dict[str, float]) -> dict[str, float]:
        if len(v) > 100:
            raise ValueError("Забагато категорій (макс. 100)")
        out: dict[str, float] = {}
        for key, amount in v.items():
            k = str(key).strip()
            if not k or len(k) > 50:
                raise ValueError("Некоректний ключ категорії")
            if amount is None:
                continue
            a = float(amount)
            if a != a or a < 0:  # NaN or negative
                raise ValueError("Ліміт має бути >= 0")
            if a == 0:
                continue  # 0 == «без ліміту», не зберігаємо
            out[k] = a
        return out
