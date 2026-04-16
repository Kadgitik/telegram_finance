import {
  ShoppingCart,
  UtensilsCrossed,
  Bus,
  Fuel,
  Gamepad2,
  Heart,
  Sparkles,
  Shirt,
  Smartphone,
  Home,
  Zap,
  ArrowLeftRight,
  Banknote,
  GraduationCap,
  CreditCard,
  Plane,
  MoreHorizontal,
  Briefcase,
  Gift,
  Wallet,
  PiggyBank,
  Landmark,
} from "lucide-react";

export const ACCENT = {
  green: "#34C759",
  red: "#FF3B30",
  blue: "#007AFF",
  orange: "#FF9500",
  purple: "#AF52DE",
  chart: [
    "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E",
    "#8E8E93", "#30D158", "#64D2FF", "#BF5AF2", "#FF6961",
    "#FFD700", "#5AC8FA",
  ],
};

export const EXPENSE_CATEGORIES = [
  { key: "Продукти", icon: ShoppingCart, color: "#34C759" },
  { key: "Ресторани", icon: UtensilsCrossed, color: "#FF9500" },
  { key: "Транспорт", icon: Bus, color: "#007AFF" },
  { key: "Пальне", icon: Fuel, color: "#5856D6" },
  { key: "Розваги", icon: Gamepad2, color: "#FF2D55" },
  { key: "Здоров'я", icon: Heart, color: "#FF3B30" },
  { key: "Краса", icon: Sparkles, color: "#AF52DE" },
  { key: "Одяг та взуття", icon: Shirt, color: "#00C7BE" },
  { key: "Електроніка", icon: Smartphone, color: "#5AC8FA" },
  { key: "Дім та ремонт", icon: Home, color: "#A2845E" },
  { key: "Комунальні", icon: Zap, color: "#FFCC00" },
  { key: "Переказ", icon: ArrowLeftRight, color: "#8E8E93" },
  { key: "Зняття готівки", icon: Banknote, color: "#30D158" },
  { key: "Освіта", icon: GraduationCap, color: "#64D2FF" },
  { key: "Підписки", icon: CreditCard, color: "#BF5AF2" },
  { key: "Подорожі", icon: Plane, color: "#FF6961" },
  { key: "Кредит", icon: Landmark, color: "#FF9500" },
  { key: "Накопичення", icon: PiggyBank, color: "#10b981" },
  { key: "Інше", icon: MoreHorizontal, color: "#8E8E93" },
];

export const INCOME_CATEGORIES = [
  { key: "Зарплата", icon: Briefcase, color: "#34C759" },
  { key: "Фріланс", icon: Wallet, color: "#007AFF" },
  { key: "Подарунок", icon: Gift, color: "#FF9500" },
  { key: "Переказ", icon: ArrowLeftRight, color: "#8E8E93" },
  { key: "Інше", icon: MoreHorizontal, color: "#8E8E93" },
];

// Helper to find category config by key
export function getCategoryConfig(key) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.key === key) ||
    INCOME_CATEGORIES.find((c) => c.key === key) ||
    { key, icon: MoreHorizontal, color: "#8E8E93" }
  );
}
