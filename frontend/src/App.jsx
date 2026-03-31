import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import AddPage from "./pages/AddPage";
import BudgetsPage from "./pages/BudgetsPage";
import GoalDetailsPage from "./pages/GoalDetailsPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import SavingsPage from "./pages/SavingsPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const rootTabs = ["/", "/stats", "/history", "/savings", "/settings"];
  const isRootTab = rootTabs.includes(loc.pathname);
  const hideNav = !isRootTab;
  useTelegramBackButton(!isRootTab, () => nav(-1));
  return (
    <div style={{ minHeight: "var(--tg-viewport-height, 100dvh)" }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/stats" element={<StatsPage />} />
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
