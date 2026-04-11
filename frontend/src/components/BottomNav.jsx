import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { ChartColumnBig, History, House, PiggyBank, Plus } from "lucide-react";

const tabs = [
  { to: "/", label: "Головна", icon: House },
  { to: "/stats", label: "Статистика", icon: ChartColumnBig },
  { to: "/add?type=expense", label: "Додати", icon: Plus, accent: true },
  { to: "/history", label: "Історія", icon: History },
  { to: "/savings", label: "Накопичення", icon: PiggyBank },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#121214]/80 backdrop-blur-3xl border-t border-white/5 safe-pb">
      <div className="grid grid-cols-5 py-2 max-w-lg mx-auto">
        {tabs.map(({ to, label, icon: Icon, accent }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] font-medium leading-tight min-w-0 transition-colors ${
                  isActive 
                    ? "text-[#A78BFA]" // Purple-400 for active state
                    : accent ? "text-white/90" : "text-white/40"
                }`}
              >
                <div className={`mb-1 flex items-center justify-center ${accent ? "w-8 h-8 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#C4B5FD]" : ""}`}>
                   <Icon size={accent ? 16 : 20} strokeWidth={isActive || accent ? 2.5 : 2} />
                </div>
                <span className="truncate">{label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
