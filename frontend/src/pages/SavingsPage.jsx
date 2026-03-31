import { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import confetti from "canvas-confetti";
import { api } from "../api/client";
import { Link } from "react-router-dom";
import { useFxRate } from "../hooks/useFxRate";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney, formatUsdApprox } from "../utils/formatters";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function SavingsPage() {
  const { initData } = useTelegram();
  const h = useHaptic();
  const usdRate = useFxRate();
  const [tab, setTab] = useState("savings");
  const [savings, setSavings] = useState({ total: 0, history: [], monthly_breakdown: [] });
  const [goals, setGoals] = useState([]);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [goalForm, setGoalForm] = useState({ name: "", emoji: "🎯", target_amount: "", deadline: "" });
  const [contribMap, setContribMap] = useState({});

  const load = async () => {
    if (!initData) return;
    const [s, g] = await Promise.all([api.get("/savings", initData), api.get("/goals", initData)]);
    setSavings(s || { total: 0, history: [], monthly_breakdown: [] });
    setGoals(g?.items || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [initData]);

  const saveSavings = async () => {
    if (!initData || !Number(amount)) return;
    await api.post("/savings", initData, { amount: Number(amount), comment });
    setAmount("");
    setComment("");
    load();
  };

  const removeSavings = async (id) => {
    if (!initData || !confirm("Видалити запис?")) return;
    await api.delete(`/savings/${id}`, initData);
    load();
  };

  const createGoal = async () => {
    if (!initData || !goalForm.name.trim() || !Number(goalForm.target_amount)) return;
    await api.post("/goals", initData, {
      name: goalForm.name.trim(),
      emoji: goalForm.emoji || "🎯",
      target_amount: Number(goalForm.target_amount),
      deadline: goalForm.deadline || null,
    });
    setGoalForm({ name: "", emoji: "🎯", target_amount: "", deadline: "" });
    load();
  };

  const contributeGoal = async (goalId) => {
    const value = Number(contribMap[goalId] || 0);
    if (!initData || !value) return;
    const res = await api.post(`/goals/${goalId}/contribute`, initData, { amount: value });
    if (res?.completed) {
      h.success();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.65 },
      });
    }
    setContribMap((s) => ({ ...s, [goalId]: "" }));
    load();
  };

  const deleteGoal = async (goalId) => {
    if (!initData || !confirm("Видалити ціль?")) return;
    await api.delete(`/goals/${goalId}`, initData);
    load();
  };

  const chart = useMemo(() => {
    const labels = (savings.monthly_breakdown || []).map((x) => x.month);
    const vals = (savings.monthly_breakdown || []).map((x) => x.amount);
    return {
      labels,
      datasets: [
        {
          label: "Накопичення",
          data: vals,
          borderRadius: 8,
          backgroundColor: "#007AFF",
        },
      ],
    };
  }, [savings]);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">💎 Скарбничка</h1>
      <div className="flex rounded-xl overflow-hidden bg-[var(--app-secondary)] p-1">
        <button
          type="button"
          onClick={() => setTab("savings")}
          className={`flex-1 py-2 rounded-lg text-sm ${tab === "savings" ? "bg-[var(--app-button)]/30" : ""}`}
        >
          💰 Накопичення
        </button>
        <button
          type="button"
          onClick={() => setTab("goals")}
          className={`flex-1 py-2 rounded-lg text-sm ${tab === "goals" ? "bg-[var(--app-button)]/30" : ""}`}
        >
          🎯 Цілі
        </button>
      </div>

      {tab === "savings" ? (
        <>
          <div className="rounded-xl bg-[var(--app-secondary)] p-4">
            <p className="text-sm text-[var(--app-hint)]">Всього накопичено</p>
            <p className="text-3xl font-bold">{formatMoney(savings.total || 0)}</p>
            <p className="text-xs text-[var(--app-hint)]">
              {formatUsdApprox(savings.total || 0, usdRate)}
            </p>
          </div>
          {chart.labels.length > 0 && (
            <div className="rounded-xl bg-[var(--app-secondary)] p-3">
              <Bar
                data={chart}
                options={{
                  plugins: { legend: { display: false } },
                  scales: { x: { ticks: { color: "#888" } }, y: { ticks: { color: "#888" } } },
                }}
              />
            </div>
          )}
          <div className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
            <p className="text-sm text-[var(--app-hint)]">Відкласти гроші</p>
            <input
              type="number"
              className="w-full rounded-xl px-3 py-2 bg-black/20"
              placeholder="Сума"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="w-full rounded-xl px-3 py-2 bg-black/20"
              placeholder="Коментар (опц.)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="button" className="w-full rounded-xl py-2 bg-[var(--app-button)] text-white" onClick={saveSavings}>
              Зберегти
            </button>
          </div>
          <ul className="space-y-2">
            {(savings.history || []).map((x) => (
              <li key={x.id} className="rounded-xl bg-[var(--app-secondary)] px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-green-400">+{formatMoney(x.amount)}</p>
                  <p className="text-[10px] text-[var(--app-hint)]">
                    {formatUsdApprox(x.amount, usdRate)}
                  </p>
                  <p className="text-xs text-[var(--app-hint)] truncate">{x.comment || "Без коментаря"}</p>
                </div>
                <button type="button" className="text-red-400 text-xs" onClick={() => removeSavings(x.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
            <p className="text-sm text-[var(--app-hint)]">Нова ціль</p>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <input
                className="rounded-xl px-3 py-2 bg-black/20"
                placeholder="🎯"
                value={goalForm.emoji}
                onChange={(e) => setGoalForm((s) => ({ ...s, emoji: e.target.value }))}
              />
              <input
                className="rounded-xl px-3 py-2 bg-black/20"
                placeholder="Назва"
                value={goalForm.name}
                onChange={(e) => setGoalForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <input
              type="number"
              className="w-full rounded-xl px-3 py-2 bg-black/20"
              placeholder="Цільова сума"
              value={goalForm.target_amount}
              onChange={(e) => setGoalForm((s) => ({ ...s, target_amount: e.target.value }))}
            />
            <input
              type="date"
              className="w-full rounded-xl px-3 py-2 bg-black/20"
              value={goalForm.deadline}
              onChange={(e) => setGoalForm((s) => ({ ...s, deadline: e.target.value }))}
            />
            <button type="button" className="w-full rounded-xl py-2 bg-[var(--app-button)] text-white" onClick={createGoal}>
              Створити
            </button>
          </div>
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id} className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
                <Link to={`/goals/${g.id}`} className="font-semibold block">{g.emoji} {g.name}</Link>
                <p className="text-sm">
                  {formatMoney(g.current_amount)} / {formatMoney(g.target_amount)} ({g.percent}%)
                </p>
                <p className="text-[10px] text-[var(--app-hint)]">
                  {formatUsdApprox(g.current_amount, usdRate)} / {formatUsdApprox(g.target_amount, usdRate)}
                </p>
                <div className="h-2 rounded-full bg-black/30">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(100, g.percent)}%` }} />
                </div>
                {g.deadline ? (
                  <p className="text-xs text-[var(--app-hint)]">
                    До дедлайну: {g.days_left ?? 0} дн. · потрібно ~{formatMoney(g.monthly_needed || 0)}/міс
                  </p>
                ) : (
                  <p className="text-xs text-[var(--app-hint)]">Без дедлайну</p>
                )}
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input
                    type="number"
                    className="rounded-xl px-3 py-2 bg-black/20"
                    placeholder="Сума поповнення"
                    value={contribMap[g.id] || ""}
                    onChange={(e) => setContribMap((s) => ({ ...s, [g.id]: e.target.value }))}
                  />
                  <button type="button" className="rounded-xl px-3 py-2 bg-[var(--app-button)] text-white" onClick={() => contributeGoal(g.id)}>
                    ➕
                  </button>
                  <button type="button" className="rounded-xl px-3 py-2 bg-red-500/30 text-red-300" onClick={() => deleteGoal(g.id)}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
