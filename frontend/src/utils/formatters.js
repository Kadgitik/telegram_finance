import { format } from "date-fns";
import { uk } from "date-fns/locale";

export function formatMoney(n) {
  const v = Number(n) || 0;
  return (
    new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(v) +
    " ₴"
  );
}

export function formatUsdApprox(uah, usdRate) {
  const value = Number(uah) || 0;
  const rate = Number(usdRate) || 0;
  if (!rate) return "";
  const usd = value / rate;
  const digits = Math.abs(usd) < 100 ? 2 : 0;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(usd)} $`;
}

export function formatTime(iso) {
  try {
    return format(new Date(iso), "HH:mm", { locale: uk });
  } catch {
    return "";
  }
}

export function formatDayLabel(iso) {
  try {
    return format(new Date(iso), "d MMM", { locale: uk });
  } catch {
    return "";
  }
}
