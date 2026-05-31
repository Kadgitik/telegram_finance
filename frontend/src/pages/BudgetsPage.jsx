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
    setAmounts((prev) => ({ ...prev, [key]: val.replace(/[^\d.]/g, "") }));

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
    <div className="min-h-screen bg-black text-white font-sans pb-36">
      <div className="px-5 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold">Бюджети</h1>
        </div>

        <p className="text-sm text-white/40 mb-5">
          Задай ліміт на категорію. Сума всіх лімітів — твій загальний бюджет на місяць.
        </p>

        <div className="space-y-2.5">
          {expenseKeys.map((key) => {
            const cat = getCategoryConfig(key, customCategories);
            const Icon = cat.icon;
            return (
              <div key={key} className="flex items-center gap-3 bg-[#1C1C1E] p-3 rounded-2xl">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}18` }}
                >
                  <Icon size={18} color={cat.color} />
                </div>
                <span className="flex-1 text-[15px] font-medium text-white/90 truncate">{key}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-24 text-right rounded-xl px-3 py-2 bg-black/40 border border-white/10 text-[15px] focus:border-[#10b981]/60 outline-none"
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
          className="mt-4 w-full py-3 rounded-2xl bg-white/5 text-white/60 font-medium flex items-center justify-center gap-2 active:bg-white/10"
        >
          <Plus size={18} /> Додати категорію
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#121214]/90 backdrop-blur-xl border-t border-white/10 px-5 py-4 safe-pb">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white/50">Загальний бюджет</span>
          <span className="text-lg font-bold">{formatMoney(total)}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-[#10b981] text-white font-bold disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
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
