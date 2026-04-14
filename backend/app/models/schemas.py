from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float = Field(gt=0)
    category: str
    description: str = ""
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None


class MonoConnectRequest(BaseModel):
    token: str = Field(min_length=10)


class MonoSetDefaultAccount(BaseModel):
    account_id: str


class SavingsCreate(BaseModel):
    amount: float = Field(gt=0)
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)


class GoalDeposit(BaseModel):
    amount: float = Field(gt=0)


class DebtCreate(BaseModel):
    type: Literal["owed_to_me", "i_owe"]
    contact: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    comment: str = ""
    original_amount: float | None = None
    original_currency: str | None = None
