from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException

from backend.app.deps import telegram_user_id
from backend.app.models.schemas import CategoryCreate
from bot.constants import DEFAULT_CATEGORIES, INCOME_CATEGORIES
from bot.db import queries
from bot.db.mongo import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("/categories")
async def list_categories(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    expense = [{"label": k, "kind": "expense"} for k in DEFAULT_CATEGORIES]
    income = [{"label": k, "kind": "income"} for k in INCOME_CATEGORIES]
    custom = (user or {}).get("custom_categories") or []
    custom_out = []
    for c in custom:
        if isinstance(c, str):
            custom_out.append({"label": c, "name": c, "emoji": "🏷", "kind": "expense"})
        elif isinstance(c, dict):
            label = c.get("label") or f'{c.get("emoji", "🏷")} {c.get("name", "")}'.strip()
            custom_out.append(
                {
                    "label": label,
                    "name": c.get("name") or label,
                    "emoji": c.get("emoji") or "🏷",
                    "keywords": c.get("keywords") or [],
                    "kind": "expense",
                }
            )
    return {"expense_defaults": expense, "income": income, "custom": custom_out}


@router.post("/categories", status_code=201)
async def add_category(
    body: CategoryCreate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    emoji = (body.emoji or "🏷").strip() or "🏷"
    name = (body.name or body.label or "").strip()
    if not name:
        raise HTTPException(400, "Порожня назва категорії")
    label = f"{emoji} {name}".strip()
    user = await queries.get_user(db, telegram_id)
    custom = (user or {}).get("custom_categories") or []
    custom_docs = []
    for c in custom:
        if isinstance(c, dict):
            custom_docs.append(c)
        elif isinstance(c, str):
            custom_docs.append(
                {
                    "label": c,
                    "emoji": c.split(" ")[0] if " " in c else "🏷",
                    "name": c.split(" ", 1)[1] if " " in c else c,
                    "keywords": [],
                }
            )
    custom_docs.append(
        {
            "label": label,
            "emoji": emoji,
            "name": name,
            "keywords": [x.strip() for x in body.keywords if x.strip()],
        }
    )
    # Зберігаємо новий формат; старі рядки залишаємо сумісними через list_categories/remove.
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {"custom_categories": custom_docs},
            "$setOnInsert": {"telegram_id": telegram_id},
        },
        upsert=True,
    )
    return {"label": label, "emoji": emoji, "name": name}


@router.delete("/categories/{name}")
async def delete_category(
    name: str,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    label = unquote(name).strip()
    if not label:
        raise HTTPException(400, "Порожня категорія")
    user = await queries.get_user(db, telegram_id)
    custom = (user or {}).get("custom_categories") or []
    if custom and isinstance(custom[0], dict):
        kept = [c for c in custom if (c.get("label") or "").strip() != label]
        await db["users"].update_one(
            {"telegram_id": telegram_id},
            {"$set": {"custom_categories": kept}},
        )
    else:
        await queries.remove_custom_category(db, telegram_id, label)
    return {"ok": True}
