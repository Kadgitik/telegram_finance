import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Settings, HandCoins } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import MonthSwitcher from "../components/MonthSwitcher";
import { getCategoryConfig } from "../utils/constants";
import TransactionDetailsModal from "../components/TransactionDetailsModal";
import { useCustomCategories } from "../context/CustomCategoriesContext";

export default function HomePage() {
  const nav = useNavigate();
  const { initData, ready, tg } = useTelegram();
  const h = useHaptic();
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [editingTx, setEditingTx] = useState(null);
  const [err, setErr] = useState("");
  const [month, setStoredMonth] = useStoredMonth();
  const [customCategories] = useCustomCategories();
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    setErr("");
    
    // Stale-While-Revalidate Cache Setup
    const cacheKey = `homeCache_${month}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setBalance(parsed?.balance || null);
        setTx(parsed?.transactions?.items || []);
      } catch (e) {
        // ignore cache err
      }
    } else {
      setBalance(null);
      setTx([]);
    }

    try {
      const boot = await api.get(`/bootstrap?month=${month}`, initData);
      localStorage.setItem(cacheKey, JSON.stringify(boot));
      if (boot?.balance) setBalance(boot.balance);
      if (boot?.transactions) setTx(boot.transactions.items || []);
    } catch (e) {
      setErr(String(e.message));
    }
  };

  useEffect(() => {
    if (ready && initData) {
      load();
      // Фонове опитування кожні 12 секунд для "Прямого Ефіру"
      const interval = setInterval(() => load(), 12000);
      
      // Оновити при поверненні у вкладку/додаток
      const onFocus = () => load();
      window.addEventListener("focus", onFocus);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", onFocus);
      };
    }
  }, [ready, initData, month]);

  const balanceValue = balance ? formatMoney(balance.balance).replace(" ₴", "") : "0";
  const incomeValue = balance ? formatMoney(balance.income).replace(" ₴", "") : "0";
  const expenseValue = balance ? formatMoney(balance.expense).replace(" ₴", "") : "0";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-x-hidden">
      {/* ── Gradient hero ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none"
        style={{
          background: "linear-gradient(180deg, #7C3AED 0%, #5B21B6 30%, #000000 100%)",
        }}
      />

      {/* Content on gradient */}
      <div className="relative z-10 px-5 pb-6">
          {/* Header row: Title + Settings */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between pt-4 pb-5"
          >
            <h1 className="text-lg font-bold text-white/90">Finance</h1>
            <button
              onClick={() => nav("/settings")}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-colors"
            >
              <Settings size={18} className="text-white/80" />
            </button>
          </motion.div>

          {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

          {/* Month Switcher */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="mb-6"
          >
            <MonthSwitcher month={month} onChange={setStoredMonth} periodLabel="" compact />
          </motion.div>

          {/* Balance */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
            className="text-center mb-2"
          >
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Баланс</p>
            <div className="flex items-baseline justify-center gap-2">
              <h2 className="text-[48px] font-extrabold tracking-tighter leading-none">
                {balanceValue}
              </h2>
              <span className="text-xl font-medium text-white/35">₴</span>
            </div>
            {usdRate ? (
              <p className="text-[#A3E635] text-sm font-medium mt-1.5">
                {formatUsdApprox(balance?.balance || 0, usdRate)}
              </p>
            ) : null}
          </motion.div>
        </div>

      {/* ── Cards section ── */}
      <div className="px-5 -mt-0">
        <div className="flex gap-3 mb-0 relative z-10">
          <Link to="/history?filter=income" onClick={() => h.light()} className="flex-1 block">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl p-4 border border-[#8B5CF6]/25 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
                  <ArrowUpRight size={16} className="text-[#A78BFA]" />
                </div>
                <p className="text-sm font-semibold text-[#C4B5FD]">Доходи</p>
              </div>
              <p className="text-xl font-bold tracking-tight text-white/95">
                {incomeValue} <span className="text-sm font-normal text-white/30">₴</span>
              </p>
            </motion.div>
          </Link>

          <Link to="/history?filter=expense" onClick={() => h.light()} className="flex-1 block">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl p-4 border border-[#EC4899]/25 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 100%)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#EC4899]/20 flex items-center justify-center">
                  <ArrowDownLeft size={16} className="text-[#F472B6]" />
                </div>
                <p className="text-sm font-semibold text-[#FBCFE8]">Витрати</p>
              </div>
              <p className="text-xl font-bold tracking-tight text-white/95">
                {expenseValue} <span className="text-sm font-normal text-white/30">₴</span>
              </p>
            </motion.div>
          </Link>
        </div>
        
        <div className="mt-3">
          <Link to="/debts" onClick={() => h.light()} className="block">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl p-3 border border-[#6366f1]/25 flex items-center justify-between overflow-hidden relative"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)",
              }}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                  <HandCoins size={16} className="text-[#818cf8]" />
                </div>
                <div>
                   <p className="text-[14px] font-semibold text-[#c7d2fe] leading-tight">Борги та Позички</p>
                   <p className="text-[11px] font-medium text-white/40 leading-none mt-1">Хто винен мені / Кому винен я</p>
                </div>
              </div>
            </motion.div>
          </Link>
        </div>

      </div>

      {/* ── Recent Transactions (bottom sheet) ── */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 25 }}
        className="flex-1 bg-[#141416] rounded-t-3xl mt-4 pt-4 px-5 pb-24 relative"
      >
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />

        <div className="flex justify-between items-center mb-4 px-0.5">
          <h3 className="text-base font-bold text-white/90">Останні операції</h3>
          <Link
            to="/history"
            className="text-xs font-semibold text-[#A78BFA] active:opacity-70 transition-opacity"
          >
            Всі →
          </Link>
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.06, delayChildren: 0.4 },
            },
          }}
          className="space-y-2.5"
        >
          {tx.map((x) => {
            const cat = getCategoryConfig(x.category, customCategories);
            const Icon = cat.icon;
            return (
              <div key={x.id} className="block cursor-pointer" onClick={() => { h.light(); setEditingTx(x); }}>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 300, damping: 24 },
                    },
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3.5 bg-[#1e1e22] p-3.5 rounded-2xl active:bg-[#2a2a30] transition-colors"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}18` }}
                  >
                    <Icon size={20} color={cat.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate text-white/90 mb-0.5">
                      {x.description || x.category || "—"}
                    </p>
                    <p className="text-[11px] font-medium text-white/35 truncate">
                      {x.source === "monobank" ? "💳" : "💵"} {x.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-semibold tabular-nums text-[15px] tracking-tight ${
                        x.type === "income" ? "text-[#A78BFA]" : "text-white/85"
                      }`}
                    >
                      {x.type === "income" ? "+" : "-"}
                      {formatMoney(x.amount).replace(" ₴", "")}
                    </p>
                    {usdRate ? (
                      <p className="text-[11px] font-medium text-white/35 mt-0.5">
                        {formatUsdApprox(x.amount, usdRate)}
                      </p>
                    ) : null}
                  </div>
                </motion.div>
              </div>
            );
          })}
          {tx.length === 0 && (
            <motion.p
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
              className="text-center text-sm font-medium text-white/35 py-10"
            >
              Немає операцій за цей місяць
            </motion.p>
          )}
        </motion.div>
      </motion.div>

      <TransactionDetailsModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
        onUpdated={(updated) => {
          setTx((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          if (editingTx && editingTx.id === updated.id) {
            setEditingTx(updated);
          }
        }}
        onDeleted={(id) => {
          setTx((prev) => prev.filter((t) => t.id !== id));
        }}
      />
    </div>
  );
}
