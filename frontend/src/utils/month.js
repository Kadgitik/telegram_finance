const MONTH_NAMES = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ключ фінансового місяця (YYYY-MM) для дати: період [payDay .. наступний payDay), як у backend month_window. */
export function financialMonthKeyForDate(date, payDay) {
  const pd = Math.max(1, Math.min(28, Number(payDay) || 1));
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  if (day >= pd) {
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function parseMonthKey(key) {
  const [y, m] = String(key || currentMonthKey()).split("-");
  return { year: Number(y), month: Number(m) };
}

export function shiftMonth(key, delta) {
  const { year, month } = parseMonthKey(key);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(key) {
  const { year, month } = parseMonthKey(key);
  const name = MONTH_NAMES[Math.max(0, Math.min(11, month - 1))] || "";
  return `${name} ${year}`;
}
