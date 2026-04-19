import { AnimatePresence, motion } from "framer-motion";
import { X, Edit3, Trash2, Save, Undo2, Plus } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatMoney, formatTime } from "../utils/formatters";
import { getCategoryConfig, CUSTOM_ICONS_MAP, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../utils/constants";
import { useHaptic } from "../hooks/useHaptic";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";
import { useCustomCategories } from "../context/CustomCategoriesContext";
import AddCategoryModal from "./AddCategoryModal";

export default function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
  onUpdated,
  onDeleted
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const h = useHaptic();
  const { initData } = useTelegram();
  const [customCategories, setCustomCategories] = useCustomCategories();

  useEffect(() => {
    if (isOpen && transaction) {
      setDescription(transaction.description || "");
      setCategory(transaction.category || "");
      setIsEditing(false);
      setSaving(false);
      setDeleting(false);
    }
  }, [isOpen, transaction]);

  const categories = useMemo(() => {
    if (!transaction) return [];
    const defaultCats = transaction.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const customCats = customCategories
      .filter((c) => c.type === transaction.type)
      .map((c) => ({
        key: c.key,
        icon: CUSTOM_ICONS_MAP[c.icon] || CUSTOM_ICONS_MAP.Star,
        color: c.color || "#8E8E93",
        isCustom: true,
      }));
    return [...customCats, ...defaultCats];
  }, [transaction, customCategories]);

  const handleSave = async () => {
    if (!transaction || !initData || saving) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/transactions/${transaction.id}`, initData, {
        category,
        description: description.trim(),
      });
      h.success();
      onUpdated(updated);
      setIsEditing(false);
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

  const handleDelete = async () => {
    if (!transaction || !initData || deleting) return;
    if (window.confirm("Дійсно видалити цю операцію?")) {
      setDeleting(true);
      try {
        await api.delete(`/transactions/${transaction.id}`, initData);
        h.success();
        onDeleted(transaction.id);
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
        setDeleting(false);
      }
    }
  };

  if (!transaction) return null;

  const handleDeleteCategory = async () => {
    if (!initData) return;
    if (window.confirm(`Дійсно видалити власну категорію "${category}"?`)) {
      try {
        await api.delete(`/categories/${category}`, initData);
        setCustomCategories((prev) => prev.filter((c) => c.key !== category));
        setCategory(categories[0]?.key || "");
        h.success();
      } catch (err) {
        h.error();
        if (window.Telegram?.WebApp?.showAlert) {
          window.Telegram.WebApp.showAlert(`Помилка: ${err.message}`);
        } else {
          alert(`Помилка: ${err.message}`);
        }
      }
    }
  };

  const currentCatConfig = getCategoryConfig(transaction.category, customCategories);
  const CurrentIcon = currentCatConfig.icon;
  const isSelectedCustom = customCategories.some((c) => c.key === category);

  return (
    <>
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
                Деталі операції
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-2 bg-white/5 rounded-full text-white/70 hover:text-white transition-colors"
                >
                  {isEditing ? <Undo2 size={20} /> : <Edit3 size={20} />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 hide-scrollbar pb-6">
               
               {!isEditing ? (
                 <div className="space-y-6">
                   <div className="flex flex-col items-center justify-center pt-2 pb-4">
                     <div 
                       className="w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                       style={{ backgroundColor: `${currentCatConfig.color}25` }}
                     >
                       <CurrentIcon size={32} color={currentCatConfig.color} />
                     </div>
                     <p className="text-3xl font-extrabold tracking-tight mb-2">
                        {transaction.type === "income" ? "+" : "-"}{formatMoney(transaction.amount)}
                     </p>
                     <p className="text-[15px] font-medium text-white/40">
                        {transaction.description || transaction.category || "Без опису"}
                     </p>
                   </div>
                   
                   <div className="bg-white/5 rounded-2xl p-4 space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-white/40 text-[13px] uppercase font-bold tracking-wider">Категорія</span>
                         <span className="text-[14px] font-medium text-white/90">{transaction.category}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-white/40 text-[13px] uppercase font-bold tracking-wider">Дата</span>
                         <span className="text-[14px] font-medium text-white/90">{new Date(transaction.date).toLocaleDateString("uk-UA")} {formatTime(transaction.date)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-white/40 text-[13px] uppercase font-bold tracking-wider">Джерело</span>
                         <span className="text-[14px] font-medium text-white/90">{transaction.source === "monobank" ? "💳 Monobank" : "💵 Готівка"}</span>
                      </div>
                      {transaction.comment && (
                        <div className="flex justify-between items-center">
                           <span className="text-white/40 text-[13px] uppercase font-bold tracking-wider">Коментар банку</span>
                           <span className="text-[14px] font-medium text-white/90 truncate max-w-[60%] text-right">{transaction.comment}</span>
                        </div>
                      )}
                      {transaction.cashback > 0 && (
                        <div className="flex justify-between items-center">
                           <span className="text-white/40 text-[13px] uppercase font-bold tracking-wider">Кешбек</span>
                           <span className="text-[14px] font-medium text-[#10b981]">{transaction.cashback} ₴</span>
                        </div>
                      )}
                   </div>
                   
                   <button
                     onClick={handleDelete}
                     disabled={deleting}
                     className="w-full bg-red-500/10 text-red-500 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                   >
                     <Trash2 size={18} /> {deleting ? "Видалення..." : "Видалити операцію"}
                   </button>
                 </div>
               ) : (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    {/* Header edit view */}
                    <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5 mb-6">
                      <p className="text-sm text-[var(--app-button)] font-bold uppercase tracking-wider mb-1">
                        Редагування
                      </p>
                      <p className="text-2xl font-bold">
                        {formatMoney(transaction.amount)}
                      </p>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Категорія</p>
                      <div className="grid grid-cols-4 gap-2 mb-6">
                        {categories.map((c) => {
                          const Icon = c.icon;
                          const selected = category === c.key;
                          const colorClass = selected ? "border-[var(--app-button)] bg-[var(--app-button)]/10" : "border-transparent bg-white/5 disabled:opacity-50";
                          return (
                            <button
                              type="button"
                              key={c.key}
                              disabled={saving}
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
                        {isSelectedCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              h.light();
                              handleDeleteCategory();
                            }}
                            className="rounded-xl py-2.5 px-1 text-xs border border-transparent bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-colors flex flex-col items-center justify-center gap-1 text-red-500/80"
                          >
                            <Trash2 size={20} />
                            <span className="truncate w-full text-center leading-tight">Видалити</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Опис</p>
                      <input
                        className="w-full rounded-2xl px-4 py-3.5 bg-white/5 border border-white/10 placeholder:text-white/30 text-[15px] focus:outline-none focus:border-[var(--app-button)] transition-colors text-white"
                        placeholder="Додайте опис..."
                        value={description}
                        disabled={saving}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    
                    <button
                      onClick={handleSave}
                      disabled={saving || !category}
                      className="w-full bg-[var(--app-button)] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save size={20} /> {saving ? "Збереження..." : "Зберегти зміни"}
                    </button>
                 </motion.div>
               )}
               
               <div className="h-4"></div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    {transaction && (
      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        type={transaction.type}
        onCreated={(cat) => setCategory(cat.key)}
      />
    )}
    </>
  );
}
