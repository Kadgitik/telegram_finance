import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { to: "/", label: "Головна", icon: "🏠" },
  { to: "/stats", label: "Статистика", icon: "📊" },
  { to: "/history", label: "Історія", icon: "📋" },
  { to: "/more", label: "Ще", icon: "⚙️" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--tg-theme-section-separator-color,#333)] bg-[var(--app-secondary)] safe-pb">
      <div className="flex justify-around py-2 max-w-lg mx-auto">
        {tabs.map(({ to, label, icon }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`flex flex-col items-center px-3 py-1 text-xs ${
                  isActive ? "text-[var(--app-button)]" : "text-[var(--app-hint)]"
                }`}
              >
                <span className="text-lg leading-none">{icon}</span>
                <span>{label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
