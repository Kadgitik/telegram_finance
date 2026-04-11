import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, BarChart3, RefreshCw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatMoney, formatTime, formatUsdApprox } from "../utils/formatters";
import { ACCENT, getCategoryConfig } from "../utils/constants";

export default function HomePage() {
  const nav = useNavigate();
  const { initData, ready } = useTelegram();
  const h = useHaptic();
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [err, setErr] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [monoConnected, setMonoConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    setErr("");
    try {
      const boot = await api.get(`/bootstrap?month=${month}`, initData);
      if (boot?.balance) setBalance(boot.balance);
      if (boot?.transactions) setTx(boot.transactions.items || []);
      setMonoConnected(!!boot?.mono_connected);
    } catch (e) {
      setErr(String(e.message));
    }
  };

  const syncMono = async () => {
    if (!initData || syncing) return;
    setSyncing(true);
    h.light();
    try {
      await api.post("/mono/sync", initData, {});
      await load();
      h.success();
    } catch (e) {
      setErr(String(e.message));
      h.error();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (ready && initData) load();
  }, [ready, initData, month]);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      {!initData && (
        <p className="text-sm text-orange-400 mb-4">
          Відкрий застосунок через Telegram, щоб авторизуватись.
        </p>
      )}

      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}

      <div className="flex items-stretch gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <MonthSwitcher
            month={month}
            onChange={setStoredMonth}
            periodLabel={balance?.period_label || ""}
          />
        </div>
        <button
          type="button"
          className="shrink-0 h-[46px] w-[46px] rounded-xl border border-white/10 bg-[var(--app-secondary)] flex items-center justify-center mt-1"
          onClick={() => nav("/settings")}
          aria-label="Налаштування"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-4 text-white shadow-lg relative"
        style={{
          background: `linear-gradient(135deg, ${ACCENT.blue}, ${ACCENT.purple})`,
        }}
      >
        {usdRate ? (
          <p className="absolute top-3 right-3 text-[10px] opacity-80">
            1$ = {usdRate.toFixed(2)} ₴
          </p>
        ) : null}
        <p className="text-sm opacity-90">Баланс за місяць</p>
        <p className="text-4xl font-bold my-2">
          {balance ? formatMoney(balance.balance) : "—"}
        </p>
        {balance?.mono_balance != null && (
          <p className="text-xs opacity-80 mb-1">
            Monobank: {formatMoney(balance.mono_balance)}
          </p>
        )}
        <p className="text-xs opacity-90">
          {balance ? formatUsdApprox(balance.balance, usdRate) : ""}
        </p>
        <div className="flex gap-6 text-sm mt-1">
          <span style={{ color: ACCENT.green }}>
            ↑ {balance ? formatMoney(balance.income) : "—"}
          </span>
          <span style={{ color: "#ffcccc" }}>
            ↓ {balance ? formatMoney(balance.expense) : "—"}
          </span>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Link to="/add?type=expense" onClick={() => h.light()}>
          <motion.div
            whileTap={{ scale: 0.96 }}
            className="rounded-xl p-3 text-left shadow bg-[var(--app-secondary)] border border-white/5"
            style={{ borderColor: `${ACCENT.red}44` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft size={16} color={ACCENT.red} />
              <p className="text-sm font-semibold">Витрата</p>
            </div>
            <p className="text-xs text-[var(--app-hint)]">Додати готівкою</p>
          </motion.div>
        </Link>

        <Link to="/add?type=income" onClick={() => h.light()}>
          <motion.div
            whileTap={{ scale: 0.96 }}
            className="rounded-xl p-3 text-left shadow bg-[var(--app-secondary)] border border-white/5"
            style={{ borderColor: `${ACCENT.green}44` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight size={16} color={ACCENT.green} />
              <p className="text-sm font-semibold">Дохід</p>
            </div>
            <p className="text-xs text-[var(--app-hint)]">Додати вручну</p>
          </motion.div>
        </Link>
      </div>

      {monoConnected && (
        <button
          type="button"
          onClick={syncMono}
          disabled={syncing}
          className="w-full mb-4 py-2.5 rounded-xl bg-[var(--app-secondary)] border border-white/10 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Синхронізація..." : "Синхронізувати Monobank"}
        </button>
      )}

      {/* Recent transactions */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">Останні операції</h2>
        <Link to="/history" className="text-sm text-[var(--app-button)]">
          Усі →
        </Link>
      </div>
      <ul className="space-y-1.5">
        {tx.map((x) => {
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
                  {x.description || x.category || "—"}
                </p>
                <p className="text-xs text-[var(--app-hint)] truncate">
                  {x.source === "monobank" ? "💳" : "💵"} {x.category} · {formatTime(x.date)}
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
                {usdRate ? (
                  <p className="text-[10px] text-[var(--app-hint)]">
                    {formatUsdApprox(x.amount, usdRate)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
        {tx.length === 0 && (
          <li className="text-center text-sm text-[var(--app-hint)] py-8">
            Немає операцій за цей період
          </li>
        )}
      </ul>
    </div>
  );
}
