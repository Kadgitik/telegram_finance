import { AnimatePresence, motion } from "framer-motion";
import { HandCoins, Plus, Trash2, CheckCircle2, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney } from "../utils/formatters";

export default function DebtsPage() {
  const { initData, webApp } = useTelegram();
  const h = useHaptic();

  const [debts, setDebts] = useState([]);
  const [tab, setTab] = useState("owed_to_me"); // 'owed_to_me' or 'i_owe'
  
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [addingDebt, setAddingDebt] = useState(false);
  const [debtContact, setDebtContact] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtCurrency, setDebtCurrency] = useState("UAH");
  const [debtComment, setDebtComment] = useState("");
  const usdRate = useFxRate();

  const load = async () => {
    if (!initData) return;
    
    const cacheD = localStorage.getItem("debtsCache");
    if (debts.length === 0 && cacheD) {
      try { setDebts(JSON.parse(cacheD)); } catch(e) {}
    }

    try {
      const rD = await api.get("/debts", initData);
      setDebts(rD.items || []);
      localStorage.setItem("debtsCache", JSON.stringify(rD.items || []));
    } catch(e) {}
  };

  useEffect(() => {
    load();
  }, [initData]);

  const handleAddDebt = async () => {
    let val = parseFloat(debtAmount);
    if (!initData || !val || val <= 0 || !debtContact) return;
    
    let originalAmount = undefined;
    let originalCurrency = undefined;
    if (debtCurrency === "USD") {
      originalAmount = val;
      originalCurrency = "USD";
      val = val * usdRate;
    }
    
    setAddingDebt(true);
    h.light();
    try {
      await api.post("/debts", initData, { 
        type: tab, 
        contact: debtContact, 
        amount: val, 
        comment: debtComment,
        original_amount: originalAmount,
        original_currency: originalCurrency
      });
      h.success();
      setDebtAmount("");
      setDebtContact("");
      setDebtComment("");
      setShowAddDebt(false);
      await load();
    } catch {
      h.error();
    } finally {
      setAddingDebt(false);
    }
  };

  const handleResolveDebt = async (id) => {
    if (!initData) return;
    h.light();
    try {
      await api.post(`/debts/${id}/resolve`, initData);
      h.success();
      setDebts(prev => prev.map(d => d.id === id ? { ...d, resolved: true } : d));
    } catch {
      h.error();
    }
  };

  const handleDeleteDebt = async (id) => {
    if (!initData) return;
    h.light();
    try {
      await api.delete(`/debts/${id}`, initData);
      h.success();
      setDebts(prev => prev.filter(d => d.id !== id));
    } catch {
      h.error();
    }
  };

  const handleRemind = (debt) => {
    h.light();
    const commentPart = debt.comment ? ` (${debt.comment})` : "";
    const text = `Привіт! Нагадую про борг у розмірі ${debt.amount} грн.${commentPart} Буду вдячний, якщо повернеш найближчим часом!`;
    const shareUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    if (webApp && webApp.openTelegramLink) {
        webApp.openTelegramLink(shareUrl);
    } else {
        window.open(shareUrl, "_blank");
    }
  };

  // Filter lists
  const filteredDebts = debts.filter(d => d.type === tab);
  const activeDebts = filteredDebts.filter(d => !d.resolved);
  const resolvedDebts = filteredDebts.filter(d => d.resolved);

  const totalActive = activeDebts.reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans overflow-x-hidden pb-24">
      {/* TOP GRADIENT BG */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none"
        style={{ background: "linear-gradient(180deg, #4f46e5 0%, #6366f1 30%, #000000 100%)" }}
      />

      <div className="relative z-10 px-5 pt-8 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Борги та Позички</h1>

        {/* Tab Switcher */}
        <div className="flex rounded-[16px] overflow-hidden bg-[#1C1C1E] p-1 gap-1">
          <button 
            onClick={() => { setTab("owed_to_me"); setShowAddDebt(false); }}
            className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "owed_to_me" 
                ? "bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30" 
                : "text-white/40 border border-transparent"
            }`}
          >
            Хто винен мені
          </button>
          <button 
            onClick={() => { setTab("i_owe"); setShowAddDebt(false); }}
            className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "i_owe" 
                ? "bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30" 
                : "text-white/40 border border-transparent"
            }`}
          >
            Кому винен я
          </button>
        </div>

        {/* Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring" }}
          className="rounded-[28px] p-5 bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 shadow-[0_10px_30px_rgba(99,102,241,0.15)] flex justify-between items-center"
        >
          <div>
             <p className="text-[13px] text-white/50 mb-1">{tab === "owed_to_me" ? "Загальна сума, що винні вам:" : "Загальна сума ваших боргів:"}</p>
             <p className="text-2xl font-bold tracking-tight text-white">{formatMoney(totalActive)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
            <HandCoins size={24} className="text-[#818cf8]" />
          </div>
        </motion.div>

        {/* Action Header */}
        <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-white/80">Активні ({activeDebts.length})</p>
            <button 
            onClick={() => setShowAddDebt(!showAddDebt)}
            className="text-[#818cf8] text-sm font-semibold flex items-center gap-1 active:opacity-70"
            >
            <Plus size={16}/> Додати
            </button>
        </div>

        <AnimatePresence>
            {showAddDebt && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
            >
                <div className="rounded-[24px] bg-[#1C1C1E] p-5 space-y-3 border border-[#6366f1]/20 mb-4">
                <input
                    className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#6366f1]/50 outline-none transition-colors"
                    placeholder="Ім'я або контакт (напр. Іван)"
                    value={debtContact}
                    onChange={(e) => setDebtContact(e.target.value)}
                    autoFocus
                />
                <div className="flex bg-black/40 rounded-[16px] border border-white/5 overflow-hidden">
                  <input
                      type="number"
                      className="w-full px-4 py-3 bg-transparent text-[15px] placeholder:text-white/30 focus:border-[#6366f1]/50 outline-none transition-colors"
                      placeholder="Сума боргу (напр. 500)"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(e.target.value)}
                  />
                  <button 
                      onClick={() => setDebtCurrency(debtCurrency === "UAH" ? "USD" : "UAH")}
                      className="px-4 py-3 font-bold text-[#818cf8] bg-white/5 border-l border-white/5 active:bg-white/10 transition-colors"
                  >
                      {debtCurrency === "UAH" ? "₴" : "$"}
                  </button>
                </div>
                <input
                    className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#6366f1]/50 outline-none transition-colors"
                    placeholder="Коментар (необов'язково)"
                    value={debtComment}
                    onChange={(e) => setDebtComment(e.target.value)}
                />
                <div className="flex gap-2 pt-2">
                    <button
                    onClick={() => setShowAddDebt(false)}
                    className="flex-1 py-3 rounded-[16px] bg-white/5 text-sm font-medium active:bg-white/10"
                    >
                    Скасувати
                    </button>
                    <button
                    onClick={handleAddDebt}
                    disabled={addingDebt || !debtContact || !debtAmount}
                    className="flex-1 py-3 rounded-[16px] bg-[#6366f1] text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
                    >
                    {addingDebt ? "Додавання..." : "Зберегти"}
                    </button>
                </div>
                </div>
            </motion.div>
            )}
        </AnimatePresence>

        {/* Active List */}
        <div className="space-y-3">
            {activeDebts.map((d, i) => (
            <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                key={d.id}
                className="bg-[#1C1C1E]/60 backdrop-blur-md border border-white/5 p-4 rounded-[20px] relative overflow-hidden"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="font-bold text-[16px] text-white tracking-tight">{d.contact}</p>
                        <p className="text-[13px] text-white/40">{new Date(d.created_at).toLocaleDateString("uk-UA")}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-[17px] text-[#818cf8]">{formatMoney(d.amount)}</p>
                    </div>
                </div>
                {d.comment && <p className="text-[13px] text-white/60 mb-3">{d.comment}</p>}
                
                {d.original_currency === "USD" && d.original_amount && (
                    <p className="text-[12px] text-white/40 font-medium mb-2 opacity-80">
                         {formatMoney(d.original_amount, "USD")}
                    </p>
                )}
                
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <button 
                        onClick={() => handleResolveDebt(d.id)}
                        className="flex-1 py-2 rounded-[12px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 text-sm font-semibold flex justify-center items-center gap-1 active:scale-95 transition-transform"
                    >
                        <CheckCircle2 size={16} /> Повернуто
                    </button>
                    {tab === "owed_to_me" && (
                        <button 
                            onClick={() => handleRemind(d)}
                            className="w-10 h-10 rounded-[12px] bg-[#3b82f6]/10 text-[#60a5fa] border border-[#3b82f6]/20 flex justify-center items-center active:scale-95 transition-transform"
                        >
                            <Share size={16} />
                        </button>
                    )}
                    <button 
                        onClick={() => handleDeleteDebt(d.id)}
                        className="w-10 h-10 rounded-[12px] bg-red-500/10 text-red-400 border border-red-500/20 flex justify-center items-center active:scale-95 transition-transform"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </motion.div>
            ))}
            
            {activeDebts.length === 0 && !showAddDebt && (
            <p className="text-center text-[13px] text-white/30 py-6 font-medium">Активних записів немає.</p>
            )}
        </div>

        {/* Resolved List */}
        {resolvedDebts.length > 0 && (
            <>
            <p className="text-[15px] font-semibold text-white/40 mt-8">Історія (Повернуто)</p>
            <div className="space-y-3 opacity-60">
                {resolvedDebts.map((d, i) => (
                <div 
                    key={d.id}
                    className="flex justify-between items-center bg-[#1C1C1E]/30 p-3 rounded-[16px] border border-white/5"
                >
                    <div>
                        <p className="font-semibold text-white/80 line-through text-[14px]">{d.contact}</p>
                        <p className="text-[11px] text-white/30">{new Date(d.created_at).toLocaleDateString("uk-UA")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                           <p className="font-semibold text-white/60 text-[14px]">{formatMoney(d.amount)}</p>
                           {d.original_currency === "USD" && d.original_amount && (
                               <p className="text-[10px] text-white/40">{formatMoney(d.original_amount, "USD")}</p>
                           )}
                        </div>
                        <button onClick={() => handleDeleteDebt(d.id)} className="text-white/20 hover:text-red-400">
                             <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                ))}
            </div>
            </>
        )}

      </div>
    </div>
  );
}
