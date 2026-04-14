import { AnimatePresence, motion } from "framer-motion";
import { X, Calendar } from "lucide-react";
import { useState } from "react";

export default function PeriodPickerModal({
  isOpen,
  onClose,
  currentPeriodType, // 'month' or 'custom'
  currentMonth, // string, e.g. "2024-03"
  currentRange, // { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  onApply,
}) {
  const [tab, setTab] = useState(currentPeriodType); // 'month' or 'custom'
  const [startDate, setStartDate] = useState(currentRange?.start || "");
  const [endDate, setEndDate] = useState(currentRange?.end || "");

  const handleApply = () => {
    if (tab === "custom") {
      if (!startDate || !endDate) return;
      onApply("custom", { start: startDate, end: endDate });
    } else {
      onApply("month"); // will revert to month
    }
  };

  const setRangeDays = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 pointer-events-auto"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 w-full bg-[#1C1C1E] rounded-t-[32px] p-6 z-50 shadow-2xl border-t border-white/10 pointer-events-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={22} className="text-[#10b981]" /> Період
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex bg-black/30 rounded-2xl p-1 mb-6">
              <button
                onClick={() => setTab("month")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === "month"
                    ? "bg-[#10b981] text-white shadow-lg"
                    : "text-white/40"
                }`}
              >
                По місяцях
              </button>
              <button
                onClick={() => setTab("custom")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === "custom"
                    ? "bg-[#10b981] text-white shadow-lg"
                    : "text-white/40"
                }`}
              >
                Обранні дати
              </button>
            </div>

            {tab === "month" ? (
              <div className="py-8 text-center text-white/50 text-sm">
                Повернутися до стандартного вибору фінансових місяців.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setRangeDays(7)} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold hover:bg-white/10 active:bg-white/20 transition-colors border border-white/5">7 днів</button>
                  <button onClick={() => setRangeDays(30)} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold hover:bg-white/10 active:bg-white/20 transition-colors border border-white/5">30 днів</button>
                  <button onClick={() => setRangeDays(90)} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold hover:bg-white/10 active:bg-white/20 transition-colors border border-white/5">90 днів</button>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-white/40 uppercase mb-1.5 pl-1">Від</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-white focus:outline-none focus:border-[#10b981] transition-colors"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-white/40 uppercase mb-1.5 pl-1">До</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-white focus:outline-none focus:border-[#10b981] transition-colors"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={tab === "custom" && (!startDate || !endDate)}
              className="w-full mt-8 bg-gradient-to-r from-[#059669] to-[#34d399] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:grayscale"
            >
              Застосувати
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
