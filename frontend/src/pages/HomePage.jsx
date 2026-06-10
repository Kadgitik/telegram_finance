import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Settings, Wallet, TrendingUp, TrendingDown } from "lucide-react";
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
  const budget_spent = boot?.budget_spent || 0;
  const cats = [...(boot?.stats?.categories || [])].sort((a, b) => b.amount - a.amount);
  const trendValues = (boot?.trend?.points || []).map((p) => p.amount);

  const balanceValue = formatMoney(balance.balance || 0).replace(" ₴", "");
  const badge = paceBadge(boot?.pace_vs_budget_pct ?? null);
  const cs = canSpendState(boot?.can_spend ?? 0);
  const spentPct = totalBudget > 0 ? Math.min(100, (budget_spent / totalBudget) * 100) : 0;

  const QUICK = [
    { to: "/add?type=income", label: "Дохід", icon: ArrowUpRight, color: "#34C759" },
    { to: "/add?type=expense", label: "Витрата", icon: ArrowDownLeft, color: "#FF453A" },
    { to: "/savings", label: "Накопич.", icon: ArrowLeftRight, color: "#A78BFA" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-[#EDEDEF] font-sans overflow-x-hidden pb-28 relative">
      {/* Ambient background glows */}
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50vh] h-[50vh] bg-emerald-500 rounded-full blur-[120px] pointer-events-none opacity-40"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-[20%] right-[-20%] w-[60vh] h-[60vh] bg-indigo-600 rounded-full blur-[140px] pointer-events-none opacity-30"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.3, 0.2], scale: [1, 1.05, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[10%] left-[20%] w-[40vh] h-[40vh] bg-purple-600 rounded-full blur-[100px] pointer-events-none opacity-30"
      />
      
      <div className="px-5 pt-4 relative z-10">
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
          className="rounded-[28px] p-6 mb-5 relative overflow-hidden bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Залишок · {balance.period_label || ""}
          </p>
          <div className="flex items-baseline gap-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
            <h2 className="text-[44px] font-extrabold tracking-tighter leading-none">{balanceValue}</h2>
            <span className="text-xl font-medium text-white/50">₴</span>
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
                style={{ width: `${spentPct}%`, background: budget_spent > totalBudget ? "#FF453A" : "#34d399" }}
              />
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-5">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                onClick={() => h.light()}
                className="flex-1 rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 py-3.5 flex flex-col items-center gap-2 active:bg-white/10 transition-all active:scale-[0.98] shadow-lg"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-20" style={{ backgroundColor: q.color }} />
                  <Icon size={20} color={q.color} className="relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
                </div>
                <span className="text-[12px] font-medium text-white/70">{q.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 mb-7">
          {/* Темп витрат */}
          <div className="flex-1 rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/10 p-4 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Темп витрат</p>
              {badge.show && (
                <div 
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-sm"
                  style={{ 
                    backgroundColor: `${badge.color}15`, 
                    color: badge.color,
                    borderColor: `${badge.color}30`
                  }}
                >
                  {badge.up ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
                  <span>{badge.text}</span>
                </div>
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
          <div className="flex-1 rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/10 p-4 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Можна витрати
            </p>
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
                onClick={() => { h.light(); nav("/history?search=" + encodeURIComponent(c.name)); }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[24px] active:bg-white/10 transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden shadow-lg"
              >
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
                    {prog.hasLimit ? `${prog.pct}% від ліміту` : ""}
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
