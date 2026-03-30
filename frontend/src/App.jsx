import { Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import AddPage from "./pages/AddPage";
import BudgetsPage from "./pages/BudgetsPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import MorePage from "./pages/MorePage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  const loc = useLocation();
  const hideNav = loc.pathname === "/add";
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}
