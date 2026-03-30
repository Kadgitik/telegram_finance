import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";

export default function SettingsPage() {
  const { initData } = useTelegram();
  const [custom, setCustom] = useState([]);
  const [newCat, setNewCat] = useState("");

  const load = async () => {
    if (!initData) return;
    const r = await api.get("/categories", initData);
    setCustom((r.custom || []).map((x) => x.label));
  };

  useEffect(() => {
    load();
  }, [initData]);

  const add = async () => {
    if (!newCat.trim() || !initData) return;
    await api.post("/categories", initData, { label: newCat.trim() });
    setNewCat("");
    load();
  };

  const remove = async (label) => {
    if (!initData || !confirm("Видалити?")) return;
    await api.delete("/categories/" + encodeURIComponent(label), initData);
    load();
  };

  const exportCsv = async () => {
    if (!initData) return;
    const r = await fetch("/api/export/csv", {
      headers: { Authorization: `tma ${initData}` },
    });
    const text = await r.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Налаштування</h1>
      <div>
        <p className="text-sm text-[var(--app-hint)] mb-1">Валюта</p>
        <p>₴ UAH</p>
      </div>
      <div>
        <p className="text-sm text-[var(--app-hint)] mb-2">Кастомні категорії</p>
        <ul className="space-y-1 mb-3">
          {custom.map((c) => (
            <li
              key={c}
              className="flex justify-between rounded-lg bg-[var(--app-secondary)] px-3 py-2"
            >
              {c}
              <button type="button" className="text-red-400" onClick={() => remove(c)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Нова категорія"
          />
          <button
            type="button"
            className="px-4 rounded-xl bg-[var(--app-button)] text-white"
            onClick={add}
          >
            +
          </button>
        </div>
      </div>
      <button
        type="button"
        className="w-full py-3 rounded-xl bg-[var(--app-secondary)]"
        onClick={exportCsv}
      >
        Експорт CSV
      </button>
      <p className="text-xs text-[var(--app-hint)]">Finance Mini App v1.0</p>
    </div>
  );
}
