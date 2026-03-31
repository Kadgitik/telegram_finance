import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../utils/month";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { ACCENT } from "../utils/constants";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function BudgetsPage() {
  const { initData } = useTelegram();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total_limit: 0, total_spent: 0, total_percent: 0 });
  const [periodLabel, setPeriodLabel] = useState("");
  const [cat, setCat] = useState("🍔 Їжа");
  const [amt, setAmt] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [categoryOptions, setCategoryOptions] = useState([]);
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    const path = `/budgets?month=${month}`;
    const cached = api.getCached(path, initData);
    if (cached) {
      setRows(cached.budgets || []);
      setPeriodLabel(cached.period_label || "");
      setSummary({
        total_limit: cached.total_limit || 0,
        total_spent: cached.total_spent || 0,
        total_percent: cached.total_percent || 0,
      });
    }
    const r = await api.get(path, initData);
    setRows(r.budgets || []);
    setPeriodLabel(r.period_label || "");
    setSummary({
      total_limit: r.total_limit || 0,
      total_spent: r.total_spent || 0,
      total_percent: r.total_percent || 0,
    });
  };

  useEffect(() => {
    load();
  }, [initData, month]);

  useEffect(() => {
    if (!initData) return;
    api
      .get("/categories", initData)
      .then((r) => {
        const defaults = (r.expense_defaults || []).map((x) => x.label);
        const custom = (r.custom || []).map((x) => x.label);
        const all = [...new Set([...defaults, ...custom])];
        setCategoryOptions(all);
        if (all.length && !all.includes(cat)) setCat(all[0]);
      })
      .catch(() => {});
  }, [initData]);

  const save = async () => {
    if (!initData || !cat.trim() || !amt) return;
    await api.post("/budgets", initData, {
      category: cat.trim(),
      limit: parseFloat(amt),
    });
    setCat("");
    setAmt("");
    load();
  };

  const del = async (c) => {
    if (!initData || !confirm("Видалити бюджет?")) return;
    await api.delete("/budgets/" + encodeURIComponent(c), initData);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-2">Бюджети</h1>
      <MonthSwitcher
        month={month}
        onChange={setStoredMonth}
        periodLabel={periodLabel}
        subtitle={`Витрачено ${formatMoney(summary.total_spent)} (${formatUsdApprox(summary.total_spent, usdRate)}) з ${formatMoney(summary.total_limit)} (${summary.total_percent}%)`}
      />
      {rows.length > 0 && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3 mb-4 space-y-3">
          <Doughnut
            data={{
              labels: rows.map((x) => x.category),
              datasets: [
                {
                  label: "Витрачено",
                  data: rows.map((x) => x.spent),
                  backgroundColor: rows.map((_, i) => ACCENT.chart[i % ACCENT.chart.length]),
                  borderWidth: 0,
                },
              ],
            }}
            options={{ cutout: "65%", plugins: { legend: { position: "bottom" } } }}
          />
          <Bar
            data={{
              labels: rows.map((x) => x.category),
              datasets: [
                {
                  label: "% використання",
                  data: rows.map((x) => Math.min(100, x.percent)),
                  backgroundColor: rows.map((_, i) => ACCENT.chart[i % ACCENT.chart.length]),
                  borderRadius: 8,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#888" } },
                y: { ticks: { color: "#888" }, min: 0, max: 100 },
              },
            }}
          />
        </div>
      )}
      <div className="space-y-3 mb-6">
        {rows.map((row) => (
          <div
            key={row.category}
            className="rounded-xl p-3 bg-[var(--app-secondary)]"
          >
            <div className="flex justify-between items-center gap-2 mb-2">
              <Link to={`/history?category=${encodeURIComponent(row.category)}`} className="text-sm truncate">
                {row.category}
              </Link>
              <span className="text-sm tabular-nums">
                {formatMoney(row.spent)} / {formatMoney(row.limit)}
                <span className="block text-[10px] text-[var(--app-hint)] text-right">
                  {formatUsdApprox(row.spent, usdRate)} / {formatUsdApprox(row.limit, usdRate)}
                </span>
              </span>
              <button type="button" className="text-red-400 text-sm" onClick={() => del(row.category)}>
                ✕
              </button>
            </div>
            <div className="h-2 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.min(100, row.percent)}%`,
                  background:
                    row.percent >= 100
                      ? ACCENT.red
                      : row.percent >= 80
                        ? "#FF6B30"
                        : row.percent >= 50
                          ? ACCENT.orange
                          : ACCENT.green,
                }}
              />
            </div>
            <p className="text-xs text-[var(--app-hint)] mt-1">
              {row.remaining >= 0
                ? `Залишилось: ${formatMoney(row.remaining)} (${formatUsdApprox(row.remaining, usdRate)})`
                : "Перевищено!"}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-[var(--app-hint)] mb-2">Новий бюджет</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {categoryOptions.map((label) => (
          <button
            type="button"
            key={label}
            className={`rounded-xl py-2 text-xs ${cat === label ? "bg-[var(--app-button)]/25 border border-[var(--app-button)]" : "bg-[var(--app-secondary)] border border-white/5"}`}
            onClick={() => setCat(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="number"
        className="w-full mb-2 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
        placeholder="Ліміт ₴"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
      />
      <button
        type="button"
        className="w-full py-3 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium"
        onClick={save}
      >
        Зберегти
      </button>
    </div>
  );
}
