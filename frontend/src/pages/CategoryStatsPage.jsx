import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { formatDayLabel, formatMoney, formatTime, formatUsdApprox } from "../utils/formatters";
import { formatMonthLabel } from "../utils/month";

export default function CategoryStatsPage() {
  const { initData } = useTelegram();
  const usdRate = useFxRate();
  const [params] = useSearchParams();
  const category = params.get("category") || "";
  const month = params.get("month") || "";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!initData || !category || !month) return;
    setLoading(true);
    setErr("");
    api
      .get(
        `/transactions?month=${encodeURIComponent(month)}&type=expense&category=${encodeURIComponent(category)}&limit=200`,
        initData
      )
      .then((r) => setItems(r.items || []))
      .catch((e) => setErr(String(e.message)))
      .finally(() => setLoading(false));
  }, [initData, category, month]);

  const total = useMemo(
    () => items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0),
    [items]
  );

  const grouped = useMemo(() => {
    const m = new Map();
    for (const x of items) {
      const day = formatDayLabel(x.created_at);
      if (!m.has(day)) m.set(day, []);
      m.get(day).push(x);
    }
    return [...m.entries()];
  }, [items]);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <Link to="/stats" className="text-sm text-[var(--app-button)]">← До статистики</Link>
      <h1 className="text-xl font-bold mt-2">{category || "Категорія"}</h1>
      <p className="text-sm text-[var(--app-hint)]">{month ? formatMonthLabel(month) : ""}</p>

      <div className="rounded-xl bg-[var(--app-secondary)] p-3 mt-3 mb-4">
        <p className="text-sm text-[var(--app-hint)]">Витрачено</p>
        <p className="text-2xl font-bold">-{formatMoney(total)}</p>
        <p className="text-xs text-[var(--app-hint)]">{formatUsdApprox(total, usdRate)}</p>
      </div>

      {err ? <p className="text-red-400 text-sm mb-2">{err}</p> : null}
      {loading ? <p className="text-sm text-[var(--app-hint)]">Завантаження…</p> : null}

      <div className="space-y-3">
        {grouped.map(([day, rows]) => (
          <div key={day}>
            <p className="text-xs text-[var(--app-hint)] mb-1">{day}</p>
            <ul className="space-y-1">
              {rows.map((x) => (
                <li
                  key={x.id}
                  className="rounded-xl bg-[var(--app-secondary)] px-3 py-2 grid grid-cols-[minmax(0,1fr)_112px] gap-2 items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">{x.comment || "Без коментаря"}</p>
                    <p className="text-xs text-[var(--app-hint)]">{formatTime(x.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">-{formatMoney(x.amount)}</p>
                    <p className="text-[10px] text-[var(--app-hint)]">{formatUsdApprox(x.amount, usdRate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
