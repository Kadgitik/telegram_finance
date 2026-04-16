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
import PeriodPickerModal from "../components/PeriodPickerModal";
import { useFxRate } from "../hooks/useFxRate";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { Calendar } from "lucide-react";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { ACCENT, getCategoryConfig } from "../utils/constants";

ChartJS.register(Tooltip, CategoryScale, LinearScale, BarElement, ArcElement);

export default function StatsPage() {
  const { initData } = useTelegram();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [month, setStoredMonth] = useStoredMonth();
  const [periodType, setPeriodType] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [showPicker, setShowPicker] = useState(false);
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
    
    // Cache Setup
    const cKey = periodType === "month" ? month : `${customRange.start}_${customRange.end}`;
    const cacheKeyS = `statsCache_${periodType}_${cKey}`;
    const cacheKeyT = `trendCache_${periodType}_${cKey}`;
    const s = localStorage.getItem(cacheKeyS);
    const t = localStorage.getItem(cacheKeyT);
    if (s) {
      try { setStats(JSON.parse(s)); } catch (e) {}
    } else {
      setStats(null);
    }
    if (t) {
      try { setTrend(JSON.parse(t)); } catch (e) {}
    } else {
      setTrend(null);
    }

    (async () => {
      const qs = periodType === "month" 
        ? `period=month&month=${month}`
        : `period=custom&start_date=${customRange.start}&end_date=${customRange.end}`;
        
      const tQs = periodType === "month"
        ? `days=30&month=${month}`
        : `start_date=${customRange.start}&end_date=${customRange.end}`;

      const [s, t] = await Promise.all([
        api.get(`/stats?${qs}`, initData),
        api.get(`/stats/trend?${tQs}`, initData),
      ]);
      localStorage.setItem(cacheKeyS, JSON.stringify(s));
      localStorage.setItem(cacheKeyT, JSON.stringify(t));
      setStats(s);
      setTrend(t);
    })().catch(() => {});
  }, [initData, month, periodType, customRange]);

  const cats = stats?.categories || [];
  const doughnutData = {
    labels: cats.map((c) => c.name),
    datasets: [
      {
        data: cats.map((c) => c.amount),
        backgroundColor: cats.map((c) => getCategoryConfig(c.name).color),
        borderWidth: 2,
        borderColor: "#1C1C1E",
        hoverOffset: 8,
      },
    ],
  };

  const barLabels = trend?.points?.map((p) => p.date.slice(5)) || [];
  const barVals = trend?.points?.map((p) => p.amount) || [];

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans overflow-x-hidden pb-24">
      {/* TOP GRADIENT BG */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none"
        style={{ background: "linear-gradient(180deg, #be185d 0%, #db2777 30%, #000000 100%)" }}
      />
      
      <div className="relative z-10 px-5 pt-8 space-y-6">
        <div className="mb-2">
          <h1 className="text-[32px] font-extrabold tracking-tight text-white leading-tight mb-1">Статистика</h1>
          <button onClick={() => setShowPicker(true)} className="flex items-center gap-2 text-[17px] font-medium text-white/80 active:opacity-70 transition-opacity">
            {stats ? stats.period_label : "Завантаження..."}
            <div className="bg-white/10 p-1.5 rounded-full flex items-center justify-center text-white/80">
                <Calendar size={18} />
            </div>
          </button>
        </div>

        {stats && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="rounded-[32px] bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 p-6 shadow-2xl"
          >
            <p className="font-semibold text-white/50 mb-1">Витрати за місяць</p>
          <div className="flex items-baseline gap-1">
            <h2 className="text-4xl font-extrabold tracking-tighter">
              {formatMoney(stats.total).replace(" ₴", "")}
            </h2>
            <span className="text-2xl font-medium text-white/50">₴</span>
          </div>
          <p className="text-sm font-medium mt-1 flex items-center gap-1 text-white/40">{formatUsdApprox(stats.total, usdRate)}</p>
          <p className="text-[12px] font-medium text-white/40 mt-1">{stats.count} операцій</p>
          </motion.div>
        )}

      {/* Doughnut chart */}
      {cats.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          className="rounded-[32px] bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 p-6 shadow-2xl"
        >
          <p className="font-semibold text-white/50 mb-4">Розподіл витрат</p>
          <div className="relative w-48 h-48 mx-auto mb-6">
            <Doughnut
              data={doughnutData}
              options={{
                cutout: "75%",
                responsive: true,
                maintainAspectRatio: true,
                plugins: { 
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 16, weight: 'bold' },
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                       label: function(context) {
                          return ' ' + context.parsed.toLocaleString('uk-UA') + ' ₴';
                       }
                    }
                  }
                },
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Всього</span>
              <span className="text-[17px] font-extrabold tracking-tight">{formatMoney(stats.total).replace(" ₴", "")}</span>
            </div>
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
          </motion.div>
        )}

      {/* Bar chart */}
      {trend && trend.points?.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          className="rounded-[32px] bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 p-6 shadow-2xl mb-6"
        >
          <p className="font-semibold text-white/50 mb-4">Витрати по днях</p>
          <div className="h-48 w-full">
            <Bar
              data={{
                labels: barLabels,
                datasets: [
                  {
                    data: barVals,
                    borderRadius: 6,
                    borderSkipped: false,
                    backgroundColor: (context) => {
                      const ctx = context.chart.ctx;
                      const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
                      gradient.addColorStop(0, '#10b981');
                      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
                      return gradient;
                    },
                    barThickness: Math.min(16, 240 / Math.max(1, barLabels.length)),
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    titleColor: '#10b981',
                    callbacks: {
                       label: function(context) {
                          return context.parsed.y.toLocaleString('uk-UA') + ' ₴';
                       }
                    }
                  }
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: "#666", maxRotation: 0, font: { size: 10 } } },
                  y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#666", font: { size: 10 } }, beginAtZero: true },
                },
              }}
            />
          </div>
        </motion.div>
      )}
      </div>
      
      <PeriodPickerModal 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        currentPeriodType={periodType}
        currentMonth={month}
        currentRange={customRange}
        onApply={(type, data) => {
          setPeriodType(type);
          if (type === 'custom') {
            setCustomRange(data);
          } else {
            setStoredMonth(data);
          }
          setShowPicker(false);
        }}
      />
    </div>
  );
}
