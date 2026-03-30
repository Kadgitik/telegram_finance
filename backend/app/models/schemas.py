from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    type: Literal["expense", "income"]
    amount: float = Field(gt=0)
    category: str | None = None
    comment: str = ""


class TransactionUpdate(BaseModel):
    type: Literal["expense", "income"] | None = None
    amount: float | None = None
    category: str | None = None
    comment: str | None = None


class BudgetCreate(BaseModel):
    category: str
    amount: float = Field(gt=0)


class CategoryCreate(BaseModel):
    label: str = Field(min_length=1)

