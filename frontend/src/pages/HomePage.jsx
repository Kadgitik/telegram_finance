import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, BarChart3, List } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../utils/month";
import { formatMoney, formatTime, formatUsdApprox } from "../utils/formatters";
import { ACCENT } from "../utils/constants";

export default function HomePage() {
  const { initData, ready } = useTelegram();
  const h = useHaptic();
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [err, setErr] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [payDay, setPayDay] = useState(1);
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    setErr("");
    const settingsPath = "/users/settings";
    const balancePath = `/balance?month=${month}`;
    const txPath = `/transactions?limit=5&month=${month}`;
    const cachedSettings = api.getCached(settingsPath, initData);
    const cachedBalance = api.getCached(balancePath, initData);
    const cachedTx = api.getCached(txPath, initData);
    if (cachedSettings) setPayDay(cachedSettings?.pay_day || 1);
    if (cachedBalance) setBalance(cachedBalance);
    if (cachedTx) setTx(cachedTx.items || []);
    try {
      const [s, b, t] = await Promise.all([
        api.get(settingsPath, initData),
        api.get(balancePath, initData),
        api.get(txPath, initData),
      ]);
      setPayDay(s?.pay_day || 1);
      setBalance(b);
      setTx(t.items || []);
    } catch (e) {
      setErr(String(e.message));
    }
  };

  useEffect(() => {
    if (ready && initData) load();
  }, [ready, initData, month]);

  return (
    <div className="px-4 pt-4 max-w-lg mx-auto">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-2" />

      {!initData && (
        <p className="text-sm text-orange-400 mb-4">
          Відкрий застосунок через Telegram (кнопка WebApp), щоб авторизуватись.
        </p>
      )}

      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}

      <MonthSwitcher
        month={month}
        onChange={setStoredMonth}
        periodLabel={balance?.period_label || ""}
        subtitle={`День зарплати: ${payDay}`}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-6 text-white shadow-lg relative"
        style={{
          background: `linear-gradient(135deg, ${ACCENT.blue}, ${ACCENT.purple})`,
        }}
      >
        {usdRate ? (
          <p className="absolute top-3 right-3 text-[10px] opacity-80">
            1$ = {usdRate.toFixed(2)} ₴
          </p>
        ) : null}
        <p className="text-sm opacity-90">Баланс</p>
        <p className="text-4xl font-bold my-2">
          {balance ? formatMoney(balance.balance) : "—"}
        </p>
        <p className="text-xs opacity-90">
          {balance ? formatUsdApprox(balance.balance, usdRate) : ""}
        </p>
        <div className="flex gap-6 text-sm">
          <span style={{ color: ACCENT.green }}>
            ↑ {balance ? formatMoney(balance.income) : "—"}
          </span>
          <span style={{ color: "#ffcccc" }}>
            ↓ {balance ? formatMoney(balance.expense) : "—"}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          ["Додати витрату", "/add?type=expense", ACCENT.red, ArrowDownLeft, "Записати витрату"],
          ["Додати дохід", "/add?type=income", ACCENT.green, ArrowUpRight, "Записати надходження"],
          ["Статистика", "/stats", ACCENT.blue, BarChart3, "Графіки та аналітика"],
          ["Історія", "/history", ACCENT.purple, List, "Усі операції"],
        ].map(([label, to, color, Icon, sub]) => (
          <Link key={to} to={to} onClick={() => h.light()}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="rounded-xl p-3 text-left shadow bg-[var(--app-secondary)] border border-white/5 min-h-[72px]"
              style={{ borderColor: `${color}66` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} color={color} />
                <p className="text-sm font-semibold">{label}</p>
              </div>
              <p className="text-xs text-[var(--app-hint)]">{sub}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">Останні операції</h2>
        <Link to="/history" className="text-sm text-[var(--app-button)]">
          Усі →
        </Link>
      </div>
      <ul className="space-y-2">
        {tx.map((x) => (
          <li
            key={x.id}
            className="grid grid-cols-[minmax(0,1fr)_110px_52px] items-center rounded-xl px-3 py-2 bg-[var(--app-secondary)] gap-2"
          >
            <span className="truncate min-w-0">
              {x.category || "—"} · {x.comment || " "}
            </span>
            <span
              className={
                `text-right tabular-nums ${
                  x.type === "income" ? "text-green-400" : "text-[var(--app-text)]"
                }`
              }
            >
              {x.type === "income" ? "+" : "-"}
              {formatMoney(x.amount)}
              <span className="block text-[10px] text-[var(--app-hint)]">
                {formatUsdApprox(x.amount, usdRate)}
              </span>
            </span>
            <span className="text-xs text-[var(--app-hint)] text-right tabular-nums w-[52px]">
              {formatTime(x.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
