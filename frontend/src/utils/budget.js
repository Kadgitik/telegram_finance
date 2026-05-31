// Spending progress of a category against its limit.
export function categoryProgress(spent, limit) {
  const s = Number(spent) || 0;
  const l = Number(limit) || 0;
  if (l <= 0) return { hasLimit: false, pct: null, fill: 0, over: false };
  const pct = Math.round((s / l) * 100);
  return { hasLimit: true, pct, fill: Math.min(100, pct), over: pct > 100 };
}

// Badge for «Темп витрат». pct === null hides it.
export function paceBadge(pct) {
  if (pct == null) return { show: false, up: false, color: "", text: "" };
  const up = pct > 0;
  return {
    show: true,
    up,
    color: up ? "#FF453A" : "#34C759",
    text: `${up ? "+" : ""}${pct}%`,
  };
}

// State for «Можна витрати».
export function canSpendState(canSpend) {
  const v = Number(canSpend) || 0;
  return { over: v < 0, value: Math.abs(v) };
}
