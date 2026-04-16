import { AnimatePresence, motion } from "framer-motion";
import { PiggyBank, Plus, Target, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney } from "../utils/formatters";

export default function SavingsPage() {
  const { initData } = useTelegram();
  const h = useHaptic();

  // Free savings state
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [monoSavings, setMonoSavings] = useState([]);
  const [showAddSaving, setShowAddSaving] = useState(false);
  const [savingAction, setSavingAction] = useState("deposit");
  const [savingAmount, setSavingAmount] = useState("");
  const [savingCurrency, setSavingCurrency] = useState("UAH");
  const [savingComment, setSavingComment] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);
  const usdRate = useFxRate();

  // Goals state
  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const [activeGoal, setActiveGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Active tab: 'savings' or 'goals'
  const [tab, setTab] = useState("savings");

  const load = async () => {
    if (!initData) return;
    
    const cacheG = localStorage.getItem("goalsCache");
    const cacheS = localStorage.getItem("savingsCache");
    if (goals.length === 0 && cacheG) {
      try { setGoals(JSON.parse(cacheG)); } catch(e) {}
    }
    if (savingsHistory.length === 0 && cacheS) {
      try {
        const cached = JSON.parse(cacheS);
        setSavingsTotal(cached.total || 0);
        setSavingsHistory(cached.history || []);
        setMonoSavings(cached.mono_savings || []);
      } catch(e) {}
    }

    try {
      const [rG, rS] = await Promise.all([
        api.get("/goals", initData),
        api.get("/savings", initData)
      ]);
      setGoals(rG.items || []);
      setSavingsTotal(rS.total || 0);
      setSavingsHistory(rS.history || []);
      setMonoSavings(rS.mono_savings || []);
      localStorage.setItem("goalsCache", JSON.stringify(rG.items || []));
      localStorage.setItem("savingsCache", JSON.stringify(rS));
    } catch(e) {}
  };

  useEffect(() => {
    load();
  }, [initData]);

  // Free savings handlers
  const handleAddSaving = async () => {
    let val = parseFloat(savingAmount);
    if (!initData || !val || val === 0) return;
    
    if (savingAction === "withdraw") {
      val = -Math.abs(val);
    } else {
      val = Math.abs(val);
    }
    
    let originalAmount = undefined;
    let originalCurrency = undefined;
    if (savingCurrency === "USD") {
      originalAmount = val;
      originalCurrency = "USD";
      val = val * usdRate;
    }
    
    setAddingSaving(true);
    h.light();
    try {
      await api.post("/savings", initData, { 
         amount: val, 
         comment: savingComment,
         original_amount: originalAmount,
         original_currency: originalCurrency
      });
      h.success();
      setSavingAmount("");
      setSavingComment("");
      setShowAddSaving(false);
      await load();
    } catch {
      h.error();
    } finally {
      setAddingSaving(false);
    }
  };

  const handleDeleteSaving = async (id) => {
    if (!initData) return;
    h.light();
    try {
      await api.delete(`/savings/${id}`, initData);
      h.success();
      setSavingsHistory((prev) => prev.filter(s => s.id !== id));
      await load();
    } catch {
      h.error();
    }
  };

  // Goal handlers
  const handleCreateGoal = async () => {
    const val = parseFloat(goalTarget);
    if (!initData || !val || val <= 0 || !goalName) return;
    setSavingGoal(true);
    h.light();
    try {
      await api.post("/goals", initData, { name: goalName, target_amount: val });
      h.success();
      setGoalName("");
      setGoalTarget("");
      setShowAddGoal(false);
      await load();
    } catch {
      h.error();
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!initData) return;
    h.light();
    try {
      await api.delete(`/goals/${id}`, initData);
      h.success();
      setGoals((prev) => prev.filter(g => g.id !== id));
    } catch {
      h.error();
    }
  };

  const handleDeposit = async (action = "deposit") => {
    let val = parseFloat(depositAmount);
    if (!initData || !val || val === 0 || !activeGoal) return;
    
    if (action === "withdraw") {
      val = -Math.abs(val);
    } else {
      val = Math.abs(val);
    }
    
    setDepositing(true);
    h.light();
    try {
      await api.post(`/goals/${activeGoal.id}/deposit`, initData, { amount: val });
      h.success();
      setDepositAmount("");
      setActiveGoal(null);
      await load();
    } catch {
      h.error();
    } finally {
      setDepositing(false);
    }
  };

  const totalGoalsProgress = goals.reduce((acc, g) => acc + g.current_amount, 0);
  const grandTotal = savingsTotal + totalGoalsProgress;

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans overflow-x-hidden pb-24">
      {/* TOP GRADIENT BG */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 1.5 }}
        className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none"
        style={{ background: "linear-gradient(180deg, #059669 0%, #10b981 30%, #000000 100%)" }}
      />

      <div className="relative z-10 px-5 pt-8 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Накопичення</h1>

        {/* Grand Total card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="rounded-[32px] p-6 bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 shadow-[0_10px_30px_rgba(16,185,129,0.15)] relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 blur-2xl">
             <PiggyBank size={120} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={20} className="text-[#34d399]" />
            <p className="text-[15px] font-medium text-white/50">Всього накопичено</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight">{formatMoney(grandTotal).replace(" ₴", "")} <span className="text-2xl text-white/50">₴</span></p>
          
          <div className="flex gap-4 mt-4">
            <div className="flex-1 rounded-[16px] bg-white/5 p-3">
              <p className="text-[11px] text-white/40 font-medium mb-1">Вільні</p>
              <p className="text-[16px] font-bold tracking-tight text-[#34d399]">{formatMoney(savingsTotal).replace(" ₴", "")} ₴</p>
            </div>
            <div className="flex-1 rounded-[16px] bg-white/5 p-3">
              <p className="text-[11px] text-white/40 font-medium mb-1">У цілях</p>
              <p className="text-[16px] font-bold tracking-tight text-[#10b981]">{formatMoney(totalGoalsProgress).replace(" ₴", "")} ₴</p>
            </div>
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <div className="flex rounded-[16px] overflow-hidden bg-[#1C1C1E] p-1 gap-1">
          <button 
            onClick={() => setTab("savings")}
            className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "savings" 
                ? "bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30" 
                : "text-white/40 border border-transparent"
            }`}
          >
            <Wallet size={16} /> Вільні
          </button>
          <button 
            onClick={() => setTab("goals")}
            className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "goals" 
                ? "bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30" 
                : "text-white/40 border border-transparent"
            }`}
          >
            <Target size={16} /> Цілі ({goals.length})
          </button>
        </div>

        {/* === FREE SAVINGS TAB === */}
        {tab === "savings" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-white/80 flex items-center gap-2">
                <Wallet size={18} className="text-[#34d399]"/> Вільні накопичення
              </p>
              <button 
                onClick={() => setShowAddSaving(!showAddSaving)}
                className="text-[#10b981] text-sm font-semibold flex items-center gap-1 active:opacity-70"
              >
                <Plus size={16}/> Додати
              </button>
            </div>

            <AnimatePresence>
              {showAddSaving && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-[24px] bg-[#1C1C1E] p-5 space-y-3 border border-[#10b981]/20">
                    <div className="flex bg-black/40 rounded-[14px] p-1 border border-white/5">
                       <button
                         onClick={() => setSavingAction("deposit")}
                         className={`flex-1 py-1.5 rounded-[10px] text-[13px] font-bold transition-colors ${
                           savingAction === "deposit" ? "bg-[#10b981] text-white shadow" : "text-white/40 active:bg-white/5"
                         }`}
                       >
                         Поповнити
                       </button>
                       <button
                         onClick={() => setSavingAction("withdraw")}
                         className={`flex-1 py-1.5 rounded-[10px] text-[13px] font-bold transition-colors ${
                           savingAction === "withdraw" ? "bg-red-500 text-white shadow" : "text-white/40 active:bg-white/5"
                         }`}
                       >
                         Зняти
                       </button>
                    </div>
                    <div className="flex bg-black/40 rounded-[14px] p-1 border border-white/5">
                       <button
                         onClick={() => setSavingCurrency("UAH")}
                         className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-colors ${
                           savingCurrency === "UAH" ? "bg-[#10b981] text-white shadow" : "text-white/40 active:bg-white/5"
                         }`}
                       >
                         UAH
                       </button>
                       <button
                         onClick={() => setSavingCurrency("USD")}
                         className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-colors ${
                           savingCurrency === "USD" ? "bg-[#10b981] text-white shadow" : "text-white/40 active:bg-white/5"
                         }`}
                       >
                         USD
                       </button>
                    </div>
                    <input
                      type="number"
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Сума (наприклад: 1000)"
                      value={savingAmount}
                      onChange={(e) => setSavingAmount(e.target.value)}
                      autoFocus
                    />
                    <input
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Коментар (необов'язково)"
                      value={savingComment}
                      onChange={(e) => setSavingComment(e.target.value)}
                    />
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowAddSaving(false)}
                        className="flex-1 py-3 rounded-[16px] bg-white/5 text-sm font-medium active:bg-white/10"
                      >
                        Скасувати
                      </button>
                      <button
                        onClick={handleAddSaving}
                        disabled={addingSaving || !savingAmount}
                        className={`flex-1 py-3 rounded-[16px] text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform ${savingAction === "withdraw" ? "bg-red-500" : "bg-[#10b981]"}`}
                      >
                        {addingSaving ? "Оновлення..." : (savingAction === "withdraw" ? "Зняти" : "Зберегти")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mono Savings */}
            {monoSavings && monoSavings.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-[12px] font-semibold text-white/40 uppercase tracking-widest pl-2 mb-2 pt-2">З Банки Monobank</p>
                {monoSavings.map(s => (
                  <div key={s.id} className="flex items-center gap-4 bg-[#1C1C1E]/60 backdrop-blur-md border border-[#10b981]/30 p-4 rounded-[20px]">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0">
                      <span>🏦</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] text-white/90 truncate">{s.name}</p>
                      <p className="text-[11px] text-[#34d399] mt-0.5 font-medium">Банка (немає цілі)</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-[16px] text-white drop-shadow-md">{formatMoney(s.amount).replace(" ₴", "")} ₴</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Savings History */}
            <div className="space-y-2">
              {savingsHistory.map((s, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  key={s.id}
                  className="flex items-center gap-4 bg-[#1C1C1E]/60 backdrop-blur-md border border-white/5 p-4 rounded-[20px]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#10b981]/15 flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-[#34d399]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] ${s.amount < 0 ? "text-red-400" : "text-white/90"}`}>
                      {s.amount > 0 ? "+" : ""}{formatMoney(s.amount).replace(" ₴", "")} ₴
                    </p>
                    {s.original_currency === "USD" && s.original_amount && (
                      <p className={`text-[12px] font-medium mb-0.5 ${s.original_amount < 0 ? "text-red-400/70" : "text-white/50"}`}>
                        {s.original_amount > 0 ? "+" : ""}{formatMoney(s.original_amount, "USD")}
                      </p>
                    )}
                    {s.comment && (
                      <p className="text-[12px] text-white/40 truncate">{s.comment}</p>
                    )}
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDeleteSaving(s.id)}
                    className="p-2 rounded-full hover:bg-red-500/10 active:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
              
              {savingsHistory.length === 0 && monoSavings.length === 0 && (
                <p className="text-center text-[13px] text-white/30 py-8 font-medium">
                  Поки немає вільних накопичень. Натисніть «Додати» щоб відкласти гроші.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* === GOALS TAB === */}
        {tab === "goals" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-white/80 flex items-center gap-2">
                <Target size={18} className="text-[#10b981]"/> Мої Цілі
              </p>
              <button 
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="text-[#10b981] text-sm font-semibold flex items-center gap-1 active:opacity-70"
              >
                <Plus size={16}/> Створити
              </button>
            </div>

            <AnimatePresence>
              {showAddGoal && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-[24px] bg-[#1C1C1E] p-5 space-y-3 border border-[#10b981]/20">
                    <input
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Назва (наприклад: На машину)"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                    />
                    <input
                      type="number"
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Мета (наприклад: 50000)"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                    />
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowAddGoal(false)}
                        className="flex-1 py-3 rounded-[16px] bg-white/5 text-sm font-medium active:bg-white/10"
                      >
                        Скасувати
                      </button>
                      <button
                        onClick={handleCreateGoal}
                        disabled={savingGoal || !goalName || !goalTarget}
                        className="flex-1 py-3 rounded-[16px] bg-[#10b981] text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
                      >
                        {savingGoal ? "Створення..." : "Зберегти"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {goals.map((g, i) => {
                const progressPct = Math.min(100, Math.max(0, (g.current_amount / g.target_amount) * 100));
                const isAdding = activeGoal?.id === g.id;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    key={g.id}
                    className="rounded-[28px] bg-[#1C1C1E]/60 backdrop-blur-md border border-white/5 p-5 shadow-lg relative overflow-hidden"
                  >
                    {/* Progress background bar */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-[#10b981]/5 transition-all duration-1000 -z-10"
                      style={{ width: `${progressPct}%` }}
                    />
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-[17px] font-bold text-white/95 tracking-tight flex items-center gap-2">
                           {g.name} {g.is_mono && <span className="text-[10px] uppercase font-bold tracking-widest text-black bg-[#10b981] px-2 py-0.5 rounded-full">Mono</span>}
                        </h3>
                        <p className="text-[12px] text-white/40 mt-1 font-medium">{formatMoney(g.current_amount)} ₴ із {formatMoney(g.target_amount)} ₴</p>
                      </div>
                      {!g.is_mono && (
                        <button 
                          onClick={() => handleDeleteGoal(g.id)}
                          className="p-2 -mr-2 rounded-full hover:bg-red-500/10 active:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="h-2 w-full bg-black/40 rounded-full mb-2 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1, type: "spring" }}
                        className="h-full bg-gradient-to-r from-[#059669] to-[#34d399] rounded-full"
                      />
                    </div>
                    <p className="text-[11px] text-white/30 font-medium mb-4">{Math.round(progressPct)}% від цілі</p>

                    <AnimatePresence mode="wait">
                      {!g.is_mono && !isAdding && (
                        <motion.button 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          onClick={() => setActiveGoal(g)}
                          className="w-full py-3 rounded-[16px] bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-sm font-semibold flex items-center justify-center gap-1.5 text-[#34d399]"
                        >
                          <Plus size={16}/> Поповнити / Зняти
                        </motion.button>
                      )}
                      {!g.is_mono && isAdding && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex gap-2"
                        >
                           <input
                             type="number"
                             className="flex-1 rounded-[16px] px-3 py-2 bg-black/40 border border-[#10b981]/30 text-[14px] outline-none"
                             placeholder="Сума поповнення"
                             value={depositAmount}
                             onChange={(e) => setDepositAmount(e.target.value)}
                             autoFocus
                           />
                           <button 
                             onClick={() => handleDeposit("deposit")}
                             disabled={depositing || !depositAmount}
                             className="px-4 rounded-[16px] bg-[#10b981] text-white font-semibold disabled:opacity-50 active:scale-95 flex items-center justify-center min-w-[50px]"
                           >
                             {depositing ? "..." : <Plus size={20}/>}
                           </button>
                           <button 
                             onClick={() => handleDeposit("withdraw")}
                             disabled={depositing || !depositAmount}
                             className="px-4 rounded-[16px] bg-red-500/80 text-white font-semibold disabled:opacity-50 active:scale-95 flex items-center justify-center min-w-[50px]"
                           >
                             {depositing ? "..." : <span className="text-2xl leading-none select-none pb-1">−</span>}
                           </button>
                           <button 
                             onClick={() => {setActiveGoal(null); setDepositAmount("");}}
                             className="px-3 rounded-[16px] bg-white/10"
                           >
                             ✕
                           </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </motion.div>
                );
              })}
              
              {goals.length === 0 && (
                <p className="text-center text-[13px] text-white/30 py-8 font-medium">У вас поки немає цілей. Натисніть «Створити» щоб додати ціль.</p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
