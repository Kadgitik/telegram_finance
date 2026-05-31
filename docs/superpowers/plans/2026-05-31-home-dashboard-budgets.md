# Home Dashboard + Category Budgets (A+B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Telegram Mini App home screen (hero balance, «Темп витрат» / «Можна витрати» cards, scrollable «ТОП КАТЕГОРІЙ») in the existing dark theme, backed by a new per-category budgets feature.

**Architecture:** Budgets are a `{category_key: amount}` map stored on the `users` document (limits are permanent). Pure helper functions compute the dashboard metrics (`can_spend`, `daily_pace`, `pace_vs_budget_pct`) — unit-tested without a DB — and the existing `GET /api/bootstrap` endpoint returns them alongside the budgets map. The frontend joins `stats.categories` with `budgets` to render per-category progress. A new `BudgetsPage` is the editor; the home screen displays results.

**Tech Stack:** FastAPI + Pydantic v2 + Motor (MongoDB), pytest. React 18 + Vite + Tailwind + framer-motion + lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-home-dashboard-budgets-design.md`

**Branch:** `feature/home-dashboard-budgets` (already created & checked out).

**Test commands:**
- Backend (from repo root): `python -m pytest backend/tests/<file> -v`
- Frontend (from `frontend/`): `npm test` or `npx vitest run src/utils/<file>.test.js`

**Commit trailer:** every commit message ends with
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

**Backend (create):**
- `backend/app/services/budgets.py` — pure `compute_budget_metrics()` (no DB).
- `backend/tests/test_budget_metrics.py` — metric formula tests.
- `backend/tests/test_budgets_schema.py` — `BudgetUpdate` validation tests.
- `backend/app/routers/budgets.py` — `GET`/`PUT /api/budgets`.

**Backend (modify):**
- `backend/app/models/schemas.py` — add `BudgetUpdate`.
- `bot/db/queries.py` — `set_budgets()`, `budgets: {}` default in `upsert_user`, budget cleanup in `delete_custom_category`.
- `backend/app/routers/stats.py` — extend `bootstrap` with budget metrics.
- `backend/app/main.py` — register `budgets` router.

**Frontend (create):**
- `frontend/src/utils/sparkline.js` + `frontend/src/utils/sparkline.test.js`
- `frontend/src/utils/budget.js` + `frontend/src/utils/budget.test.js`
- `frontend/src/components/Sparkline.jsx`
- `frontend/src/pages/BudgetsPage.jsx`

**Frontend (modify):**
- `frontend/src/api/client.js` — cache-invalidation rule for `/budgets`.
- `frontend/src/App.jsx` — `/budgets` route.
- `frontend/src/pages/SettingsPage.jsx` — entry link to Budgets.
- `frontend/src/pages/HomePage.jsx` — full redesign.

---

## Task 1: `BudgetUpdate` schema + validation

**Files:**
- Modify: `backend/app/models/schemas.py`
- Test: `backend/tests/test_budgets_schema.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_budgets_schema.py`:
```python
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


def test_too_many_categories_rejected():
    big = {f"cat{i}": 1 for i in range(101)}
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets=big)


def test_empty_key_rejected():
    with pytest.raises(ValidationError):
        BudgetUpdate(budgets={"   ": 100})


def test_default_is_empty_dict():
    assert BudgetUpdate().budgets == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_budgets_schema.py -v`
Expected: FAIL — `ImportError: cannot import name 'BudgetUpdate'`.

- [ ] **Step 3: Implement the schema**

In `backend/app/models/schemas.py`, change the import line at the top:
```python
from pydantic import BaseModel, Field, field_validator
```
and append at the end of the file:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_budgets_schema.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/schemas.py backend/tests/test_budgets_schema.py
git commit -m "feat: add BudgetUpdate schema with validation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `compute_budget_metrics()` pure function

**Files:**
- Create: `backend/app/services/budgets.py`
- Test: `backend/tests/test_budget_metrics.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_budget_metrics.py`:
```python
"""Тести формул бюджетних метрик (без БД)."""
from __future__ import annotations

from datetime import datetime, timezone

from backend.app.services.budgets import compute_budget_metrics

# Травень 2026: рівно 31 день у вікні [1 May, 1 Jun).
START = datetime(2026, 5, 1, tzinfo=timezone.utc)
END = datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_normal_mid_month():
    # День 10 (включно з сьогодні): days_elapsed = 10.
    now = datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=10000, budgets={"Їжа": 20000, "Транспорт": 10000},
        start=START, end_excl=END, now=now,
    )
    assert m["total_budget"] == 30000
    assert m["days_in_period"] == 31
    assert m["days_elapsed"] == 10
    assert m["days_left"] == 21
    assert m["can_spend"] == 20000
    assert round(m["daily_pace"], 2) == 1000.0
    # safe_pace = 30000/31 ≈ 967.74; pace_vs = round((1000/967.74 - 1)*100) = 3
    assert m["pace_vs_budget_pct"] == 3


def test_no_budget():
    now = datetime(2026, 5, 10, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=5000, budgets={}, start=START, end_excl=END, now=now,
    )
    assert m["total_budget"] == 0
    assert m["safe_pace"] is None
    assert m["pace_vs_budget_pct"] is None
    assert m["can_spend"] == -5000  # тратив без бюджету


def test_past_month_elapsed_is_full_period():
    now = datetime(2026, 7, 1, tzinfo=timezone.utc)  # після END
    m = compute_budget_metrics(
        spent=31000, budgets={"Їжа": 31000},
        start=START, end_excl=END, now=now,
    )
    assert m["days_elapsed"] == 31
    assert m["days_left"] == 0
    assert round(m["daily_pace"], 2) == 1000.0


def test_over_budget_gives_negative_can_spend():
    now = datetime(2026, 5, 20, tzinfo=timezone.utc)
    m = compute_budget_metrics(
        spent=12000, budgets={"Їжа": 10000},
        start=START, end_excl=END, now=now,
    )
    assert m["can_spend"] == -2000


def test_future_month_elapsed_clamped_to_one():
    now = datetime(2026, 4, 1, tzinfo=timezone.utc)  # до START
    m = compute_budget_metrics(
        spent=0, budgets={"Їжа": 31000},
        start=START, end_excl=END, now=now,
    )
    assert m["days_elapsed"] == 1
    assert m["daily_pace"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_budget_metrics.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.budgets'`.

- [ ] **Step 3: Implement the function**

Create `backend/app/services/budgets.py`:
```python
"""Чисті обчислення бюджетних метрик для головного екрана (без БД)."""
from __future__ import annotations

from datetime import datetime
from typing import Any


def compute_budget_metrics(
    *,
    spent: float,
    budgets: dict[str, float] | None,
    start: datetime,
    end_excl: datetime,
    now: datetime,
) -> dict[str, Any]:
    """Повертає метрики для карток «Темп витрат» та «Можна витрати».

    spent       — сума витрат за період (з bootstrap).
    budgets     — map {категорія: ліміт}.
    start/end   — межі фінансового місяця [start, end_excl).
    now         — поточний момент (UTC).
    """
    budgets = budgets or {}
    total_budget = float(
        sum(v for v in budgets.values() if isinstance(v, (int, float)))
    )
    days_in_period = max(1, (end_excl - start).days)
    # Сьогодні рахуємо «прожитим» (+1). Клампимо в [1, days_in_period]:
    # для минулих місяців → days_in_period, для майбутніх → 1.
    days_elapsed = max(1, min(days_in_period, (now - start).days + 1))
    days_left = days_in_period - days_elapsed

    can_spend = total_budget - spent
    daily_pace = spent / days_elapsed
    safe_pace = (total_budget / days_in_period) if total_budget > 0 else None
    if safe_pace and safe_pace > 0:
        pace_vs_budget_pct = round((daily_pace / safe_pace - 1) * 100)
    else:
        pace_vs_budget_pct = None

    return {
        "total_budget": total_budget,
        "days_in_period": days_in_period,
        "days_elapsed": days_elapsed,
        "days_left": days_left,
        "can_spend": can_spend,
        "daily_pace": daily_pace,
        "safe_pace": safe_pace,
        "pace_vs_budget_pct": pace_vs_budget_pct,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_budget_metrics.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/budgets.py backend/tests/test_budget_metrics.py
git commit -m "feat: add compute_budget_metrics pure function

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Budget queries (set, default, cleanup)

**Files:**
- Modify: `bot/db/queries.py`

No DB unit test (repo has no async-Mongo harness; `queries.py` is untested by precedent). Verify by import smoke + the endpoint in Task 4.

- [ ] **Step 1: Add `budgets: {}` default to `upsert_user`**

In `bot/db/queries.py`, inside `upsert_user`'s `"$setOnInsert"` block, add the `budgets` key alongside the existing defaults:
```python
            "$setOnInsert": {
                "telegram_id": telegram_id,
                "mono_token": None,
                "mono_client_id": None,
                "mono_accounts": [],
                "mono_webhook_set": False,
                "default_account": None,
                "custom_categories": [],
                "budgets": {},
                "created_at": now,
            },
```

- [ ] **Step 2: Add `set_budgets()`**

In `bot/db/queries.py`, add after `delete_custom_category` (in the Users section):
```python
async def set_budgets(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    budgets: dict[str, float],
) -> None:
    await db["users"].update_one(
        {"telegram_id": telegram_id},
        {"$set": {"budgets": budgets, "updated_at": datetime.now(timezone.utc)}},
    )
```

- [ ] **Step 3: Clean up budget key on category delete**

In `bot/db/queries.py`, replace the body of `delete_custom_category` so it also removes any budget for that key:
```python
async def delete_custom_category(
    db: AsyncIOMotorDatabase,
    telegram_id: int,
    key: str,
) -> bool:
    r = await db["users"].update_one(
        {"telegram_id": telegram_id},
        {
            "$pull": {"custom_categories": {"key": key}},
            "$unset": {f"budgets.{key}": ""},
        },
    )
    return r.modified_count > 0
```

- [ ] **Step 4: Verify import smoke**

Run: `python -c "from bot.db import queries; print(hasattr(queries, 'set_budgets'))"`
Expected: prints `True` and no import error.

- [ ] **Step 5: Commit**

```bash
git add bot/db/queries.py
git commit -m "feat: budget queries (set_budgets, default, delete cleanup)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `/api/budgets` router + registration

**Files:**
- Create: `backend/app/routers/budgets.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the router**

Create `backend/app/routers/budgets.py`:
```python
"""Per-category budgets (GET/PUT)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from starlette.requests import Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.app.deps import telegram_user_id
from backend.app.limiter import limiter
from backend.app.models.schemas import BudgetUpdate
from bot.db import queries
from bot.db.mongo import get_db

router = APIRouter(prefix="/budgets")


def _db() -> AsyncIOMotorDatabase:
    return get_db()


@router.get("")
async def get_budgets(
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    user = await queries.get_user(db, telegram_id, decrypt_token=False) or {}
    budgets = user.get("budgets") or {}
    return {"budgets": budgets, "total": float(sum(budgets.values()))}


@router.put("")
@limiter.limit("15/minute")
async def put_budgets(
    request: Request, body: BudgetUpdate,
    telegram_id: int = Depends(telegram_user_id),
    db: AsyncIOMotorDatabase = Depends(_db),
) -> dict[str, Any]:
    await queries.set_budgets(db, telegram_id, body.budgets)
    return {
        "ok": True,
        "budgets": body.budgets,
        "total": float(sum(body.budgets.values())),
    }
```

- [ ] **Step 2: Register the router in `main.py`**

In `backend/app/main.py`, update the routers import line:
```python
from backend.app.routers import mono, savings, stats, transactions, debts, categories, import_csv, budgets
```
and add after the other `include_router` calls:
```python
app.include_router(budgets.router, prefix="/api")
```

- [ ] **Step 3: Verify the routes are wired**

Run:
```bash
python -c "from backend.app.main import app; print(sorted(r.path for r in app.routes if 'budget' in r.path))"
```
Expected: `['/api/budgets']`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/budgets.py backend/app/main.py
git commit -m "feat: add /api/budgets GET/PUT router

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Extend `/api/bootstrap` with budget metrics

**Files:**
- Modify: `backend/app/routers/stats.py`

- [ ] **Step 1: Import the helper**

In `backend/app/routers/stats.py`, add to the imports near the top (after the existing `from backend.app.services...` imports):
```python
from backend.app.services.budgets import compute_budget_metrics
```

- [ ] **Step 2: Compute metrics and add to the bootstrap response**

In `backend/app/routers/stats.py`, in the `bootstrap` function, replace the final `return {...}` block with the version below (adds `budgets` + spread metrics; everything else unchanged):
```python
    budgets = user.get("budgets") or {}
    metrics = compute_budget_metrics(
        spent=expense,
        budgets=budgets,
        start=start,
        end_excl=end_excl,
        now=datetime.now(timezone.utc),
    )

    return {
        "month": month_key,
        "balance": balance_data,
        "transactions": transactions,
        "stats": stats_data,
        "trend": trend_data,
        "savings_total": sav_total,
        "mono_connected": mono_connected,
        "custom_categories": user.get("custom_categories", []),
        "budgets": budgets,
        **metrics,
    }
```

- [ ] **Step 3: Verify import + signature**

Run:
```bash
python -c "from backend.app.routers import stats; print('ok')"
```
Expected: prints `ok` (no ImportError).

- [ ] **Step 4: Run the full backend test suite (nothing regressed)**

Run: `python -m pytest backend/tests -v`
Expected: PASS (all tests, including Task 1 & 2).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/stats.py
git commit -m "feat: return budget metrics from /api/bootstrap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `sparkline.js` utility

**Files:**
- Create: `frontend/src/utils/sparkline.js`
- Test: `frontend/src/utils/sparkline.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/sparkline.test.js`:
```javascript
import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("returns empty string for no data", () => {
    expect(sparklinePath([])).toBe("");
    expect(sparklinePath(undefined)).toBe("");
  });

  it("draws a flat line for a single point", () => {
    const d = sparklinePath([5], 100, 28);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("L");
  });

  it("builds a path with M then L commands for multiple points", () => {
    const d = sparklinePath([1, 5, 2, 8], 100, 28);
    expect(d.startsWith("M")).toBe(true);
    expect((d.match(/L/g) || []).length).toBe(3);
    expect(d).not.toMatch(/NaN/);
  });

  it("handles all-equal values without NaN (flat span)", () => {
    const d = sparklinePath([4, 4, 4], 100, 28);
    expect(d).not.toMatch(/NaN/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/utils/sparkline.test.js`
Expected: FAIL — cannot resolve `./sparkline`.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/sparkline.js`:
```javascript
// Build an SVG path string for a tiny sparkline from a list of numbers.
export function sparklinePath(values, width = 100, height = 28, pad = 2) {
  const nums = (values || []).map((v) => Number(v) || 0);
  if (nums.length === 0) return "";
  const y0 = height / 2;
  if (nums.length === 1) return `M ${pad} ${y0} L ${width - pad} ${y0}`;

  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (nums.length - 1);

  return nums
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/sparkline.test.js`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/sparkline.js frontend/src/utils/sparkline.test.js
git commit -m "feat: add sparklinePath utility

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `budget.js` UI helpers

**Files:**
- Create: `frontend/src/utils/budget.js`
- Test: `frontend/src/utils/budget.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/budget.test.js`:
```javascript
import { describe, expect, it } from "vitest";
import { categoryProgress, paceBadge, canSpendState } from "./budget";

describe("categoryProgress", () => {
  it("no limit → hasLimit false", () => {
    const p = categoryProgress(500, 0);
    expect(p.hasLimit).toBe(false);
    expect(p.pct).toBe(null);
  });
  it("under limit", () => {
    const p = categoryProgress(2500, 5000);
    expect(p.hasLimit).toBe(true);
    expect(p.pct).toBe(50);
    expect(p.fill).toBe(50);
    expect(p.over).toBe(false);
  });
  it("over limit caps fill at 100 and flags over", () => {
    const p = categoryProgress(6000, 5000);
    expect(p.pct).toBe(120);
    expect(p.fill).toBe(100);
    expect(p.over).toBe(true);
  });
});

describe("paceBadge", () => {
  it("hidden when null", () => {
    expect(paceBadge(null).show).toBe(false);
  });
  it("positive → red, up, +N%", () => {
    const b = paceBadge(28);
    expect(b.show).toBe(true);
    expect(b.up).toBe(true);
    expect(b.text).toBe("+28%");
  });
  it("negative → green, down", () => {
    const b = paceBadge(-12);
    expect(b.up).toBe(false);
    expect(b.text).toBe("-12%");
  });
});

describe("canSpendState", () => {
  it("positive", () => {
    expect(canSpendState(9310)).toEqual({ over: false, value: 9310 });
  });
  it("negative → over with abs value", () => {
    expect(canSpendState(-2000)).toEqual({ over: true, value: 2000 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/budget.test.js`
Expected: FAIL — cannot resolve `./budget`.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/budget.js`:
```javascript
// Spending progress of a category against its limit.
export function categoryProgress(spent, limit) {
  const s = Number(spent) || 0;
  const l = Number(limit) || 0;
  if (l <= 0) return { hasLimit: false, pct: null, fill: 0, over: false };
  const pct = Math.round((s / l) * 100);
  return { hasLimit: true, pct, fill: Math.min(100, pct), over: pct > 100 };
}

// Badge for «Темп витрат». pct === null hides it.
export function paceBadge(pct) {
  if (pct == null) return { show: false, up: false, color: "", text: "" };
  const up = pct > 0;
  return {
    show: true,
    up,
    color: up ? "#FF453A" : "#34C759",
    text: `${up ? "+" : ""}${pct}%`,
  };
}

// State for «Можна витрати».
export function canSpendState(canSpend) {
  const v = Number(canSpend) || 0;
  return { over: v < 0, value: Math.abs(v) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/budget.test.js`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/budget.js frontend/src/utils/budget.test.js
git commit -m "feat: add budget UI helpers (progress, pace badge, can-spend)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: `Sparkline` component

**Files:**
- Create: `frontend/src/components/Sparkline.jsx`

No dedicated test (thin presentational wrapper around the tested `sparklinePath`). Verified by the production build in Task 12.

- [ ] **Step 1: Implement**

Create `frontend/src/components/Sparkline.jsx`:
```jsx
import { sparklinePath } from "../utils/sparkline";

export default function Sparkline({
  values,
  width = 100,
  height = 28,
  color = "#FF6B6B",
  className = "",
}) {
  const d = sparklinePath(values, width, height);
  if (!d) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sparkline.jsx
git commit -m "feat: add Sparkline component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Budgets page + route + cache invalidation + settings entry

**Files:**
- Modify: `frontend/src/api/client.js`
- Create: `frontend/src/pages/BudgetsPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/SettingsPage.jsx`

- [ ] **Step 1: Add cache-invalidation rule for `/budgets`**

In `frontend/src/api/client.js`, add an entry to the `INVALIDATIONS` array (so saving budgets refreshes the home bootstrap):
```javascript
  { match: /^\/budgets/,     prefixes: ["/budgets", "/bootstrap"] },
```
Place it right after the `/categories` line.

- [ ] **Step 2: Create `BudgetsPage.jsx`**

Create `frontend/src/pages/BudgetsPage.jsx`:
```jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";
import { useHaptic } from "../hooks/useHaptic";
import { useCustomCategories } from "../context/CustomCategoriesContext";
import { EXPENSE_CATEGORIES, getCategoryConfig } from "../utils/constants";
import { formatMoney } from "../utils/formatters";
import { invalidateHomeCache } from "../utils/cache";
import AddCategoryModal from "../components/AddCategoryModal";

export default function BudgetsPage() {
  const nav = useNavigate();
  const { initData } = useTelegram();
  const h = useHaptic();
  const [customCategories] = useCustomCategories();
  const [amounts, setAmounts] = useState({}); // { key: "5000" }
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const expenseKeys = useMemo(() => {
    const custom = customCategories.filter((c) => c.type === "expense").map((c) => c.key);
    const defaults = EXPENSE_CATEGORIES.map((c) => c.key);
    return [...new Set([...custom, ...defaults])];
  }, [customCategories]);

  useEffect(() => {
    if (!initData) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get("/budgets", initData);
        if (cancelled) return;
        const next = {};
        for (const [k, v] of Object.entries(r.budgets || {})) next[k] = String(v);
        setAmounts(next);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [initData]);

  const total = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [amounts]
  );

  const setAmount = (key, val) =>
    setAmounts((prev) => ({ ...prev, [key]: val.replace(/[^\d.]/g, "") }));

  const handleSave = async () => {
    if (!initData || saving) return;
    setSaving(true);
    h.light();
    const budgets = {};
    for (const [k, v] of Object.entries(amounts)) {
      const n = parseFloat(v);
      if (n > 0) budgets[k] = n;
    }
    try {
      await api.put("/budgets", initData, { budgets });
      invalidateHomeCache();
      h.success();
      nav(-1);
    } catch (e) {
      h.error();
      if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(`Помилка: ${e.message}`);
      else alert(`Помилка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-36">
      <div className="px-5 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold">Бюджети</h1>
        </div>

        <p className="text-sm text-white/40 mb-5">
          Задай ліміт на категорію. Сума всіх лімітів — твій загальний бюджет на місяць.
        </p>

        <div className="space-y-2.5">
          {expenseKeys.map((key) => {
            const cat = getCategoryConfig(key, customCategories);
            const Icon = cat.icon;
            return (
              <div key={key} className="flex items-center gap-3 bg-[#1C1C1E] p-3 rounded-2xl">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}18` }}
                >
                  <Icon size={18} color={cat.color} />
                </div>
                <span className="flex-1 text-[15px] font-medium text-white/90 truncate">{key}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-24 text-right rounded-xl px-3 py-2 bg-black/40 border border-white/10 text-[15px] focus:border-[#10b981]/60 outline-none"
                  placeholder="0"
                  value={amounts[key] ?? ""}
                  onChange={(e) => setAmount(key, e.target.value)}
                />
                <span className="text-white/30 text-sm">₴</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { h.light(); setShowAdd(true); }}
          className="mt-4 w-full py-3 rounded-2xl bg-white/5 text-white/60 font-medium flex items-center justify-center gap-2 active:bg-white/10"
        >
          <Plus size={18} /> Додати категорію
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#121214]/90 backdrop-blur-xl border-t border-white/10 px-5 py-4 safe-pb">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white/50">Загальний бюджет</span>
          <span className="text-lg font-bold">{formatMoney(total)}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-[#10b981] text-white font-bold disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <Check size={18} /> {saving ? "Збереження..." : "Зберегти"}
        </button>
      </div>

      <AddCategoryModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        type="expense"
        onCreated={() => setShowAdd(false)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add the `/budgets` route**

In `frontend/src/App.jsx`, add the import alongside the other page imports:
```javascript
import BudgetsPage from "./pages/BudgetsPage";
```
and add the route inside `<Routes>` (next to `/settings`):
```javascript
        <Route path="/budgets" element={<BudgetsPage />} />
```

- [ ] **Step 4: Add a Settings entry link**

In `frontend/src/pages/SettingsPage.jsx`:

(a) Add `Wallet` to the existing lucide import line:
```javascript
import { CheckCircle, ChevronDown, ChevronUp, Download, ExternalLink, FileUp, Link2Off, RefreshCw, Upload, Wallet, XCircle } from "lucide-react";
```
(b) Add a router import below the lucide import:
```javascript
import { Link } from "react-router-dom";
```
(c) Insert this card as the **first child** inside the page's outermost returned container (before the Monobank section):
```jsx
      <Link
        to="/budgets"
        onClick={() => h.light()}
        className="flex items-center gap-3 bg-[#1C1C1E] p-4 rounded-2xl mb-4 active:bg-[#2a2a30] transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-[#10b981]/15 flex items-center justify-center">
          <Wallet size={18} className="text-[#34d399]" />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-white/90">Бюджети</p>
          <p className="text-[12px] text-white/40">Ліміти на категорії</p>
        </div>
      </Link>
```

- [ ] **Step 5: Build to verify everything compiles**

Run (from `frontend/`): `npm run build`
Expected: build succeeds, no unresolved-import errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.js frontend/src/pages/BudgetsPage.jsx frontend/src/App.jsx frontend/src/pages/SettingsPage.jsx
git commit -m "feat: budgets page, route, cache invalidation, settings entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Home page redesign

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx` (full replace)

- [ ] **Step 1: Replace `HomePage.jsx`**

Replace the entire contents of `frontend/src/pages/HomePage.jsx` with:
```jsx
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Settings, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { useCustomCategories } from "../context/CustomCategoriesContext";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { getCategoryConfig } from "../utils/constants";
import { categoryProgress, paceBadge, canSpendState } from "../utils/budget";
import MonthSwitcher from "../components/MonthSwitcher";
import Sparkline from "../components/Sparkline";

export default function HomePage() {
  const nav = useNavigate();
  const { initData, ready } = useTelegram();
  const h = useHaptic();
  const [boot, setBoot] = useState(null);
  const [err, setErr] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [customCategories] = useCustomCategories();
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    setErr("");
    const cacheKey = `homeCache_${month}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setBoot(JSON.parse(cached)); } catch { /* ignore */ }
    }
    try {
      const data = await api.get(`/bootstrap?month=${month}`, initData);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setBoot(data);
    } catch (e) {
      setErr(String(e.message));
    }
  };

  useEffect(() => {
    if (ready && initData) {
      load();
      const interval = setInterval(() => load(), 12000);
      const onFocus = () => load();
      window.addEventListener("focus", onFocus);
      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", onFocus);
      };
    }
  }, [ready, initData, month]);

  const balance = boot?.balance || {};
  const budgets = boot?.budgets || {};
  const totalBudget = boot?.total_budget || 0;
  const spent = balance.expense || 0;
  const cats = [...(boot?.stats?.categories || [])].sort((a, b) => b.amount - a.amount);
  const trendValues = (boot?.trend?.points || []).map((p) => p.amount);

  const balanceValue = formatMoney(balance.balance || 0).replace(" ₴", "");
  const badge = paceBadge(boot?.pace_vs_budget_pct ?? null);
  const cs = canSpendState(boot?.can_spend ?? 0);
  const spentPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;

  const QUICK = [
    { to: "/add?type=income", label: "Дохід", icon: ArrowUpRight, color: "#34C759" },
    { to: "/add?type=expense", label: "Витрата", icon: ArrowDownLeft, color: "#FF453A" },
    { to: "/savings", label: "Накопич.", icon: ArrowLeftRight, color: "#A78BFA" },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden pb-28">
      <div className="px-5 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h1 className="text-lg font-bold text-white/90">Finance</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/budgets")}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
            >
              <Wallet size={18} className="text-white/80" />
            </button>
            <button
              onClick={() => nav("/settings")}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
            >
              <Settings size={18} className="text-white/80" />
            </button>
          </div>
        </div>

        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

        <div className="mb-4">
          <MonthSwitcher month={month} onChange={setStoredMonth} periodLabel="" compact />
        </div>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="rounded-[28px] p-6 mb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #1f3a30 0%, #14241e 60%, #0d1714 100%)" }}
        >
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Залишок · {balance.period_label || ""}
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[44px] font-extrabold tracking-tighter leading-none">{balanceValue}</h2>
            <span className="text-xl font-medium text-white/35">₴</span>
          </div>
          {usdRate ? (
            <p className="text-[#34d399] text-sm font-medium mt-1">
              {formatUsdApprox(balance.balance || 0, usdRate)}
            </p>
          ) : null}

          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-[11px] text-white/40">Витрачено</p>
              <p className="text-[15px] font-bold text-white/90">{formatMoney(spent)}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/40">Дохід</p>
              <p className="text-[15px] font-bold text-white/90">{formatMoney(balance.income || 0)}</p>
            </div>
          </div>

          {totalBudget > 0 && (
            <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${spentPct}%`, background: spent > totalBudget ? "#FF453A" : "#34d399" }}
              />
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-4">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                onClick={() => h.light()}
                className="flex-1 rounded-2xl bg-[#1C1C1E] py-3 flex flex-col items-center gap-1.5 active:bg-[#2a2a30] transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${q.color}1f` }}
                >
                  <Icon size={18} color={q.color} />
                </div>
                <span className="text-[12px] font-medium text-white/70">{q.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 mb-6">
          {/* Темп витрат */}
          <div className="flex-1 rounded-2xl bg-[#1C1C1E] p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Темп витрат</p>
              {badge.show && (
                <span className="text-[11px] font-bold" style={{ color: badge.color }}>
                  {badge.up ? "↗" : "↘"} {badge.text}
                </span>
              )}
            </div>
            <p className="text-[22px] font-extrabold tracking-tight">
              {formatMoney(boot?.daily_pace || 0).replace(" ₴", "")}
              <span className="text-sm font-normal text-white/40"> ₴/д</span>
            </p>
            <div className="mt-2">
              <Sparkline values={trendValues} width={120} height={26} color={badge.up ? "#FF6B6B" : "#34d399"} className="w-full" />
            </div>
          </div>

          {/* Можна витрати */}
          <div className="flex-1 rounded-2xl bg-[#1C1C1E] p-4">
            <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Можна витрати</p>
            {totalBudget > 0 ? (
              <>
                <p
                  className="text-[22px] font-extrabold tracking-tight"
                  style={{ color: cs.over ? "#FF453A" : "#34d399" }}
                >
                  {cs.over ? "-" : ""}{formatMoney(cs.value).replace(" ₴", "")}
                  <span className="text-sm font-normal text-white/40"> ₴</span>
                </p>
                <p className="text-[12px] text-white/40 mt-1">
                  {cs.over ? "перевищено" : `залишилось ${boot?.days_left ?? 0} дн.`}
                </p>
              </>
            ) : (
              <Link to="/budgets" onClick={() => h.light()} className="block">
                <p className="text-[15px] font-semibold text-[#34d399] mt-2">Встанови бюджети →</p>
              </Link>
            )}
          </div>
        </div>

        {/* ТОП КАТЕГОРІЙ */}
        <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/40 mb-3">Топ категорій</h3>
        <div className="space-y-2.5">
          {cats.map((c) => {
            const cfg = getCategoryConfig(c.name, customCategories);
            const Icon = cfg.icon;
            const prog = categoryProgress(c.amount, budgets[c.name] || 0);
            return (
              <div
                key={c.name}
                onClick={() => { h.light(); nav("/budgets"); }}
                className="bg-[#1C1C1E] p-3.5 rounded-2xl active:bg-[#2a2a30] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cfg.color}18` }}
                  >
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <span className="flex-1 text-[15px] font-semibold text-white/90 truncate">{c.name}</span>
                  <span className="text-[15px] font-bold text-white/90">{formatMoney(c.amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${prog.hasLimit ? prog.fill : 0}%`,
                        background: prog.over ? "#FF453A" : cfg.color,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-white/35 shrink-0 w-24 text-right">
                    {prog.hasLimit ? `${prog.pct}% від ліміту` : "встанови ліміт"}
                  </span>
                </div>
              </div>
            );
          })}
          {cats.length === 0 && (
            <p className="text-center text-sm font-medium text-white/35 py-10">
              Немає витрат за цей місяць
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify it compiles**

Run (from `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.jsx
git commit -m "feat: redesign home dashboard (hero, metric cards, top categories)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Copy frontend build into `static/` (deploy artifact)

**Files:**
- Modify: `static/` (generated)

The repo serves the prebuilt SPA from `static/` (committed, per `.gitignore` comment). Refresh it so the new UI ships.

- [ ] **Step 1: Rebuild and copy into `static/`**

Run from repo root (PowerShell):
```powershell
cd frontend; npm run build; cd ..
Remove-Item -Recurse -Force static\assets -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force frontend\dist\* static\
```

- [ ] **Step 2: Verify the new bundle landed**

Run: `git status --short static/`
Expected: shows modified/added files under `static/assets/` and `static/index.html`.

- [ ] **Step 3: Commit**

```bash
git add static
git commit -m "build: refresh static SPA bundle with new home + budgets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Full verification

- [ ] **Step 1: Backend tests green**

Run: `python -m pytest backend/tests -v`
Expected: all PASS (auth + budget schema + budget metrics).

- [ ] **Step 2: Frontend tests green**

Run (from `frontend/`): `npm test`
Expected: all PASS (formatters + sparkline + budget).

- [ ] **Step 3: Frontend build green**

Run (from `frontend/`): `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual smoke (optional, requires running app)**

Start the server (`uvicorn backend.app.main:app --port 10000` with env), open the Mini App URL and confirm:
- Home shows hero balance, «Темп витрат» (with sparkline) and «Можна витрати» cards, and «Топ категорій».
- With no budgets set: «Можна витрати» shows «Встанови бюджети», categories show «встанови ліміт».
- Open Бюджети (wallet icon on home or Settings), set a few limits, save → home recomputes, progress bars and «Можна витрати» appear; pace badge turns red when over the safe pace.

---

## Self-Review Notes

**Spec coverage:**
- §1 data model → Task 3 (`budgets` map, default, cleanup).
- §2 API/formulas → Task 1 (schema), Task 2 (formulas), Task 4 (router), Task 5 (bootstrap).
- §3 Budgets screen → Task 9.
- §4 Home redesign (hero, quick actions, two cards, top categories, route) → Task 10. Entry points: home wallet icon (Task 10) + Settings link (Task 9).
- §5 edge cases → covered by Task 2 tests (no budget / past month / over budget) and Task 10 conditional rendering (no-budget hints, over-budget red states).
- §6 testing → Tasks 1, 2, 6, 7 (TDD); query/endpoint layer verified via import smoke + build (repo has no async-Mongo test harness — consistent with existing precedent where `queries.py` is untested).

**Deliberate simplifications (recorded so they're not mistaken for gaps):**
- **Per-category inline quick-edit on home** (spec §4 "bonus shortcut"): implemented as tap → navigate to `/budgets` instead of an inline editor. Keeps the home component bounded; the dedicated screen is the editor.
- **«Можна витрати» label**: shows «залишилось N дн.» using `days_left` rather than an explicit end-date string («до 31 Тра»), avoiding extra date plumbing on the client. Period context is already shown in the hero (`period_label`).
- **`$unset: budgets.<key>` on category delete** assumes category keys contain no `.` (true for all current categories and the UI's typical names). Acceptable for this dataset.

**Type consistency:** backend metric keys (`total_budget`, `days_left`, `can_spend`, `daily_pace`, `pace_vs_budget_pct`) are produced once in `compute_budget_metrics` (Task 2), returned verbatim by bootstrap (Task 5), and read verbatim on the client (Task 10). Frontend helper names (`categoryProgress`, `paceBadge`, `canSpendState`) match between definition (Task 7) and use (Task 10).
