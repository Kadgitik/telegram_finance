import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { api } from "./api/client";
import BottomNav from "./components/BottomNav";
import { useTelegram } from "./hooks/useTelegram";
import AddPage from "./pages/AddPage";
import BudgetsPage from "./pages/BudgetsPage";
import CategoryStatsPage from "./pages/CategoryStatsPage";
import GoalDetailsPage from "./pages/GoalDetailsPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import SavingsPage from "./pages/SavingsPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { currentMonthKey } from "./utils/month";

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const { initData } = useTelegram();
  const rootTabs = ["/", "/stats", "/history", "/budgets", "/savings"];
  const isRootTab = rootTabs.includes(loc.pathname);
  const hideNav = !isRootTab;
  useTelegramBackButton(!isRootTab, () => nav(-1));

  useEffect(() => {
    if (!initData) return;
    const month = localStorage.getItem("finance:month") || currentMonthKey();
    const bootstrapPath = `/bootstrap?month=${month}`;
    const run = async () => {
      try {
        const data = await api.get(bootstrapPath, initData);
        if (data && typeof data === "object") {
          api.primeCache(
            [
              ["/users/settings", data.settings],
              [`/balance?month=${month}`, data.balance],
              [`/transactions?limit=5&month=${month}`, data.transactions],
              [`/stats?period=month&month=${month}`, data.stats],
              [`/stats/trend?days=30&month=${month}`, data.trend],
              [`/budgets?month=${month}`, data.budgets],
              ["/savings", data.savings],
              ["/goals", data.goals],
            ],
            initData
          );
        }
      } catch {
        // fallback to parallel prefetch if bootstrap failed
      }
      const paths = [
        `/transactions?limit=50&month=${month}`,
      ];
      Promise.allSettled(paths.map((p) => api.get(p, initData))).catch(() => {});
    };
    run();
  }, [initData]);

  return (
    <div style={{ minHeight: "var(--tg-viewport-height, 100dvh)" }}>
      {isRootTab && loc.pathname !== "/" && (
        <button
          type="button"
          className="fixed top-3 right-4 z-[60] rounded-full p-2 bg-[var(--app-secondary)] border border-white/10"
          onClick={() => nav("/settings")}
          aria-label="Налаштування"
        >
          <Settings size={16} />
        </button>
      )}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/stats/category" element={<CategoryStatsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/goals/:id" element={<GoalDetailsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}
