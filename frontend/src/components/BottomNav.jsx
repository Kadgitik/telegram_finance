import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { ChartColumnBig, CircleUserRound, History, House, PiggyBank } from "lucide-react";

const tabs = [
  { to: "/", label: "Головна", icon: House },
  { to: "/stats", label: "Статистика", icon: ChartColumnBig },
  { to: "/savings", label: "Скарбничка", icon: PiggyBank },
  { to: "/history", label: "Історія", icon: History },
  { to: "/settings", label: "Ще", icon: CircleUserRound },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--tg-theme-section-separator-color,#333)] bg-[var(--app-secondary)] safe-pb">
      <div className="flex justify-around py-2 max-w-lg mx-auto">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`flex flex-col items-center px-3 py-1 text-xs ${
                  isActive ? "text-[var(--app-button)]" : "text-[var(--app-hint)]"
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
