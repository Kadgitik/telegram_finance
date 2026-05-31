import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Settings, Wallet } from "lucide-react";
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
  const cats = [...(boot?.stats?.categories || [])].sort((a, b) => b.amount - a.amount);
  const trendValues = (boot?.trend?.points || []).map((p) => p.amount);

  const balanceValue = formatMoney(balance.balance || 0).replace(" ₴", "");
  const badge = paceBadge(boot?.pace_vs_budget_pct ?? null);
  const cs = canSpendState(boot?.can_spend ?? 0);
  const spentPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;

  const QUICK = [
    { to: "/add?type=income", label: "Дохід", icon: ArrowUpRight, color: "#34C759" },
    { to: "/add?type=expense", label: "Витрата", icon: ArrowDownLeft, color: "#FF453A" },
    { to: "/savings", label: "Накопич.", icon: ArrowLeftRight, color: "#A78BFA" },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden pb-28">
      <div className="px-5 pt-4">
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
          className="rounded-[28px] p-6 mb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #1f3a30 0%, #14241e 60%, #0d1714 100%)" }}
        >
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Залишок · {balance.period_label || ""}
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[44px] font-extrabold tracking-tighter leading-none">{balanceValue}</h2>
            <span className="text-xl font-medium text-white/35">₴</span>
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
                style={{ width: `${spentPct}%`, background: spent > totalBudget ? "#FF453A" : "#34d399" }}
              />
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-4">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                onClick={() => h.light()}
                className="flex-1 rounded-2xl bg-[#1C1C1E] py-3 flex flex-col items-center gap-1.5 active:bg-[#2a2a30] transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${q.color}1f` }}
                >
                  <Icon size={18} color={q.color} />
                </div>
                <span className="text-[12px] font-medium text-white/70">{q.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 mb-6">
          {/* Темп витрат */}
          <div className="flex-1 rounded-2xl bg-[#1C1C1E] p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wide text-white/40">Темп витрат</p>
              {badge.show && (
                <span className="text-[11px] font-bold" style={{ color: badge.color }}>
                  {badge.up ? "↗" : "↘"} {badge.text}
                </span>
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
          <div className="flex-1 rounded-2xl bg-[#1C1C1E] p-4">
            <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Можна витрати</p>
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
                onClick={() => { h.light(); nav("/budgets"); }}
                className="bg-[#1C1C1E] p-3.5 rounded-2xl active:bg-[#2a2a30] transition-colors cursor-pointer"
              >
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
                    {prog.hasLimit ? `${prog.pct}% від ліміту` : "встанови ліміт"}
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
