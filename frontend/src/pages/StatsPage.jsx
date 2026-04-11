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
        <div className="rounded-[24px] bg-[var(--app-card)] p-5">
          <p className="font-semibold text-white/50 mb-1">Витрати за місяць</p>
          <div className="flex items-baseline gap-1">
            <h2 className="text-4xl font-extrabold tracking-tighter">
              {formatMoney(stats.total).replace(" ₴", "")}
            </h2>
            <span className="text-2xl font-medium text-white/50">₴</span>
          </div>
          <p className="text-sm font-medium mt-1 flex items-center gap-1 text-white/40">{formatUsdApprox(stats.total, usdRate)}</p>
          <p className="text-[12px] font-medium text-white/40 mt-1">{stats.count} операцій</p>
        </div>
      )}

      {/* Doughnut chart */}
      {cats.length > 0 && (
        <div className="rounded-[24px] bg-[var(--app-card)] p-5">
          <p className="font-semibold text-white/50 mb-4">Розподіл витрат</p>
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
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer active:bg-black/20 rounded-[20px] transition-colors"
                    onClick={() => toggleCat(c.name)}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cfg.color}20` }}
                    >
                      <Icon size={22} color={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[16px] truncate text-white/95">{c.name}</p>
                      <p className="text-[12px] font-medium text-white/40">{c.count} оп.</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-[16px] tracking-tight">{formatMoney(c.amount).replace(" ₴", "")}</p>
                      <p className="text-[12px] font-medium text-white/40">{c.percent}%</p>
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
                        <div className="p-3 space-y-2 mt-1 mx-2 bg-[#212124] rounded-[20px]">
                          {loadingCat ? (
                            <p className="text-xs text-center text-[var(--app-hint)] py-2">Завантаження...</p>
                          ) : catTx.length > 0 ? (
                            catTx.map((tx) => (
                              <div key={tx.id} className="flex justify-between items-center gap-2 px-2 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[14px] truncate text-white/90">
                                    {tx.description || tx.category || "—"}
                                  </p>
                                  <p className="text-[11px] text-white/40">
                                    {tx.date.slice(8, 10)}.{tx.date.slice(5, 7)} {tx.date.slice(11, 16)}
                                    {tx.source === 'monobank' ? " · 💳" : ""}
                                  </p>
                                </div>
                                <p className="font-semibold tabular-nums text-[14px] tracking-tight shrink-0">
                                  {formatMoney(tx.amount).replace(" ₴", "")}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-center text-[var(--app-hint)] py-2">Немає деталей</p>
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
        <div className="rounded-[24px] bg-[var(--app-card)] p-5">
          <p className="font-semibold text-white/50 mb-4">Витрати по днях</p>
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
