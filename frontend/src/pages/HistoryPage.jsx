import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import TransactionDetailsModal from "../components/TransactionDetailsModal";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatDayLabel, formatMoney, formatTime } from "../utils/formatters";
import { getCategoryConfig } from "../utils/constants";
import { useCustomCategories } from "../context/CustomCategoriesContext";

export default function HistoryPage() {
  const { initData } = useTelegram();
  const h = useHaptic();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [month, setStoredMonth] = useStoredMonth();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [offset, setOffset] = useState(0);
  const [editingTx, setEditingTx] = useState(null);
  const [customCategories] = useCustomCategories();
  const LIMIT = 30;

  const load = async (reset = false) => {
    if (!initData) return;
    const off = reset ? 0 : offset;
    const params = new URLSearchParams({
      month,
      offset: String(off),
      limit: String(LIMIT),
    });
    if (filter !== "all") params.set("type", filter);
    if (search.trim()) params.set("search", search.trim());

    const r = await api.get(`/transactions?${params}`, initData);
    if (reset) {
      localStorage.setItem(`historyCache_${month}_${filter}_${search}`, JSON.stringify(r.items || []));
      localStorage.setItem(`historyTotal_${month}_${filter}_${search}`, r.total || 0);
      setItems(r.items || []);
      setOffset(LIMIT);
    } else {
      setItems((prev) => [...prev, ...(r.items || [])]);
      setOffset(off + LIMIT);
    }
    setTotal(r.total || 0);
  };

  useEffect(() => {
    if (!initData) return;
    
    // SWR Cache Setup
    const cacheKeyItems = `historyCache_${month}_${filter}_${search}`;
    const cacheKeyTotal = `historyTotal_${month}_${filter}_${search}`;
    const cachedItems = localStorage.getItem(cacheKeyItems);
    const cachedTotal = localStorage.getItem(cacheKeyTotal);
    if (cachedItems) {
      try {
        setItems(JSON.parse(cachedItems));
        setTotal(cachedTotal ? parseInt(cachedTotal, 10) : 0);
      } catch (e) {}
    } else {
      setItems([]);
      setTotal(0);
    }

    load(true).catch(() => {});
  }, [initData, month, filter, search]);

    // We shouldn't need handleDelete here anymore since it's inside the modal, 
    // but if we do, it's passed as a prop below.

  const grouped = {};
  for (const tx of items) {
    const day = tx.date?.slice(0, 10) || "unknown";
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(tx);
  }
  const days = Object.keys(grouped).sort().reverse();

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans overflow-x-hidden pb-24">
      {/* TOP GRADIENT BG */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none"
        style={{ background: "linear-gradient(180deg, #1d4ed8 0%, #3b82f6 30%, #000000 100%)" }}
      />
      
      <div className="relative z-10 px-4 pt-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3 text-white">
          <h1 className="text-2xl font-bold tracking-tight">Історія</h1>
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md active:bg-white/20 transition-colors"
          >
            <Search size={18} className="text-white/90" />
          </button>
        </div>

      {showSearch && (
        <input
          className="w-full rounded-xl px-3 py-2.5 mb-3 bg-[var(--app-secondary)] border border-white/10 placeholder:text-[var(--app-hint)] text-sm"
          placeholder="Пошук..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      )}

      <MonthSwitcher month={month} onChange={setStoredMonth} />

      <div className="flex gap-2 mb-4 mt-3">
        {[
          ["all", "Усі"],
          ["expense", "Витрати"],
          ["income", "Доходи"],
        ].map(([k, lab]) => (
          <button
            type="button"
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors border ${
              filter === k
                ? "bg-white text-black border-white"
                : "bg-white/5 border-white/10 text-white/70"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>

      <p className="text-[13px] text-white/50 mb-3 font-medium">{total} операцій</p>

      <motion.div 
        initial="hidden" animate="show" 
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      >
        {days.map((day) => (
          <div key={day} className="mb-5">
            <p className="text-[12px] text-white/50 mb-2 font-semibold uppercase tracking-wider">{formatDayLabel(day)}</p>
            <ul className="space-y-2">
              {grouped[day].map((x) => {
                const cat = getCategoryConfig(x.category, customCategories);
                const Icon = cat.icon;
                return (
                  <motion.li
                    variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                    key={x.id}
                    onClick={() => { h.light(); setEditingTx(x); }}
                    className="flex items-center gap-4 bg-[#1C1C1E]/80 backdrop-blur-xl p-4 rounded-[24px] border border-white/5 shadow-sm active:bg-[#2C2C2E] cursor-pointer"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}25` }}
                    >
                      <Icon size={22} color={cat.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[16px] truncate text-white/95 mb-0.5">
                        {x.description || x.category}
                      </p>
                      <p className="text-[12px] font-medium text-white/40 truncate">
                        {x.source === "monobank" ? "💳" : "💵"} {x.category} · {formatTime(x.date)}
                      </p>
                    </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-semibold tabular-nums text-[16px] tracking-tight ${
                        x.type === "income" ? "text-[var(--app-button)]" : "text-white/90"
                      }`}
                    >
                      {x.type === "income" ? "+" : "-"}{formatMoney(x.amount).replace(" ₴", "")}
                    </p>
                  </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </motion.div>

      {items.length < total && (
        <button
          type="button"
          onClick={() => load(false)}
          className="w-full py-3.5 mt-2 rounded-[20px] bg-white/5 border border-white/10 text-sm font-semibold text-white/70 active:bg-white/10"
        >
          Завантажити ще
        </button>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm font-medium text-white/40 py-12">
          Немає операцій
        </p>
      )}
      </div>

      <TransactionDetailsModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
        onUpdated={(updated) => {
          setItems((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
          if (editingTx && editingTx.id === updated.id) {
            setEditingTx(updated);
          }
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((x) => x.id !== id));
          setTotal((t) => t - 1);
        }}
      />
    </div>
  );
}
