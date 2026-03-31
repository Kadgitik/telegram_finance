import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../utils/month";
import { formatMoney, formatTime } from "../utils/formatters";
import { ACCENT } from "../utils/constants";

export default function HomePage() {
  const { initData, user, ready } = useTelegram();
  const h = useHaptic();
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [err, setErr] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [payDay, setPayDay] = useState(1);

  const load = async () => {
    if (!initData) return;
    setErr("");
    try {
      const [s, b, t] = await Promise.all([
        api.get("/users/settings", initData),
        api.get(`/balance?month=${month}`, initData),
        api.get(`/transactions?limit=5&month=${month}`, initData),
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

  const name = user?.first_name || "друже";

  return (
    <div className="px-4 pt-4 max-w-lg mx-auto">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <p className="text-sm text-[var(--app-hint)]">Привіт,</p>
        <h1 className="text-xl font-bold">
          {name} 👋
        </h1>
      </motion.header>

      {!initData && (
        <p className="text-sm text-orange-400 mb-4">
          Відкрий застосунок через Telegram (кнопка WebApp), щоб авторизуватись.
        </p>
      )}

      {err && <p className="text-red-400 text-sm mb-2">{err}</p>}

      <MonthSwitcher
        month={month}
        onChange={setStoredMonth}
        subtitle={balance?.period_label || `pay day: ${payDay}`}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-6 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${ACCENT.blue}, ${ACCENT.purple})`,
        }}
      >
        <p className="text-sm opacity-90">Баланс</p>
        <p className="text-4xl font-bold my-2">
          {balance ? formatMoney(balance.balance) : "—"}
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

      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          ["➕ Витрата", "/add?type=expense", ACCENT.red],
          ["💰 Дохід", "/add?type=income", ACCENT.green],
          ["📊 Графік", "/stats", ACCENT.blue],
          ["📋 Всі", "/history", ACCENT.purple],
        ].map(([label, to, color]) => (
          <Link key={to} to={to} onClick={() => h.light()}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="rounded-xl p-2 text-center text-xs font-medium shadow bg-[var(--app-secondary)] border border-white/5"
              style={{ borderTopColor: color }}
            >
              {label}
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
