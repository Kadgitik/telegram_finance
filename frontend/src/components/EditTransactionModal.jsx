import { AnimatePresence, motion } from "framer-motion";
import { X, Edit3 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../utils/constants";
import { formatMoney } from "../utils/formatters";
import { useHaptic } from "../hooks/useHaptic";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onUpdated,
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const h = useHaptic();
  const { initData } = useTelegram();

  useEffect(() => {
    if (isOpen && transaction) {
      setDescription(transaction.description || "");
      setCategory(transaction.category || "");
      setSaving(false);
    }
  }, [isOpen, transaction]);

  const categories = useMemo(
    () => (transaction && transaction.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [transaction]
  );

  const handleSave = async () => {
    if (!transaction || !initData || saving) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/transactions/${transaction.id}`, initData, {
        category,
        description,
      });
      h.success();
      onUpdated(updated);
      onClose();
    } catch (e) {
      console.error(e);
      h.error();
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(`Помилка: ${e.message}`);
      } else {
        alert(`Помилка: ${e.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] pointer-events-auto"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 w-full bg-[#1C1C1E] rounded-t-[32px] p-6 z-[100] shadow-2xl border-t border-white/10 pointer-events-auto max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 size={22} className="text-[var(--app-button)]" /> Редагувати
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 hide-scrollbar pb-6">
               {/* Readonly info */}
               <div className="bg-black/20 rounded-2xl p-4 mb-6 text-center border border-white/5">
                 <p className="text-sm text-white/40 mb-1">
                   {transaction.type === "income" ? "Дохід" : "Витрата"} · {transaction.source === "monobank" ? "💳 Monobank" : "💵 Готівка"}
                 </p>
                 <p className="text-2xl font-bold">
                   {formatMoney(transaction.amount)}
                 </p>
               </div>

               {/* Category Selection */}
               <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Категорія</p>
               <div className="grid grid-cols-4 gap-2 mb-6">
                 {categories.map((c) => {
                   const Icon = c.icon;
                   const selected = category === c.key;
                   const colorClass = selected ? "border-[var(--app-button)] bg-[var(--app-button)]/10" : "border-transparent bg-white/5";
                   return (
                     <button
                       type="button"
                       key={c.key}
                       onClick={() => {
                         setCategory(c.key);
                         h.light();
                       }}
                       className={`rounded-xl py-2.5 px-1 text-xs border transition-colors flex flex-col items-center gap-1 ${colorClass}`}
                     >
                       <Icon size={20} color={selected ? c.color : "currentColor"} className={selected ? "" : "text-white/70"} />
                       <span className={`truncate w-full text-center leading-tight ${selected ? "text-white font-semibold" : "text-white/70"}`}>
                         {c.key}
                       </span>
                     </button>
                   );
                 })}
               </div>

               {/* Description */}
               <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Опис</p>
               <input
                 className="w-full rounded-2xl px-4 py-3.5 bg-white/5 border border-white/10 placeholder:text-white/30 text-[15px] focus:outline-none focus:border-[var(--app-button)] transition-colors text-white"
                 placeholder="Додайте опис..."
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
               />
               
               <div className="h-6"></div>
            </div>

            <div className="pt-2 pb-2 shrink-0">
               <button
                 onClick={handleSave}
                 disabled={saving || !category}
                 className="w-full bg-[var(--app-button)] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
               >
                 {saving ? "Збереження..." : "Зберегти зміни"}
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
