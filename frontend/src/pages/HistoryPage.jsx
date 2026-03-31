import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { formatDayLabel, formatMoney, formatTime, formatUsdApprox } from "../utils/formatters";
import { useStoredMonth } from "../utils/month";

export default function HistoryPage() {
  const [params] = useSearchParams();
  const categoryFromQuery = params.get("category") || "";
  const { initData } = useTelegram();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState(categoryFromQuery);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month] = useStoredMonth();
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    setLoading(true);
    try {
      let q = `/transactions?limit=50&month=${month}`;
      if (filter === "expense") q += "&type=expense";
      if (filter === "income") q += "&type=income";
      if (search.trim()) q += "&search=" + encodeURIComponent(search.trim());
      if (categoryFromQuery) q += "&category=" + encodeURIComponent(categoryFromQuery);
      const r = await api.get(q, initData);
      setItems(r.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [initData, filter, month, categoryFromQuery]);

  const grouped = () => {
    const m = new Map();
    for (const x of items) {
      const day = formatDayLabel(x.created_at);
      if (!m.has(day)) m.set(day, []);
      m.get(day).push(x);
    }
    return [...m.entries()];
  };

  const remove = async (id) => {
    if (!initData || !confirm("Видалити?")) return;
    await api.delete(`/transactions/${id}`, initData);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Історія</h1>
      <div className="flex rounded-xl bg-[var(--app-secondary)] p-1 mb-3">
        {[
          ["all", "Все"],
          ["expense", "Витрати"],
          ["income", "Доходи"],
        ].map(([k, lab]) => (
          <button
            type="button"
            key={k}
            className={`flex-1 py-2 rounded-lg text-sm ${
              filter === k ? "bg-[var(--app-button)]/30" : ""
            }`}
            onClick={() => setFilter(k)}
          >
            {lab}
          </button>
        ))}
      </div>
      <input
        className="w-full mb-4 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
        placeholder="🔍 Пошук..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
      />
      {loading && <p className="text-sm text-[var(--app-hint)]">Завантаження…</p>}
      {grouped().map(([day, rows]) => (
        <div key={day} className="mb-4">
          <p className="text-xs text-[var(--app-hint)] mb-1">{day}</p>
          <ul className="space-y-1">
            {rows.map((x) => (
              <li
                key={x.id}
                className="flex items-center justify-between rounded-xl bg-[var(--app-secondary)] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{x.category}</p>
                  <p className="text-xs text-[var(--app-hint)]">
                    {x.comment} · {formatTime(x.created_at)}
                  </p>
                </div>
                <span
                  className={
                    x.type === "income" ? "text-green-400" : "text-[var(--app-text)]"
                  }
                >
                  {x.type === "income" ? "+" : "-"}
                  {formatMoney(x.amount)}
                  <span className="block text-[10px] text-[var(--app-hint)] text-right">
                    {formatUsdApprox(x.amount, usdRate)}
                  </span>
                </span>
                <button
                  type="button"
                  className="ml-2 text-red-400 text-xs"
                  onClick={() => remove(x.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
