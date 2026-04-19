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
  Star,
  Smile,
  Activity,
  Car,
  Coffee,
  Book,
  Music,
  Umbrella,
  Monitor,
  Anchor,
  Droplet,
  Award,
  Cat,
  Dog,
  Carrot,
  Baby,
  Dumbbell
} from "lucide-react";

export const CUSTOM_ICONS_MAP = {
  Star, Smile, Activity, Car, Coffee, Book, Music, Umbrella, Monitor, Anchor, Droplet, Award, Cat, Dog, Carrot, Baby, Dumbbell,
  ShoppingCart, UtensilsCrossed, Bus, Fuel, Gamepad2, Heart, Sparkles, Shirt, Smartphone, Home, Zap, ArrowLeftRight, Banknote, GraduationCap, CreditCard, Plane, Briefcase, Gift, Wallet, PiggyBank, Landmark
};

export const ACCENT = {
  green: "#34C759",
  red: "#FF3B30",
  blue: "#007AFF",
  orange: "#FF9500",
  purple: "#AF52DE",
  pink: "#FF2D55",
  teal: "#5AC8FA",
  yellow: "#FFCC00",
  indigo: "#5856D6",
  brown: "#A2845E",
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
export function getCategoryConfig(key, customCategories = []) {
  const custom = customCategories.find((c) => c.key === key);
  if (custom) {
    return {
      key: custom.key,
      icon: CUSTOM_ICONS_MAP[custom.icon] || MoreHorizontal,
      color: custom.color || "#8E8E93",
      isCustom: true
    };
  }
  return (
    EXPENSE_CATEGORIES.find((c) => c.key === key) ||
    INCOME_CATEGORIES.find((c) => c.key === key) ||
    { key, icon: MoreHorizontal, color: "#8E8E93" }
  );
}
