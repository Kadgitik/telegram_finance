import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";
import { useHaptic } from "../hooks/useHaptic";
import { useCustomCategories } from "../context/CustomCategoriesContext";
import { EXPENSE_CATEGORIES, getCategoryConfig } from "../utils/constants";
import { formatMoney } from "../utils/formatters";
import { invalidateHomeCache } from "../utils/cache";
import AddCategoryModal from "../components/AddCategoryModal";

export default function BudgetsPage() {
  const nav = useNavigate();
  const { initData } = useTelegram();
  const h = useHaptic();
  const [customCategories] = useCustomCategories();
  const [amounts, setAmounts] = useState({}); // { key: "5000" }
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const expenseKeys = useMemo(() => {
    const custom = customCategories.filter((c) => c.type === "expense").map((c) => c.key);
    const defaults = EXPENSE_CATEGORIES.map((c) => c.key);
    return [...new Set([...custom, ...defaults])];
  }, [customCategories]);

  useEffect(() => {
    if (!initData) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get("/budgets", initData);
        if (cancelled) return;
        const next = {};
        for (const [k, v] of Object.entries(r.budgets || {})) next[k] = String(v);
        setAmounts(next);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [initData]);

  const total = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [amounts]
  );

  const setAmount = (key, val) =>
    setAmounts((prev) => ({ ...prev, [key]: val.replace(",", ".").replace(/[^\d.]/g, "") }));

  const handleSave = async () => {
    if (!initData || saving) return;
    setSaving(true);
    h.light();
    const budgets = {};
    for (const [k, v] of Object.entries(amounts)) {
      const n = parseFloat(v);
      if (n > 0) budgets[k] = n;
    }
    try {
      await api.put("/budgets", initData, { budgets });
      invalidateHomeCache();
      h.success();
      nav(-1);
    } catch (e) {
      h.error();
      if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(`Помилка: ${e.message}`);
      else alert(`Помилка: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-[#EDEDEF] font-sans pb-36 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vh] h-[50vh] bg-emerald-500 rounded-full blur-[120px] pointer-events-none opacity-40" />
      <div className="absolute top-[30%] right-[-20%] w-[60vh] h-[60vh] bg-indigo-600 rounded-full blur-[140px] pointer-events-none opacity-30" />
      <div className="absolute bottom-[20%] left-[10%] w-[40vh] h-[40vh] bg-purple-600 rounded-full blur-[100px] pointer-events-none opacity-30" />

      <div className="px-5 pt-6 relative z-10">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center active:bg-white/10 transition-colors shadow-lg"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold">Бюджети</h1>
        </div>

        <p className="text-sm text-white/40 mb-5">
          Задай ліміт на категорію, щоб контролювати витрати. Твій загальний бюджет на місяць завжди дорівнює твоєму Залишку.
        </p>

        <div className="space-y-2.5">
          {expenseKeys.map((key) => {
            const cat = getCategoryConfig(key, customCategories);
            const Icon = cat.icon;
            return (
              <div key={key} className="flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 p-3 rounded-[24px] relative overflow-hidden shadow-lg">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}18` }}
                >
                  <Icon size={18} color={cat.color} />
                </div>
                <span className="flex-1 text-[15px] font-medium text-white/90 truncate">{key}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-24 text-right rounded-[16px] px-3 py-2.5 bg-black/20 border border-white/10 text-[15px] font-semibold focus:border-[#34d399]/70 focus:shadow-[0_0_15px_rgba(52,211,153,0.3)] focus:bg-black/40 outline-none transition-all text-white placeholder-white/30"
                  placeholder="0"
                  value={amounts[key] ?? ""}
                  onChange={(e) => setAmount(key, e.target.value)}
                />
                <span className="text-white/30 text-sm">₴</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { h.light(); setShowAdd(true); }}
          className="mt-5 w-full py-3.5 rounded-[20px] bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 font-medium flex items-center justify-center gap-2 active:bg-white/10 transition-all shadow-lg"
        >
          <Plus size={18} /> Додати категорію
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/50 backdrop-blur-3xl border-t border-white/10 px-5 py-4 safe-pb z-50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-white/70">Сума лімітів</span>
          <span className="text-[22px] font-extrabold tracking-tight text-white">{formatMoney(total).replace(" ₴", "")}<span className="text-sm font-normal text-white/60 ml-1">₴</span></span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-[20px] bg-gradient-to-r from-[#34d399] to-[#059669] text-white font-bold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(52,211,153,0.4)]"
        >
          <Check size={18} /> {saving ? "Збереження..." : "Зберегти"}
        </button>
      </div>

      <AddCategoryModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        type="expense"
        onCreated={() => setShowAdd(false)}
      />
    </div>
  );
}
