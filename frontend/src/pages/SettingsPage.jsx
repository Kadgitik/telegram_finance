import { useEffect, useState } from "react";
import { api } from "../api/client";
import MonthSwitcher from "../components/MonthSwitcher";
import { useTelegram } from "../hooks/useTelegram";
import { useStoredMonth } from "../context/MonthContext";
import { currentMonthKey, formatMonthLabel } from "../utils/month";

export default function SettingsPage() {
  const { initData } = useTelegram();
  const [payDay, setPayDay] = useState(1);
  const [overrides, setOverrides] = useState({});
  const [overrideDay, setOverrideDay] = useState(1);
  const [globalMonth] = useStoredMonth();
  const [overrideMonth, setOverrideMonth] = useState(() => globalMonth || currentMonthKey());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!initData) return;
    const s = await api.get("/users/settings", initData);
    setPayDay(s?.pay_day || 1);
    setOverrideDay(s?.pay_day || 1);
    setOverrides(s?.pay_day_overrides || {});
    setOverrideMonth(globalMonth || currentMonthKey());
  };

  useEffect(() => {
    load();
  }, [initData, globalMonth]);

  const saveSettings = async () => {
    if (!initData) return;
    setSaving(true);
    try {
      await api.patch("/users/settings", initData, { pay_day: Number(payDay), currency: "UAH" });
    } finally {
      setSaving(false);
    }
  };

  const saveMonthOverride = async () => {
    if (!initData || !overrideMonth) return;
    await api.put(`/users/pay-day-overrides/${overrideMonth}`, initData, {
      day: Number(overrideDay),
    });
    load();
  };

  const removeMonthOverride = async (monthKey) => {
    if (!initData || !monthKey) return;
    await api.delete(`/users/pay-day-overrides/${monthKey}`, initData);
    load();
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
      <div className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
        <p className="text-sm text-[var(--app-hint)]">
          Особливий день зарплати для конкретного місяця
        </p>
        <MonthSwitcher month={overrideMonth} onChange={setOverrideMonth} />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={28}
            className="w-24 rounded-xl px-3 py-2 bg-black/20"
            value={overrideDay}
            onChange={(e) =>
              setOverrideDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))
            }
          />
          <span className="text-sm text-[var(--app-hint)]">число</span>
          <button
            type="button"
            className="ml-auto px-4 py-2 rounded-xl bg-[var(--app-button)] text-white"
            onClick={saveMonthOverride}
          >
            Зберегти для {formatMonthLabel(overrideMonth)}
          </button>
        </div>
        {Object.keys(overrides).length > 0 ? (
          <ul className="space-y-1">
            {Object.entries(overrides)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([monthKey, day]) => (
                <li
                  key={monthKey}
                  className="rounded-lg px-3 py-2 bg-black/20 flex items-center justify-between gap-2"
                >
                  <span className="text-sm">
                    {formatMonthLabel(monthKey)}: {day} число
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-300"
                    onClick={() => removeMonthOverride(monthKey)}
                  >
                    Видалити
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--app-hint)]">
            Немає місячних винятків. Діє загальний день зарплати.
          </p>
        )}
      </div>
      <p className="text-xs text-[var(--app-hint)]">Finance Mini App v1.0</p>
    </div>
  );
}
