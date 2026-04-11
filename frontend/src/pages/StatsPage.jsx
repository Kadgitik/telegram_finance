import { AnimatePresence, motion } from "framer-motion";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { ACCENT, getCategoryConfig } from "../utils/constants";

ChartJS.register(Tooltip, CategoryScale, LinearScale, BarElement, ArcElement);

export default function StatsPage() {
  const { initData } = useTelegram();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [month, setStoredMonth] = useStoredMonth();
  const usdRate = useFxRate();

  const [expandedCat, setExpandedCat] = useState(null);
  const [catTx, setCatTx] = useState([]);
  const [loadingCat, setLoadingCat] = useState(false);

  const toggleCat = async (cName) => {
    if (expandedCat === cName) {
      setExpandedCat(null);
      return;
    }
    setExpandedCat(cName);
    setLoadingCat(true);
    setCatTx([]);
    try {
      const res = await api.get(`/transactions?type=expense&month=${month}&category=${encodeURIComponent(cName)}&limit=50`, initData);
      setCatTx(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingCat(false);
    }
  };

  useEffect(() => {
    if (!initData) return;
    (async () => {
      const [s, t] = await Promise.all([
        api.get(`/stats?period=month&month=${month}`, initData),
        api.get(`/stats/trend?days=30&month=${month}`, initData),
      ]);
      setStats(s);
      setTrend(t);
    })().catch(() => {});
  }, [initData, month]);

  const cats = stats?.categories || [];
  const doughnutData = {
    labels: cats.map((c) => c.name),
    datasets: [
      {
        data: cats.map((c) => c.amount),
        backgroundColor: cats.map((c) => getCategoryConfig(c.name).color),
        borderWidth: 0,
      },
    ],
  };

  const barLabels = trend?.points?.map((p) => p.date.slice(5)) || [];
  const barVals = trend?.points?.map((p) => p.amount) || [];

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">Статистика</h1>
      <MonthSwitcher month={month} onChange={setStoredMonth} periodLabel={stats?.period_label || ""} />

      {stats && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-4">
          <p className="text-sm text-[var(--app-hint)]">Витрати за місяць</p>
          <p className="text-3xl font-bold">{formatMoney(stats.total)}</p>
          <p className="text-xs text-[var(--app-hint)]">{formatUsdApprox(stats.total, usdRate)}</p>
          <p className="text-xs text-[var(--app-hint)] mt-1">{stats.count} операцій</p>
        </div>
      )}

      {/* Doughnut chart */}
      {cats.length > 0 && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-4">
          <p className="text-sm text-[var(--app-hint)] mb-3">Розподіл витрат</p>
          <div className="w-48 h-48 mx-auto mb-4">
            <Doughnut
              data={doughnutData}
              options={{
                cutout: "65%",
                plugins: { legend: { display: false } },
              }}
            />
          </div>

          {/* Category list */}
          <ul className="space-y-2">
            {cats.map((c) => {
              const cfg = getCategoryConfig(c.name);
              const Icon = cfg.icon;
              const isExpanded = expandedCat === c.name;
              
              return (
                <li key={c.name} className="rounded-lg overflow-hidden transition-colors">
                  <div
                    className="flex items-center gap-3 px-2 py-2 cursor-pointer active:bg-black/10 rounded-lg"
                    onClick={() => toggleCat(c.name)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cfg.color}20` }}
                    >
                      <Icon size={16} color={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-[var(--app-hint)]">{c.count} оп.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">-{formatMoney(c.amount)}</p>
                      <p className="text-xs text-[var(--app-hint)]">{c.percent}%</p>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/10 rounded-lg mt-1"
                      >
                        <div className="p-3 space-y-3">
                          {loadingCat ? (
                            <p className="text-xs text-center text-[var(--app-hint)]">Завантаження...</p>
                          ) : catTx.length > 0 ? (
                            catTx.map((tx) => (
                              <div key={tx.id} className="flex justify-between items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate text-white/90">
                                    {tx.description || tx.category || "—"}
                                  </p>
                                  <p className="text-[10px] text-[var(--app-hint)]">
                                    {tx.date.slice(8, 10)}.{tx.date.slice(5, 7)} {tx.date.slice(11, 16)}
                                    {tx.source === 'monobank' ? " · 💳" : ""}
                                  </p>
                                </div>
                                <p className="text-xs font-medium tabular-nums shrink-0">
                                  -{formatMoney(tx.amount)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-center text-[var(--app-hint)]">Немає деталей</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bar chart */}
      {trend && trend.points?.length > 0 && (
        <div className="rounded-xl bg-[var(--app-secondary)] p-4">
          <p className="text-sm text-[var(--app-hint)] mb-2">Витрати по днях</p>
          <Bar
            data={{
              labels: barLabels,
              datasets: [
                {
                  data: barVals,
                  borderRadius: 6,
                  backgroundColor: ACCENT.blue,
                },
              ],
            }}
            options={{
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: "#888", maxRotation: 0, autoSkip: true, font: { size: 10 } } },
                y: { ticks: { color: "#888" } },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
