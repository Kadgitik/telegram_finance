import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatMoney, formatUsdApprox } from "../utils/formatters";

ChartJS.register(
  Tooltip,
  CategoryScale,
  LinearScale,
  BarElement
);

const PERIODS = [
  ["week", "Тиждень"],
  ["month", "Місяць"],
  ["3months", "3 міс."],
  ["year", "Рік"],
];

export default function StatsPage() {
  const { initData } = useTelegram();
  const [period, setPeriod] = useState("month");
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [month, setStoredMonth] = useStoredMonth();
  const usdRate = useFxRate();

  useEffect(() => {
    if (!initData) return;
    const statsPath = `/stats?period=${period}&month=${month}`;
    const trendPath = `/stats/trend?days=30&month=${month}`;
    const cachedStats = api.getCached(statsPath, initData);
    const cachedTrend = api.getCached(trendPath, initData);
    if (cachedStats) setStats(cachedStats);
    if (cachedTrend) setTrend(cachedTrend);
    (async () => {
      const [s, t] = await Promise.all([
        api.get(statsPath, initData),
        api.get(trendPath, initData),
      ]);
      setStats(s);
      setTrend(t);
    })().catch(() => {});
  }, [initData, period, month]);

  const barLabels = trend?.points?.map((p) => p.date.slice(5)) || [];
  const barVals = trend?.points?.map((p) => p.amount) || [];

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Статистика</h1>
      <MonthSwitcher month={month} onChange={setStoredMonth} periodLabel={stats?.period_label || ""} />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {PERIODS.map(([k, lab]) => (
          <button
            type="button"
            key={k}
            onClick={() => setPeriod(k)}
            className={`whitespace-nowrap px-3 py-1 rounded-full text-sm ${
              period === k
                ? "bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)]"
                : "bg-[var(--app-secondary)]"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>

      {stats && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3">
          <p className="text-sm text-[var(--app-hint)]">Витрати за період</p>
          <p className="text-2xl font-bold">
            {formatMoney(stats.total)}
          </p>
          <p className="text-xs text-[var(--app-hint)]">{formatUsdApprox(stats.total, usdRate)}</p>
        </div>
      )}

      {stats?.categories?.length > 0 && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3">
          <p className="text-sm text-[var(--app-hint)] mb-2">Категорії витрат</p>
          <ul className="space-y-2">
            {stats.categories.map((c) => (
              <li key={c.name}>
                <Link
                  to={`/stats/category?category=${encodeURIComponent(c.name)}&month=${encodeURIComponent(month)}`}
                  className="rounded-xl px-3 py-3 bg-black/20 grid grid-cols-[minmax(0,1fr)_112px_40px] gap-2 items-center border border-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-[var(--app-hint)]">{c.count} транзакцій</p>
                  </div>
                  <div className="text-right tabular-nums">
                    -{formatMoney(c.amount)}
                    <p className="text-[10px] text-[var(--app-hint)]">
                      {formatUsdApprox(c.amount, usdRate)}
                    </p>
                  </div>
                  <p className="text-right text-sm text-[var(--app-hint)]">{c.percent}%</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trend && trend.points?.length > 0 && (
        <div>
          <p className="text-sm text-[var(--app-hint)] mb-2">Графік по датах</p>
          <Bar
            data={{
              labels: barLabels,
              datasets: [
                {
                  data: barVals,
                  borderRadius: 8,
                  backgroundColor: "#4F8EF7",
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#888", maxRotation: 0, autoSkip: true } },
                y: { ticks: { color: "#888" } },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
