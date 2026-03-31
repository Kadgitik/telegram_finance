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
    amount: float | None = Field(default=None, gt=0)
    limit: float | None = Field(default=None, gt=0)


class BudgetPatch(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    limit: float | None = Field(default=None, gt=0)


class CategoryCreate(BaseModel):
    label: str | None = None
    emoji: str | None = None
    name: str | None = None
    keywords: list[str] = Field(default_factory=list)


class UserSettingsPatch(BaseModel):
    pay_day: int | None = Field(default=None, ge=1, le=28)
    currency: str | None = Field(default=None, min_length=3, max_length=8)


class SavingsCreate(BaseModel):
    amount: float = Field(gt=0)
    comment: str = ""


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    emoji: str = Field(default="🎯", min_length=1, max_length=4)
    target_amount: float = Field(gt=0)
    deadline: str | None = None


class GoalPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    emoji: str | None = Field(default=None, min_length=1, max_length=4)
    target_amount: float | None = Field(default=None, gt=0)
    deadline: str | None = None


class GoalContribute(BaseModel):
    amount: float = Field(gt=0)

