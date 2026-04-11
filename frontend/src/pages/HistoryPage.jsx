import { Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatDayLabel, formatMoney, formatTime } from "../utils/formatters";
import { getCategoryConfig } from "../utils/constants";

export default function HistoryPage() {
  const { initData } = useTelegram();
  const h = useHaptic();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [month, setStoredMonth] = useStoredMonth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const load = async (reset = false) => {
    if (!initData) return;
    const off = reset ? 0 : offset;
    const params = new URLSearchParams({
      month,
      offset: String(off),
      limit: String(LIMIT),
    });
    if (filter !== "all") params.set("type", filter);
    if (search.trim()) params.set("search", search.trim());

    const r = await api.get(`/transactions?${params}`, initData);
    if (reset) {
      setItems(r.items || []);
      setOffset(LIMIT);
    } else {
      setItems((prev) => [...prev, ...(r.items || [])]);
      setOffset(off + LIMIT);
    }
    setTotal(r.total || 0);
  };

  useEffect(() => {
    load(true).catch(() => {});
  }, [initData, month, filter, search]);

  const handleDelete = async (id) => {
    if (!initData) return;
    try {
      await api.delete(`/transactions/${id}`, initData);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      h.success();
    } catch {
      h.error();
    }
  };

  const grouped = {};
  for (const tx of items) {
    const day = tx.date?.slice(0, 10) || "unknown";
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(tx);
  }
  const days = Object.keys(grouped).sort().reverse();

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Історія</h1>
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-lg bg-[var(--app-secondary)]"
        >
          <Search size={16} />
        </button>
      </div>

      {showSearch && (
        <input
          className="w-full rounded-xl px-3 py-2.5 mb-3 bg-[var(--app-secondary)] border border-white/10 placeholder:text-[var(--app-hint)] text-sm"
          placeholder="Пошук..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      )}

      <MonthSwitcher month={month} onChange={setStoredMonth} />

      <div className="flex gap-2 mb-4 mt-3">
        {[
          ["all", "Усі"],
          ["expense", "Витрати"],
          ["income", "Доходи"],
        ].map(([k, lab]) => (
          <button
            type="button"
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              filter === k
                ? "bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)]"
                : "bg-[var(--app-secondary)]"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--app-hint)] mb-3">{total} операцій</p>

      {days.map((day) => (
        <div key={day} className="mb-4">
          <p className="text-xs text-[var(--app-hint)] mb-1.5 font-medium">{formatDayLabel(day)}</p>
          <ul className="space-y-1">
            {grouped[day].map((x) => {
              const cat = getCategoryConfig(x.category);
              const Icon = cat.icon;
              return (
                <li
                  key={x.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[var(--app-secondary)]"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <Icon size={18} color={cat.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {x.description || x.category}
                    </p>
                    <p className="text-xs text-[var(--app-hint)] truncate">
                      {x.source === "monobank" ? "\uD83D\uDCB3" : "\uD83D\uDCB5"} {x.category} · {formatTime(x.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-medium tabular-nums ${
                        x.type === "income" ? "text-green-400" : "text-[var(--app-text)]"
                      }`}
                    >
                      {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)}
                    </p>
                  </div>
                  {x.source === "cash" && (
                    <button
                      type="button"
                      onClick={() => handleDelete(x.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 shrink-0"
                    >
                      <Trash2 size={14} className="text-[var(--app-hint)]" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {items.length < total && (
        <button
          type="button"
          onClick={() => load(false)}
          className="w-full py-2.5 rounded-xl bg-[var(--app-secondary)] text-sm text-[var(--app-hint)]"
        >
          Завантажити ще
        </button>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm text-[var(--app-hint)] py-12">
          Немає операцій
        </p>
      )}
    </div>
  );
}
