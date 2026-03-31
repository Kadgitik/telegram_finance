import { useState } from "react";

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

export function useStoredMonth() {
  const key = "finance:month";
  const [month, setMonthState] = useState(() => localStorage.getItem(key) || currentMonthKey());
  const setMonth = (next) => {
    localStorage.setItem(key, next);
    setMonthState(next);
  };
  return [month, setMonth];
}
