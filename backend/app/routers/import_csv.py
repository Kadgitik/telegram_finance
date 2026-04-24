"""Import transactions from Monobank CSV export."""

from __future__ import annotations

import csv
import hashlib
import io
import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.requests import Request
from backend.app.limiter import limiter

from backend.app.deps import telegram_user_id
from bot.db.mongo import get_db
from bot.services.mcc import mcc_to_category
from motor.motor_asyncio import AsyncIOMotorDatabase

_LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/import")

# Regex for internal transfers (same as in monobank.py)
_INTERNAL_TRANSFER_RE = re.compile(
    r"^(З|Зі|На)\s+.*(картки|картку|карти|карту|банки|банку|рахунку|рахунок)"
    r"|^Переказ на картку"
    r"|^Переказ на карту"
    r"|^Поповнення картки"
    r"|^Поповнення карти"
    r"|^Між рахунками"
    r"|^Переказ між рахунками"
    r"|^На банку\b"
    r"|^З банки\b"
    r"|^Переказ$"
    r"|^Переказ коштів$",
    re.IGNORECASE,
)

_CREDIT_RE = re.compile(
    r"погашення кредит|кредит до зарплати|відсотки за|погашення заборгованості|кредит до завтра",
    re.IGNORECASE,
)


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

    # Detect internal transfers
    is_internal = bool(_INTERNAL_TRANSFER_RE.search(description))
    if not is_internal and mcc == 4829 and not description:
        is_internal = True

    if _CREDIT_RE.search(description):
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

    for row in rows:
        doc = _parse_mono_csv_row(row, telegram_id)
        if doc is None:
            error_count += 1
            continue

        # Check for duplicate using csv_import_id
        existing = await db["transactions"].find_one({
            "telegram_id": telegram_id,
            "csv_import_id": doc["csv_import_id"],
        })
        if existing:
            skipped_count += 1
            continue

        # Also check if a matching monobank transaction exists
        # (same date ±1 min, same amount, same description)
        date_start = doc["date"].replace(second=0, microsecond=0)
        date_end = date_start.replace(minute=date_start.minute + 1) if date_start.minute < 59 else date_start.replace(hour=date_start.hour + 1, minute=0)
        mono_match = await db["transactions"].find_one({
            "telegram_id": telegram_id,
            "source": "monobank",
            "amount": doc["amount"],
            "type": doc["type"],
            "date": {"$gte": date_start, "$lte": date_end},
        })
        if mono_match:
            skipped_count += 1
            continue

        await db["transactions"].insert_one(doc)
        new_count += 1

    return {
        "ok": True,
        "total": total,
        "new": new_count,
        "skipped": skipped_count,
        "errors": error_count,
    }
