import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useTelegram } from "../hooks/useTelegram";

const EMOJIS = ["🍔", "🚕", "🏠", "🎮", "👕", "💊", "📚", "🎁", "📱", "💼", "🎵", "🎯", "✈️", "🏷"];

export default function SettingsPage() {
  const { initData } = useTelegram();
  const [custom, setCustom] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🏷");
  const [payDay, setPayDay] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!initData) return;
    const [c, s] = await Promise.all([
      api.get("/categories", initData),
      api.get("/users/settings", initData),
    ]);
    setCustom(
      (c.custom || []).map((x) => ({
        label: x.label,
        emoji: x.emoji || x.label?.split(" ")[0] || "🏷",
        name: x.name || x.label?.split(" ").slice(1).join(" ") || x.label,
      }))
    );
    setPayDay(s?.pay_day || 1);
  };

  useEffect(() => {
    load();
  }, [initData]);

  const add = async () => {
    if (!newCatName.trim() || !initData) return;
    await api.post("/categories", initData, {
      emoji: newCatEmoji,
      name: newCatName.trim(),
      keywords: [],
    });
    setNewCatName("");
    setNewCatEmoji("🏷");
    load();
  };

  const remove = async (label) => {
    if (!initData || !confirm("Видалити?")) return;
    await api.delete("/categories/" + encodeURIComponent(label), initData);
    load();
  };

  const saveSettings = async () => {
    if (!initData) return;
    setSaving(true);
    try {
      await api.patch("/users/settings", initData, { pay_day: Number(payDay), currency: "UAH" });
    } finally {
      setSaving(false);
    }
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
        <p className="text-sm text-[var(--app-hint)] mb-2">Початок фінансового місяця</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={28}
            className="w-24 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
            value={payDay}
            onChange={(e) => setPayDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
          />
          <span className="text-sm text-[var(--app-hint)]">число</span>
          <button
            type="button"
            className="ml-auto px-4 py-2 rounded-xl bg-[var(--app-button)] text-white disabled:opacity-60"
            onClick={saveSettings}
            disabled={saving}
          >
            Зберегти
          </button>
        </div>
      </div>
      <div>
        <p className="text-sm text-[var(--app-hint)] mb-2">Кастомні категорії</p>
        <ul className="space-y-1 mb-3">
          {custom.map((c) => (
            <li
              key={c.label}
              className="flex justify-between rounded-lg bg-[var(--app-secondary)] px-3 py-2"
            >
              <span>{c.emoji} {c.name}</span>
              <button type="button" className="text-red-400" onClick={() => remove(c.label)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className={`rounded-lg py-1 text-lg ${newCatEmoji === emoji ? "bg-[var(--app-button)]/20" : "bg-[var(--app-secondary)]"}`}
              onClick={() => setNewCatEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-3 py-2 bg-[var(--app-secondary)]"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Нова категорія"
          />
          <button
            type="button"
            className="px-4 rounded-xl bg-[var(--app-button)] text-white"
            onClick={add}
          >
            ➕
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Link to="/budgets" className="block rounded-xl px-4 py-3 bg-[var(--app-secondary)]">💰 Бюджети</Link>
        <Link to="/savings" className="block rounded-xl px-4 py-3 bg-[var(--app-secondary)]">💎 Накопичення та цілі</Link>
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
