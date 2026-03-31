import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../utils/month";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { ACCENT } from "../utils/constants";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler
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
    (async () => {
      const [s, t] = await Promise.all([
        api.get(`/stats?period=${period}&month=${month}`, initData),
        api.get(`/stats/trend?days=30&month=${month}`, initData),
      ]);
      setStats(s);
      setTrend(t);
    })().catch(() => {});
  }, [initData, period, month]);

  const labels = stats?.categories?.map((c) => c.name) || [];
  const dataVals = stats?.categories?.map((c) => c.amount) || [];
  const colors = labels.map((_, i) => ACCENT.chart[i % ACCENT.chart.length]);

  const doughnutData = {
    labels,
    datasets: [
      {
        data: dataVals,
        backgroundColor: colors,
        borderWidth: 0,
      },
    ],
  };

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-center text-[var(--app-hint)] text-sm mb-2">
            Витрати — {formatMoney(stats.total)} ({formatUsdApprox(stats.total, usdRate)})
          </p>
          <div className="max-w-xs mx-auto">
            <Doughnut
              data={doughnutData}
              options={{
                cutout: "65%",
                plugins: { legend: { position: "bottom" } },
              }}
            />
          </div>
        </motion.div>
      )}

      {stats?.categories?.length > 0 && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3">
          <p className="text-sm text-[var(--app-hint)] mb-2">Категорії витрат</p>
          <ul className="space-y-1">
            {stats.categories.map((c) => (
              <li key={c.name}>
                <Link
                  to={`/stats/category?category=${encodeURIComponent(c.name)}&month=${encodeURIComponent(month)}`}
                  className="rounded-lg px-3 py-2 bg-black/20 grid grid-cols-[minmax(0,1fr)_112px_40px] gap-2 items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate">{c.name}</p>
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
          <p className="text-sm text-[var(--app-hint)] mb-2">Тренд (30 дн.)</p>
          <Line
            data={{
              labels: barLabels,
              datasets: [
                {
                  data: barVals,
                  borderColor: ACCENT.blue,
                  backgroundColor: "rgba(0,122,255,0.15)",
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: {
                  ticks: { color: "#888" },
                  grid: { color: "rgba(128,128,128,0.1)" },
                },
                y: {
                  ticks: { color: "#888" },
                  grid: { color: "rgba(128,128,128,0.1)" },
                },
              },
            }}
          />
          <Bar
            data={{
              labels: barLabels.slice(-7),
              datasets: [
                {
                  data: barVals.slice(-7),
                  borderRadius: 8,
                  backgroundColor: colors[0] || ACCENT.blue,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#888" } },
                y: { ticks: { color: "#888" } },
              },
            }}
          />
        </div>
      )}
      {stats?.budget_summary && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3">
          <p className="text-sm text-[var(--app-hint)] mb-1">Бюджети</p>
          <p className="font-semibold">
            {formatMoney(stats.budget_summary.total_spent)} з {formatMoney(stats.budget_summary.total_limit)}
          </p>
          <p className="text-xs text-[var(--app-hint)]">
            {formatUsdApprox(stats.budget_summary.total_spent, usdRate)} з {formatUsdApprox(stats.budget_summary.total_limit, usdRate)}
          </p>
          <p className="text-xs text-[var(--app-hint)]">{stats.budget_summary.total_percent}% використано</p>
        </div>
      )}
    </div>
  );
}
