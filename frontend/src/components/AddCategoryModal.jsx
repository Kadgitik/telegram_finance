import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useState } from "react";
import { CUSTOM_ICONS_MAP, ACCENT } from "../utils/constants";
import { useHaptic } from "../hooks/useHaptic";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";
import { useCustomCategories } from "../context/CustomCategoriesContext";

const ICONS = Object.keys(CUSTOM_ICONS_MAP);
const COLORS = Object.values(ACCENT).flatMap((c) => (Array.isArray(c) ? c : [c]));

export default function AddCategoryModal({
  isOpen,
  onClose,
  type, // "expense" | "income"
  onCreated,
}) {
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState("Star");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  
  const { initData } = useTelegram();
  const h = useHaptic();
  const [, setCustomCategories] = useCustomCategories();

  const handleSave = async () => {
    if (!name.trim() || !initData || saving) return;
    setSaving(true);
    try {
      const payload = {
        type,
        key: name.trim(),
        icon: iconKey,
        color: color,
      };
      await api.post("/categories", initData, payload);
      h.success();
      setCustomCategories((prev) => [...prev, payload]);
      onCreated(payload);
      onClose();
      // Reset state for next use
      setName("");
      setIconKey("Star");
      setColor(COLORS[0]);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] pointer-events-auto"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 w-full bg-[#1C1C1E] rounded-t-[32px] p-6 z-[110] shadow-2xl border-t border-white/10 pointer-events-auto max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Створити категорію
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 hide-scrollbar pb-6 space-y-6">
              
              <div>
                <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Назва</p>
                <input
                  className="w-full rounded-2xl px-4 py-3.5 bg-white/5 border border-white/10 placeholder:text-white/30 text-[15px] focus:outline-none focus:border-[var(--app-button)] transition-colors text-white"
                  placeholder="Напр. Здоров'я, Хоббі..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                />
              </div>

              <div>
                 <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Колір</p>
                 <div className="flex flex-wrap gap-3">
                   {COLORS.map((c) => (
                     <button
                       key={c}
                       type="button"
                       onClick={() => { setColor(c); h.light(); }}
                       className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90"
                       style={{ backgroundColor: c }}
                     >
                       {color === c && <Check size={18} color="#fff" />}
                     </button>
                   ))}
                 </div>
              </div>

              <div>
                <p className="text-sm text-[var(--app-hint)] mb-2 font-medium pl-1">Іконка</p>
                <div className="grid grid-cols-5 gap-3">
                  {ICONS.map((ik) => {
                    const Icon = CUSTOM_ICONS_MAP[ik];
                    const selected = iconKey === ik;
                    return (
                      <button
                        key={ik}
                        type="button"
                        onClick={() => { setIconKey(ik); h.light(); }}
                        className={`aspect-square rounded-2xl flex items-center justify-center transition-colors border ${
                          selected ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-transparent text-white/40"
                        }`}
                        style={selected ? { color: color, borderColor: color, backgroundColor: `${color}15` } : {}}
                      >
                        <Icon size={24} />
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>

            <div className="pt-2 pb-2 shrink-0 border-t border-white/5 mt-2">
               <button
                 onClick={handleSave}
                 disabled={saving || !name.trim()}
                 className="w-full bg-[var(--app-button)] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
               >
                 {saving ? "Збереження..." : "Створити"}
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
