import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CUSTOM_ICONS_MAP } from "../utils/constants";
import { useCustomCategories } from "../context/CustomCategoriesContext";
import AddCategoryModal from "../components/AddCategoryModal";
import { Plus } from "lucide-react";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

export default function AddPage() {
  const [params] = useSearchParams();
  const initial = params.get("type") === "income" ? "income" : "expense";
  const [kind, setKind] = useState(initial);
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState("UAH");
  const savingRef = useRef(false);
  const [customCategories] = useCustomCategories();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const { initData } = useTelegram();
  const h = useHaptic();
  const nav = useNavigate();
  const usdRate = useFxRate();

  const categories = useMemo(() => {
    const defaultCats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const customCats = customCategories
      .filter((c) => c.type === kind)
      .map((c) => ({
        key: c.key,
        icon: CUSTOM_ICONS_MAP[c.icon] || CUSTOM_ICONS_MAP.Star,
        color: c.color || "#8E8E93",
        isCustom: true,
      }));
    return [...customCats, ...defaultCats];
  }, [kind, customCategories]);

  // Auto-select first category when switching type
  useEffect(() => {
    if (categories.length && !categories.find((c) => c.key === category)) {
      setCategory(categories[0].key);
    }
  }, [kind, categories, category]);

  const press = (k) => {
    h.light();
    if (k === "⌫") {
      setAmountStr((s) => s.slice(0, -1));
    } else if (k === ".") {
      setAmountStr((s) => (s.includes(".") ? s : s + "."));
    } else {
      setAmountStr((s) => (s === "0" && k !== "." ? k : s + k));
    }
  };

  const amount = parseFloat(amountStr.replace(",", ".")) || 0;

  return (
    <div className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] max-w-lg mx-auto min-h-screen overflow-y-auto">
      {/* Type toggle */}
      <div className="flex rounded-xl overflow-hidden mb-4 bg-[var(--app-secondary)] p-1">
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            kind === "expense" ? "bg-red-500/30 text-red-400" : ""
          }`}
          onClick={() => setKind("expense")}
        >
          Витрата
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            kind === "income" ? "bg-green-500/30 text-green-400" : ""
          }`}
          onClick={() => setKind("income")}
        >
          Дохід
        </button>
      </div>

      {/* Amount display */}
      <div className="text-center text-5xl font-bold mt-4 mb-3">
        <div className="flex items-center justify-center gap-2">
           <span>{amountStr || "0"}</span>
           <span className="text-3xl text-[var(--app-hint)]">{currency === "UAH" ? "₴" : "$"}</span>
        </div>
      </div>

      {/* Currency toggle */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-[var(--app-secondary)] rounded-[14px] p-1 shadow-inner">
           <button
             onClick={() => { setCurrency("UAH"); h.light(); }}
             className={`px-5 py-1.5 rounded-[10px] text-[13px] font-bold transition-colors ${currency === "UAH" ? "bg-[#10b981] text-white shadow" : "text-[var(--app-hint)] active:bg-white/5"}`}
           >
             UAH
           </button>
           <button
             onClick={() => { setCurrency("USD"); h.light(); }}
             className={`px-5 py-1.5 rounded-[10px] text-[13px] font-bold transition-colors ${currency === "USD" ? "bg-[#10b981] text-white shadow" : "text-[var(--app-hint)] active:bg-white/5"}`}
           >
             USD
           </button>
        </div>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2 mb-5 max-w-xs mx-auto">
        {KEYS.flat().map((k) => (
          <motion.button
            type="button"
            key={k}
            whileTap={{ scale: 0.95 }}
            className="h-14 rounded-2xl bg-[var(--app-secondary)] text-xl font-medium"
            onClick={() => press(k)}
          >
            {k}
          </motion.button>
        ))}
      </div>

      {/* Categories */}
      <p className="text-sm text-[var(--app-hint)] mb-2">Категорія</p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {categories.map((c) => {
          const Icon = c.icon;
          const selected = category === c.key;
          return (
            <button
              type="button"
              key={c.key}
              onClick={() => {
                setCategory(c.key);
                h.light();
              }}
              className={`rounded-xl py-2.5 px-1 text-xs border transition-colors flex flex-col items-center gap-1 ${
                selected
                  ? "border-[var(--app-button)] bg-[var(--app-button)]/10"
                  : "border-transparent bg-[var(--app-secondary)]"
              }`}
            >
              <Icon size={20} color={selected ? c.color : "currentColor"} />
              <span className="truncate w-full text-center leading-tight">{c.key}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            h.light();
            setShowAddCategory(true);
          }}
          className="rounded-xl py-2.5 px-1 text-xs border border-transparent bg-white/5 hover:bg-white/10 active:bg-white/20 transition-colors flex flex-col items-center justify-center gap-1 text-white/50"
        >
          <Plus size={20} />
          <span className="truncate w-full text-center leading-tight">Додати</span>
        </button>
      </div>

      {/* Description */}
      <input
        className="w-full rounded-xl px-3 py-3 bg-[var(--app-secondary)] border border-white/10 placeholder:text-[var(--app-hint)] text-sm"
        placeholder="Опис (необов'язково)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* Save button */}
      <button
        type="button"
        disabled={!amount || saving}
        className="mt-4 w-full py-3 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium disabled:opacity-50 sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        onClick={async () => {
          if (!initData || amount <= 0 || savingRef.current) return;
          savingRef.current = true;
          setSaving(true);
          
          let finalAmount = amount;
          let originalAmount = undefined;
          let originalCurrency = undefined;
          if (currency === "USD") {
             originalAmount = amount;
             originalCurrency = "USD";
             finalAmount = amount * usdRate;
          }
          
          try {
            await api.post("/transactions", initData, {
              type: kind,
              amount: finalAmount,
              category: category || "Інше",
              description,
              original_amount: originalAmount,
              original_currency: originalCurrency,
            });
            h.success();
            setTimeout(() => nav(-1), 100);
          } catch (err) {
            console.error("Save error:", err);
            h.error();
            setSaving(false);
            savingRef.current = false;
            // Show visible alert for user
            if (window.Telegram?.WebApp?.showAlert) {
              window.Telegram.WebApp.showAlert(`Помилка: ${err.message || "Невідома помилка"}`);
            } else {
              alert(`Помилка: ${err.message || "Невідома помилка"}`);
            }
          }
        }}
      >
        {saving ? "Збереження..." : "Зберегти"}
      </button>

      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        type={kind}
        onCreated={(cat) => setCategory(cat.key)}
      />
    </div>
  );
}
