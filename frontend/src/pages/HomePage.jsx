import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { formatMoney, formatUsdApprox } from "../utils/formatters";
import { getCategoryConfig } from "../utils/constants";

export default function HomePage() {
  const nav = useNavigate();
  const { initData, ready, tg } = useTelegram();
  const h = useHaptic();
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [err, setErr] = useState("");
  const [month] = useStoredMonth();
  const [monoConnected, setMonoConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const usdRate = useFxRate();

  const tgUser = tg?.initDataUnsafe?.user;

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
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans overflow-x-hidden">
      {/* TOP GRADIENT BG */}
      <div 
        className="absolute top-0 left-0 w-full h-[55vh] opacity-90 pointer-events-none"
        style={{ background: "linear-gradient(180deg, #6D28D9 0%, #4C1D95 40%, #000000 100%)" }}
      />

      <div className="relative z-10 flex-1 flex flex-col pt-4">
        {/* Header */}
        <div className="px-5 flex justify-between items-center mb-6 mt-2">
           <div>
             <p className="text-white/60 text-sm font-medium">Welcome back!</p>
             <h1 className="text-xl font-bold tracking-tight">
               {tgUser?.first_name || "Користувач"}
             </h1>
           </div>
           <button 
             onClick={() => nav("/settings")} 
             className="w-10 h-10 rounded-full bg-white/10 border border-white/5 flex items-center justify-center backdrop-blur-md active:bg-white/20 transition-colors"
           >
             <Settings size={20} className="text-white/80" />
           </button>
        </div>

        {err && <p className="text-red-400 text-sm mb-2 px-5">{err}</p>}

        {/* Balance Area */}
        <div className="px-5 mb-8">
          <div className="flex items-center gap-2 mb-1 text-white/60 text-sm font-medium">
            Your balance
            <span className="text-[10px] bg-white/10 rounded px-1.5 py-0.5 text-white/80 uppercase font-bold tracking-wider">
              {month}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <h2 className="text-5xl font-extrabold tracking-tighter">
              {balance ? formatMoney(balance.balance).replace(" ₴", "") : "0"}
            </h2>
            <span className="text-2xl font-medium text-white/50">₴</span>
          </div>
          {usdRate ? (
             <p className="text-green-400 text-sm font-medium mt-1 flex items-center gap-1">
               ≈ {formatUsdApprox(balance?.balance || 0, usdRate)}
             </p>
          ) : null}
          
          {/* Mono Sync Button */}
          {monoConnected && (
            <button 
              onClick={syncMono} 
              disabled={syncing} 
              className="mt-4 text-xs font-semibold bg-white/10 px-3.5 py-2 rounded-full flex items-center gap-1.5 border border-white/5 backdrop-blur-md text-white/90 active:bg-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin text-purple-400" : "text-purple-400"} />
              {syncing ? "Оновлення..." : "Оновити Monobank"}
            </button>
          )}
        </div>

        {/* Income & Expenses Cards */}
        <div className="px-5 flex gap-3 mb-8 text-left">
          <Link to="/add?type=income" onClick={() => h.light()} className="flex-1 block text-left">
            <motion.div 
              whileTap={{ scale: 0.96 }} 
              className="rounded-[24px] p-4 bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 backdrop-blur-xl relative overflow-hidden"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
                   <ArrowUpRight size={18} className="text-[#A78BFA]" />
                </div>
                <p className="text-[15px] font-semibold text-[#C4B5FD]">Income</p>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white/95 text-left">
                 {balance ? formatMoney(balance.income).replace(" ₴", "") : "0"}
              </p>
            </motion.div>
          </Link>
          
          <Link to="/add?type=expense" onClick={() => h.light()} className="flex-1 block text-left">
            <motion.div 
              whileTap={{ scale: 0.96 }} 
              className="rounded-[24px] p-4 bg-[#EC4899]/15 border border-[#EC4899]/20 backdrop-blur-xl relative overflow-hidden"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#EC4899]/20 flex items-center justify-center">
                   <ArrowDownLeft size={18} className="text-[#F472B6]" />
                </div>
                <p className="text-[15px] font-semibold text-[#FBCFE8]">Expenses</p>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white/95 text-left">
                 {balance ? formatMoney(balance.expense).replace(" ₴", "") : "0"}
              </p>
            </motion.div>
          </Link>
        </div>

        {/* Bottom Sheet - Recent Transactions */}
        <motion.div 
           initial={{ y: 50, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ duration: 0.4, ease: "easeOut" }}
           className="flex-1 bg-[#1C1C1E] rounded-t-[32px] pt-4 px-5 pb-24 shadow-[0_-15px_40px_rgba(0,0,0,0.5)] z-20 relative"
        >
           <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
           
           <div className="flex justify-between items-end mb-5 px-1 bg-transparent border-0 text-left">
             <h3 className="text-[19px] font-bold text-white/90">Recent Transaction</h3>
             <Link to="/history" className="text-[13px] font-semibold text-[#A78BFA] active:opacity-70 transition-opacity">
               See all
             </Link>
           </div>
           
           <div className="space-y-3">
            {tx.map((x) => {
              const cat = getCategoryConfig(x.category);
              const Icon = cat.icon;
              return (
                <Link to="/history" key={x.id} className="block text-left">
                  <div className="flex items-center gap-4 bg-[#2C2C2E] p-4 rounded-[20px] active:bg-[#3A3A3C] transition-colors shadow-sm">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <Icon size={22} color={cat.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[16px] truncate text-white/95 mb-0.5">
                        {x.description || x.category || "—"}
                      </p>
                      <p className="text-[12px] font-medium text-white/40 truncate">
                        {x.source === "monobank" ? "💳" : "💵"} {x.category}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`font-semibold tabular-nums text-[16px] tracking-tight ${
                          x.type === "income" ? "text-[#A78BFA]" : "text-white/90"
                        }`}
                      >
                        {x.type === "income" ? "+" : "-"}{formatMoney(x.amount).replace(" ₴", "")}
                      </p>
                      {usdRate ? (
                        <p className="text-[11px] font-medium text-white/40 mt-0.5">
                          {formatUsdApprox(x.amount, usdRate)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
            {tx.length === 0 && (
              <p className="text-center text-sm font-medium text-white/40 py-8">
                Немає нещодавніх операцій
              </p>
            )}
           </div>
        </motion.div>
      </div>
    </div>
  );
}
