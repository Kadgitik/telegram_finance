import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { formatMoney } from "../utils/formatters";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function GoalDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { initData } = useTelegram();
  const h = useHaptic();
  const [goal, setGoal] = useState(null);
  const [value, setValue] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({ name: "", emoji: "🎯", target_amount: "", deadline: "" });

  const load = async () => {
    if (!initData || !id) return;
    const g = await api.get(`/goals/${id}`, initData);
    setGoal(g);
    setEdit({
      name: g.name || "",
      emoji: g.emoji || "🎯",
      target_amount: String(g.target_amount || ""),
      deadline: g.deadline || "",
    });
  };

  useEffect(() => {
    load().catch(() => {});
  }, [initData, id]);

  const contribute = async () => {
    if (!initData || !id || !Number(value)) return;
    const g = await api.post(`/goals/${id}/contribute`, initData, { amount: Number(value) });
    setGoal(g);
    setValue("");
    if (g.completed) h.success();
  };

  const save = async () => {
    if (!initData || !id) return;
    const g = await api.patch(`/goals/${id}`, initData, {
      name: edit.name,
      emoji: edit.emoji,
      target_amount: Number(edit.target_amount),
      deadline: edit.deadline || null,
    });
    setGoal(g);
    setEditMode(false);
  };

  const remove = async () => {
    if (!initData || !id || !confirm("Видалити ціль?")) return;
    await api.delete(`/goals/${id}`, initData);
    nav("/savings");
  };

  const lineData = useMemo(() => {
    const arr = goal?.contributions || [];
    let sum = 0;
    const labels = [];
    const vals = [];
    arr.forEach((x, idx) => {
      sum += Number(x.amount || 0);
      labels.push(x.date?.slice(0, 10) || String(idx + 1));
      vals.push(sum);
    });
    return {
      labels,
      datasets: [
        {
          label: "Накопичено",
          data: vals,
          borderColor: "#007AFF",
          backgroundColor: "rgba(0,122,255,0.16)",
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }, [goal]);

  if (!goal) {
    return <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">Завантаження…</div>;
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-3">
      <h1 className="text-xl font-bold">{goal.emoji} {goal.name}</h1>
      <div className="rounded-xl bg-[var(--app-secondary)] p-3">
        <p className="text-sm">{formatMoney(goal.current_amount)} / {formatMoney(goal.target_amount)} ({goal.percent}%)</p>
        <div className="h-2 rounded-full bg-black/30 mt-2">
          <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(100, goal.percent)}%` }} />
        </div>
        <p className="text-xs text-[var(--app-hint)] mt-2">
          {goal.deadline ? `Дедлайн: ${goal.deadline}, днів: ${goal.days_left ?? 0}` : "Без дедлайну"}
        </p>
      </div>
      {lineData.labels.length > 0 ? (
        <div className="rounded-xl bg-[var(--app-secondary)] p-3">
          <Line data={lineData} options={{ plugins: { legend: { display: false } } }} />
        </div>
      ) : null}
      <div className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
        <p className="text-sm text-[var(--app-hint)]">Поповнити</p>
        <div className="flex gap-2">
          <input
            type="number"
            className="flex-1 rounded-xl px-3 py-2 bg-black/20"
            placeholder="Сума"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" className="rounded-xl px-3 py-2 bg-[var(--app-button)] text-white" onClick={contribute}>
            ➕
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--app-secondary)] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--app-hint)]">Редагування</p>
          <button type="button" className="text-xs underline" onClick={() => setEditMode((s) => !s)}>
            {editMode ? "Скасувати" : "Редагувати"}
          </button>
        </div>
        {editMode ? (
          <>
            <input className="w-full rounded-xl px-3 py-2 bg-black/20" value={edit.emoji} onChange={(e) => setEdit((s) => ({ ...s, emoji: e.target.value }))} />
            <input className="w-full rounded-xl px-3 py-2 bg-black/20" value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} />
            <input type="number" className="w-full rounded-xl px-3 py-2 bg-black/20" value={edit.target_amount} onChange={(e) => setEdit((s) => ({ ...s, target_amount: e.target.value }))} />
            <input type="date" className="w-full rounded-xl px-3 py-2 bg-black/20" value={edit.deadline || ""} onChange={(e) => setEdit((s) => ({ ...s, deadline: e.target.value }))} />
            <button type="button" className="w-full rounded-xl py-2 bg-[var(--app-button)] text-white" onClick={save}>Зберегти</button>
          </>
        ) : null}
      </div>
      <button type="button" className="w-full rounded-xl py-2 bg-red-500/30 text-red-300" onClick={remove}>
        🗑 Видалити
      </button>
    </div>
  );
}
