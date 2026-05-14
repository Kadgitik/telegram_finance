"""Import transactions from Monobank CSV export."""

from __future__ import annotations

import csv
import hashlib
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.requests import Request
from backend.app.limiter import limiter

from backend.app.deps import telegram_user_id
from bot.db.mongo import get_db
from bot.services.classifiers import is_credit, is_internal_transfer
from bot.services.mcc import mcc_to_category
from motor.motor_asyncio import AsyncIOMotorDatabase

_LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/import")


def _db() -> AsyncIOMotorDatabase:
    return get_db()


def _parse_mono_csv_row(row: dict[str, str], telegram_id: int) -> dict[str, Any] | None:
    """Parse a single row from Monobank CSV export.

    Monobank CSV columns (Ukrainian):
      "Дата i час операції", "Деталі операції", "MCC", "Сума в валюті картки (UAH)",
      "Сума в валюті операції", "Валюта", "Курс", "Сума комісій (UAH)",
      "Сума кешбеку (UAH)", "Залишок після операції", "Номер картки"

    Monobank CSV columns (English):
      "Date and time", "Description", "MCC", "Card currency amount (UAH)",
      "Operation amount", "Operation currency", "Exchange rate", "Commission (UAH)",
      "Cashback amount (UAH)", "Balance", "Card number"
    """
    # Try to find the right columns by known header names
    date_str = (
        row.get("Дата i час операції")
        or row.get("Дата і час операції")
        or row.get("Date and time")
        or row.get("Дата")
        or ""
    ).strip()

    description = (
        row.get("Деталі операції")
        or row.get("Опис операції")
        or row.get("Description")
        or row.get("Опис")
        or ""
    ).strip()

    mcc_str = (
        row.get("MCC")
        or ""
    ).strip()

    amount_str = (
        row.get("Сума в валюті картки (UAH)")
        or row.get("Сума у валюті картки")
        or row.get("Card currency amount (UAH)")
        or row.get("Сума")
        or ""
    ).strip()

    op_amount_str = (
        row.get("Сума в валюті операції")
        or row.get("Operation amount")
        or ""
    ).strip()

    currency = (
        row.get("Валюта")
        or row.get("Валюта операції")
        or row.get("Operation currency")
        or "UAH"
    ).strip()

    cashback_str = (
        row.get("Сума кешбеку (UAH)")
        or row.get("Cashback amount (UAH)")
        or row.get("Кешбек")
        or "0"
    ).strip()

    balance_str = (
        row.get("Залишок після операції")
        or row.get("Balance")
        or row.get("Залишок")
        or ""
    ).strip()

    if not date_str or not amount_str:
        return None

    # Parse date (formats: "dd.mm.yyyy hh:mm:ss", "yyyy-mm-dd hh:mm:ss", etc.)
    tx_date = None
    for fmt in (
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d.%m.%Y",
        "%Y-%m-%d",
    ):
        try:
            tx_date = datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
            break
        except ValueError:
            continue

    if tx_date is None:
        _LOGGER.warning("Could not parse date: %s", date_str)
        return None

    # Parse amount (may contain spaces, commas as decimal separators)
    try:
        amount_clean = amount_str.replace(" ", "").replace(",", ".").replace("\xa0", "")
        amount = float(amount_clean)
    except ValueError:
        _LOGGER.warning("Could not parse amount: %s", amount_str)
        return None

    # Determine type
    tx_type = "income" if amount > 0 else "expense"
    amount_abs = abs(amount)

    # Parse original amount
    original_amount = amount_abs
    if op_amount_str:
        try:
            original_amount = abs(float(op_amount_str.replace(" ", "").replace(",", ".").replace("\xa0", "")))
        except ValueError:
            pass

    # Parse MCC
    mcc = 0
    if mcc_str:
        try:
            mcc = int(mcc_str)
        except ValueError:
            pass

    category = mcc_to_category(mcc) if mcc else "Інше"

    # Parse cashback
    cashback = 0.0
    if cashback_str:
        try:
            cashback = abs(float(cashback_str.replace(" ", "").replace(",", ".").replace("\xa0", "")))
        except ValueError:
            pass

    # Parse balance
    balance_after = None
    if balance_str:
        try:
            balance_after = float(balance_str.replace(" ", "").replace(",", ".").replace("\xa0", ""))
        except ValueError:
            pass

    # Map currency string to code
    currency_map = {"UAH": 980, "USD": 840, "EUR": 978, "₴": 980, "$": 840, "€": 978}
    currency_code = currency_map.get(currency.upper(), 980)

    is_internal = is_internal_transfer(description, mcc)
    if is_credit(description):
        category = "Кредит"
        is_internal = False

    # Generate a stable ID for deduplication (based on date + amount + description)
    dedup_str = f"{tx_date.isoformat()}|{amount}|{description}"
    csv_id = hashlib.md5(dedup_str.encode("utf-8")).hexdigest()[:16]

    return {
        "telegram_id": telegram_id,
        "source": "csv_import",
        "csv_import_id": csv_id,
        "type": tx_type,
        "amount": amount_abs,
        "original_amount": original_amount,
        "currency_code": currency_code,
        "category": category,
        "mcc": mcc,
        "description": description,
        "comment": None,
        "cashback": cashback,
        "balance_after": balance_after,
        "hold": False,
        "internal_transfer": is_internal,
        "deleted": False,
        "date": tx_date,
        "created_at": datetime.now(timezone.utc),
    }


def _detect_delimiter(first_line: str) -> str:
    """Detect CSV delimiter: semicolon or comma."""
    if ";" in first_line and first_line.count(";") > first_line.count(","):
        return ";"
    return ","


@router.post("/csv")
@limiter.limit("5/minute")
async def import_csv(
    request: Request, file: UploadFile = File(...),
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    """Import transactions from a Monobank CSV export file."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Файл має бути у форматі CSV")

    # Read file content
    try:
        content_bytes = await file.read()
        # Try different encodings
        for encoding in ("utf-8-sig", "utf-8", "cp1251", "windows-1251"):
            try:
                content = content_bytes.decode(encoding)
                break
            except (UnicodeDecodeError, ValueError):
                continue
        else:
            raise HTTPException(400, "Не вдалося прочитати файл. Перевірте кодування.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Помилка читання файлу: {e}")

    # Detect delimiter and parse CSV
    lines = content.strip().split("\n")
    if len(lines) < 2:
        raise HTTPException(400, "Файл порожній або містить тільки заголовок")

    delimiter = _detect_delimiter(lines[0])

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    rows = list(reader)

    if not rows:
        raise HTTPException(400, "Не знайдено жодного рядка з даними")

    new_count = 0
    skipped_count = 0
    error_count = 0
    total = len(rows)

    parsed: list[dict[str, Any]] = []
    for row in rows:
        doc = _parse_mono_csv_row(row, telegram_id)
        if doc is None:
            error_count += 1
            continue
        parsed.append(doc)

    if not parsed:
        return {"ok": True, "total": total, "new": 0, "skipped": 0, "errors": error_count}

    # Bulk-prefetch duplicates to avoid N+1 round-trips.
    csv_ids = [d["csv_import_id"] for d in parsed]
    dates = [d["date"] for d in parsed]
    min_d = min(dates).replace(second=0, microsecond=0)
    max_d = max(dates).replace(second=0, microsecond=0) + timedelta(minutes=1)

    existing_csv_ids: set[str] = set()
    async for tx in db["transactions"].find(
        {"telegram_id": telegram_id, "csv_import_id": {"$in": csv_ids}},
        {"csv_import_id": 1},
    ):
        existing_csv_ids.add(tx["csv_import_id"])

    mono_in_window: list[dict[str, Any]] = []
    async for tx in db["transactions"].find(
        {
            "telegram_id": telegram_id,
            "source": "monobank",
            "date": {"$gte": min_d, "$lt": max_d},
        },
        {"amount": 1, "type": 1, "date": 1},
    ):
        mono_in_window.append(tx)

    def _mono_dup(doc: dict[str, Any]) -> bool:
        d0 = doc["date"].replace(second=0, microsecond=0)
        d1 = d0 + timedelta(minutes=1)
        for tx in mono_in_window:
            if (
                tx["amount"] == doc["amount"]
                and tx["type"] == doc["type"]
                and d0 <= tx["date"] < d1
            ):
                return True
        return False

    to_insert: list[dict[str, Any]] = []
    for doc in parsed:
        if doc["csv_import_id"] in existing_csv_ids:
            skipped_count += 1
            continue
        if _mono_dup(doc):
            skipped_count += 1
            continue
        to_insert.append(doc)

    if to_insert:
        await db["transactions"].insert_many(to_insert, ordered=False)
        new_count = len(to_insert)

    return {
        "ok": True,
        "total": total,
        "new": new_count,
        "skipped": skipped_count,
        "errors": error_count,
    }
