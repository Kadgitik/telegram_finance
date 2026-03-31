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


def _parse_legacy_label(label: str) -> tuple[str, str]:
    raw = (label or "").strip()
    if " " in raw:
        maybe_emoji, rest = raw.split(" ", 1)
        if rest.strip():
            return maybe_emoji.strip() or "🏷", rest.strip()
    return "🏷", raw


def _normalize_custom_categories(custom: list) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for c in custom or []:
        if isinstance(c, dict):
            label = (c.get("label") or "").strip()
            emoji = (c.get("emoji") or "").strip() or "🏷"
            name = (c.get("name") or "").strip()
            if not label:
                if name:
                    label = f"{emoji} {name}".strip()
                else:
                    continue
            if not name:
                _, name = _parse_legacy_label(label)
            norm = {
                "label": label,
                "emoji": emoji,
                "name": name or label,
                "keywords": [x.strip() for x in (c.get("keywords") or []) if str(x).strip()],
            }
        elif isinstance(c, str):
            emoji, name = _parse_legacy_label(c)
            norm = {"label": c.strip(), "emoji": emoji, "name": name, "keywords": []}
        else:
            continue
        key = norm["label"].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(norm)
    return out


def _upsert_custom_category(custom: list, emoji: str, name: str, keywords: list[str]) -> list[dict]:
    normalized = _normalize_custom_categories(custom)
    label = f"{emoji} {name}".strip()
    keywords_norm = [x.strip() for x in keywords if str(x).strip()]
    replaced = False
    for item in normalized:
        if item["label"].lower() == label.lower():
            item["emoji"] = emoji
            item["name"] = name
            item["keywords"] = keywords_norm
            replaced = True
            break
    if not replaced:
        normalized.append(
            {
                "label": label,
                "emoji": emoji,
                "name": name,
                "keywords": keywords_norm,
            }
        )
    return normalized


@router.get("/categories")
async def list_categories(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict:
    user = await queries.get_user(db, telegram_id)
    expense = [{"label": k, "kind": "expense"} for k in DEFAULT_CATEGORIES]
    income = [{"label": k, "kind": "income"} for k in INCOME_CATEGORIES]
    custom = _normalize_custom_categories((user or {}).get("custom_categories") or [])
    custom_out = []
    for c in custom:
        custom_out.append(
            {
                "label": c["label"],
                "name": c["name"],
                "emoji": c["emoji"],
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
    custom_docs = _upsert_custom_category(
        (user or {}).get("custom_categories") or [],
        emoji,
        name,
        body.keywords or [],
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
    custom = _normalize_custom_categories((user or {}).get("custom_categories") or [])
    kept = [c for c in custom if c["label"].strip().lower() != label.lower()]
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": {"custom_categories": kept}},
    )
    return {"ok": True}
