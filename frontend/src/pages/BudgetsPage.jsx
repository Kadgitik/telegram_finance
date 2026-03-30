import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney } from "../utils/formatters";

export default function BudgetsPage() {
  const { initData } = useTelegram();
  const [data, setData] = useState({});
  const [cat, setCat] = useState("");
  const [amt, setAmt] = useState("");

  const load = async () => {
    if (!initData) return;
    const r = await api.get("/budgets", initData);
    setData(r.budgets || {});
  };

  useEffect(() => {
    load();
  }, [initData]);

  const save = async () => {
    if (!initData || !cat.trim() || !amt) return;
    await api.post("/budgets", initData, {
      category: cat.trim(),
      amount: parseFloat(amt),
    });
    setCat("");
    setAmt("");
    load();
  };

  const del = async (c) => {
    if (!initData || !confirm("Видалити бюджет?")) return;
    await api.delete("/budgets/" + encodeURIComponent(c), initData);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Бюджети</h1>
      <div className="space-y-3 mb-6">
        {Object.entries(data).map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl p-3 bg-[var(--app-secondary)] flex justify-between items-center"
          >
            <span className="text-sm truncate mr-2">{k}</span>
            <span className="text-sm">{formatMoney(v)}</span>
            <button
              type="button"
              className="text-red-400 text-sm"
              onClick={() => del(k)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="text-sm text-[var(--app-hint)] mb-2">Новий бюджет</p>
      <input
        className="w-full mb-2 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
        placeholder="Категорія (як у витратах)"
        value={cat}
        onChange={(e) => setCat(e.target.value)}
      />
      <input
        type="number"
        className="w-full mb-2 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
        placeholder="Ліміт ₴"
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
      />
      <button
        type="button"
        className="w-full py-3 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium"
        onClick={save}
      >
        Зберегти
      </button>
    </div>
  );
}
