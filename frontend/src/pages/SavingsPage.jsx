import { AnimatePresence, motion } from "framer-motion";
import { PiggyBank, Plus, Minus, Target, Trash2, Wallet, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney, formatUsdApprox } from "../utils/formatters";

export default function SavingsPage() {
  const nav = useNavigate();
  const { initData } = useTelegram();
  const h = useHaptic();

  // Free savings state
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [monoSavings, setMonoSavings] = useState([]);
  const [savingAction, setSavingAction] = useState("none");
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
  const [activeGoalAction, setActiveGoalAction] = useState("deposit");
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
    let val = parseFloat(String(savingAmount).replace(",", "."));
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
      setSavingAction("none");
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
    const val = parseFloat(String(goalTarget).replace(",", "."));
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
    let val = parseFloat(String(depositAmount).replace(",", "."));
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-[#EDEDEF] font-sans pb-32 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50vh] h-[50vh] bg-emerald-500 rounded-full blur-[120px] pointer-events-none opacity-40" />
      <div className="absolute top-[30%] right-[-20%] w-[60vh] h-[60vh] bg-indigo-600 rounded-full blur-[140px] pointer-events-none opacity-30" />
      <div className="absolute bottom-[20%] left-[10%] w-[40vh] h-[40vh] bg-purple-600 rounded-full blur-[100px] pointer-events-none opacity-30" />

      <div className="px-5 pt-6 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center active:bg-white/10 transition-colors shadow-lg"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[32px] font-extrabold tracking-tight text-white leading-none">Накопичення</h1>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="rounded-[32px] p-6 bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/5 shadow-[0_10px_30px_rgba(16,185,129,0.15)] relative overflow-hidden mb-6"
        >
          <div className="absolute -right-4 -top-4 opacity-5 blur-2xl">
             <PiggyBank size={120} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={20} className="text-[#34d399]" />
            <p className="text-[15px] font-medium text-white/50">Всього накопичено</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight">{formatMoney(grandTotal).replace(" ₴", "")} <span className="text-2xl text-white/50">₴</span></p>
          {usdRate ? (
            <p className="text-[#34d399] text-sm font-medium mt-1.5 opacity-80">
              {formatUsdApprox(grandTotal, usdRate)}
            </p>
          ) : null}
          
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

        <div className="flex gap-2 mb-6 p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg">
          <button 
            onClick={() => setTab("savings")}
            className={`flex-1 py-2.5 rounded-[16px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "savings" 
                ? "bg-[#10b981] text-white shadow-lg" 
                : "text-white/40"
            }`}
          >
            <Wallet size={16} /> Вільні
          </button>
          <button 
            onClick={() => setTab("goals")}
            className={`flex-1 py-2.5 rounded-[16px] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "goals" 
                ? "bg-[#10b981] text-white shadow-lg" 
                : "text-white/40"
            }`}
          >
            <Target size={16} /> Цілі ({goals.length})
          </button>
        </div>

        {tab === "savings" && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-white/80 flex items-center gap-2">
                <Wallet size={18} className="text-[#34d399]"/> Вільні накопичення
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSavingAction(savingAction === "withdraw" ? "none" : "withdraw")}
                  className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold flex items-center gap-1 transition-colors ${
                    savingAction === "withdraw" ? "bg-red-500 text-white" : "bg-white/5 text-white/70"
                  }`}
                >
                  <Minus size={14}/> Зняти
                </button>
                <button 
                  onClick={() => setSavingAction(savingAction === "deposit" ? "none" : "deposit")}
                  className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold flex items-center gap-1 transition-colors ${
                    savingAction === "deposit" ? "bg-[#10b981] text-white" : "bg-[#10b981]/20 text-[#34d399]"
                  }`}
                >
                  <Plus size={14}/> Відкласти
                </button>
              </div>
            </div>

            <AnimatePresence>
              {savingAction !== "none" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`rounded-[24px] bg-[#1C1C1E] p-5 space-y-3 mt-3 border ${savingAction === "withdraw" ? "border-red-500/20" : "border-[#10b981]/20"}`}>
                    <div className="flex bg-black/40 rounded-[14px] p-1 border border-white/5">
                       <button
                         onClick={() => setSavingCurrency("UAH")}
                         className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-colors ${
                           savingCurrency === "UAH" ? "bg-[#10b981] text-white shadow" : "text-white/40"
                         }`}
                       >
                         UAH
                       </button>
                       <button
                         onClick={() => setSavingCurrency("USD")}
                         className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-colors ${
                           savingCurrency === "USD" ? "bg-[#10b981] text-white shadow" : "text-white/40"
                         }`}
                       >
                         USD
                       </button>
                    </div>
                    <input
                      type="text" inputMode="decimal"
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Сума (наприклад: 1000)"
                      value={savingAmount}
                      onChange={(e) => setSavingAmount(e.target.value)}
                    />
                    <input
                      className="w-full rounded-[16px] px-4 py-3 bg-black/40 border border-white/5 text-[15px] placeholder:text-white/30 focus:border-[#10b981]/50 outline-none transition-colors"
                      placeholder="Коментар (необов'язково)"
                      value={savingComment}
                      onChange={(e) => setSavingComment(e.target.value)}
                    />
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setSavingAction("none")}
                        className="flex-1 py-3 rounded-[16px] bg-white/5 text-sm font-medium"
                      >
                        Скасувати
                      </button>
                      <button
                        onClick={handleAddSaving}
                        disabled={addingSaving || !savingAmount}
                        className={`flex-1 py-3 rounded-[16px] text-white text-sm font-bold ${savingAction === "withdraw" ? "bg-red-500" : "bg-[#10b981]"}`}
                      >
                        {addingSaving ? "Зачекайте..." : "Виконати"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {monoSavings.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest pl-2 mb-2 pt-2">З Банки Monobank</p>
                {monoSavings.map(s => (
                  <div key={s.id} className="flex items-center gap-4 bg-[#1C1C1E]/60 backdrop-blur-md border border-[#10b981]/30 p-4 rounded-[20px]">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0">
                      <span>🏦</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] text-white/90 truncate">{s.name}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-[16px] text-white">{formatMoney(s.amount).replace(" ₴", "")} ₴</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {savingsHistory.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4 bg-[#1C1C1E]/60 backdrop-blur-md border border-white/5 p-4 rounded-[20px]">
                  <div className="w-10 h-10 rounded-full bg-[#10b981]/15 flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-[#34d399]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] ${s.amount < 0 ? "text-red-400" : "text-white/90"}`}>
                      {s.amount > 0 ? "+" : ""}{formatMoney(s.amount).replace(" ₴", "")} ₴
                    </p>
                    {s.comment && <p className="text-[12px] text-white/40 truncate">{s.comment}</p>}
                  </div>
                  <button onClick={() => handleDeleteSaving(s.id)} className="p-2 text-white/20 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === "goals" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-white/80 flex items-center gap-2">
                <Target size={18} className="text-[#10b981]"/> Мої Цілі
              </p>
              <button onClick={() => setShowAddGoal(!showAddGoal)} className="text-[#10b981] text-sm font-semibold">Створити</button>
            </div>

            <AnimatePresence>
              {showAddGoal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-5">
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-slate-900 border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl">
                    <h2 className="text-xl font-bold mb-5 text-white">Нова ціль</h2>
                    <input value={goalName} onChange={(e) => setGoalName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-[16px] px-4 py-3 mb-4 outline-none" placeholder="Назва цілі" />
                    <input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value.replace(/[^\d.,]/g, ""))} className="w-full bg-black/20 border border-white/10 rounded-[16px] px-4 py-3 mb-6 outline-none" placeholder="Сума (₴)" />
                    <div className="flex gap-3">
                      <button onClick={() => setShowAddGoal(false)} className="flex-1 py-3 bg-white/5 rounded-[16px]">Скасувати</button>
                      <button onClick={handleCreateGoal} className="flex-1 py-3 bg-[#10b981] rounded-[16px] font-bold">Зберегти</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {goals.map((g, i) => {
                const progressPct = Math.min(100, Math.max(0, (g.current_amount / g.target_amount) * 100));
                const isAdding = activeGoal?.id === g.id;
                return (
                  <div key={g.id} className="rounded-[28px] bg-[#1C1C1E]/60 backdrop-blur-md border border-white/5 p-5 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-[17px] font-bold text-white/95">{g.name}</h3>
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
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex gap-2"
                        >
                          <button 
                            onClick={() => { setActiveGoal(g); setActiveGoalAction("withdraw"); }}
                            className="flex-1 py-2.5 rounded-[16px] bg-red-400/10 text-red-400 hover:bg-red-400/20 active:scale-[0.98] transition-all text-sm font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Minus size={16}/> Зняти
                          </button>
                          <button 
                            onClick={() => { setActiveGoal(g); setActiveGoalAction("deposit"); }}
                            className="flex-1 py-2.5 rounded-[16px] bg-[#10b981]/15 text-[#34d399] hover:bg-[#10b981]/25 active:scale-[0.98] transition-all text-sm font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Plus size={16}/> Поповнити
                          </button>
                        </motion.div>
                      )}
                      {!g.is_mono && isAdding && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex gap-2"
                        >
                           <input
                             type="text" inputMode="decimal"
                             className={`flex-1 rounded-[16px] px-3 py-2 bg-black/40 border text-[14px] outline-none transition-colors ${activeGoalAction === "withdraw" ? "border-red-500/30 focus:border-red-500/70" : "border-[#10b981]/30 focus:border-[#10b981]/70"}`}
                             placeholder={activeGoalAction === "withdraw" ? "Сума зняття" : "Сума поповнення"}
                             value={depositAmount}
                             onChange={(e) => setDepositAmount(e.target.value)}
                             autoFocus
                           />
                           <button 
                             onClick={() => handleDeposit(activeGoalAction)}
                             disabled={depositing || !depositAmount}
                             className={`px-4 rounded-[16px] text-white font-semibold disabled:opacity-50 active:scale-95 flex items-center justify-center min-w-[50px] transition-colors ${activeGoalAction === "withdraw" ? "bg-red-500/80" : "bg-[#10b981]"}`}
                           >
                             {depositing ? "..." : (activeGoalAction === "withdraw" ? <Minus size={20}/> : <Plus size={20}/>)}
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
