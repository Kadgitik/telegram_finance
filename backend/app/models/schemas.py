from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float = Field(gt=0)
    category: str
    description: str = ""
    comment: str = ""


class MonoConnectRequest(BaseModel):
    token: str = Field(min_length=10)


class MonoSetDefaultAccount(BaseModel):
    account_id: str


class SavingsCreate(BaseModel):
    amount: float = Field(gt=0)
    comment: str = ""
