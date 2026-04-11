import { PiggyBank, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney } from "../utils/formatters";

export default function SavingsPage() {
  const { initData } = useTelegram();
  const h = useHaptic();
  const [total, setTotal] = useState(0);
  const [history, setHistory] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!initData) return;
    const r = await api.get("/savings", initData);
    setTotal(r.total || 0);
    setHistory(r.history || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [initData]);

  const handleAdd = async () => {
    const val = parseFloat(amount);
    if (!initData || !val || val <= 0) return;
    setSaving(true);
    try {
      await api.post("/savings", initData, { amount: val, comment });
      h.success();
      setAmount("");
      setComment("");
      setShowAdd(false);
      await load();
    } catch {
      h.error();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!initData) return;
    try {
      await api.delete(`/savings/${id}`, initData);
      h.success();
      await load();
    } catch {
      h.error();
    }
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">Накопичення</h1>

      {/* Total card */}
      <div className="rounded-[24px] p-6 bg-gradient-to-br from-[#10B981] to-[#047857] text-white shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBank size={20} className="text-white/80" />
          <p className="text-[15px] font-medium text-white/80">Всього відкладено</p>
        </div>
        <p className="text-4xl font-extrabold tracking-tight">{formatMoney(total).replace(" ₴", "")} ₴</p>
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={() => setShowAdd(!showAdd)}
        className="w-full py-3 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium flex items-center justify-center gap-2"
      >
        <Plus size={18} />
        Відкласти гроші
      </button>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-[24px] bg-[var(--app-card)] p-5 space-y-3">
          <input
            type="number"
            className="w-full rounded-xl px-3 py-2.5 bg-black/20 border border-white/10 text-sm placeholder:text-[var(--app-hint)]"
            placeholder="Сума, ₴"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <input
            className="w-full rounded-xl px-3 py-2.5 bg-black/20 border border-white/10 text-sm placeholder:text-[var(--app-hint)]"
            placeholder="Коментар (необов'язково)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="py-2.5 rounded-xl bg-black/20 text-sm"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !amount}
              className="py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "..." : "Зберегти"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-sm text-[var(--app-hint)] mb-2">Історія</p>
          <ul className="space-y-2">
            {history.map((x) => (
              <li
                key={x.id}
                className="flex items-center gap-4 p-4 rounded-[20px] bg-[var(--app-card)] shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-[#A3E635] tabular-nums tracking-tight mb-0.5">
                    +{formatMoney(x.amount).replace(" ₴", "")} ₴
                  </p>
                  {x.comment && (
                    <p className="text-[13px] text-white/80 truncate mb-1">{x.comment}</p>
                  )}
                  <p className="text-[11px] font-medium text-white/40">
                    {new Date(x.created_at).toLocaleDateString("uk-UA")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(x.id)}
                  className="p-3 rounded-2xl hover:bg-red-500/10 active:bg-red-500/20 shrink-0 transition-colors"
                >
                  <Trash2 size={18} className="text-red-400/80" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
