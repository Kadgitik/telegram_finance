import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api/client";
import BottomNav from "./components/BottomNav";
import { MonthProvider, useStoredMonth } from "./context/MonthContext";
import { CustomCategoriesProvider, useCustomCategories } from "./context/CustomCategoriesContext";
import { useTelegram } from "./hooks/useTelegram";
import AddPage from "./pages/AddPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import SavingsPage from "./pages/SavingsPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import DebtsPage from "./pages/DebtsPage";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
function AppRoutes() {
  const loc = useLocation();
  const nav = useNavigate();
  const { initData, ready } = useTelegram();
  const [, setStoredMonth] = useStoredMonth();
  const [, setCustomCategories] = useCustomCategories();
  const [bootReady, setBootReady] = useState(true);

  const rootTabs = ["/", "/stats", "/history", "/savings"];
  const isRootTab = rootTabs.includes(loc.pathname);
  const hideNav = !isRootTab;
  useTelegramBackButton(!isRootTab, () => nav(-1));

  useEffect(() => {
    if (!ready) return;
    if (!initData) {
      setBootReady(true);
      return;
    }
    let cancelled = false;
    setBootReady(false);
    (async () => {
      try {
        const data = await api.get("/bootstrap?month=auto", initData);
        if (cancelled || !data) return;
        const m = data.month;
        if (m) setStoredMonth(m);
        if (data.custom_categories) setCustomCategories(data.custom_categories);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBootReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [initData, ready, setStoredMonth]);

  if (initData && !bootReady) {
    return (
      <div
        className="flex items-center justify-center text-[var(--app-hint)] text-sm px-4"
        style={{ minHeight: "var(--tg-viewport-height, 100dvh)" }}
      >
        Завантаження...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "var(--tg-viewport-height, 100dvh)" }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/debts" element={<DebtsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <CustomCategoriesProvider>
      <MonthProvider>
        <AppRoutes />
      </MonthProvider>
    </CustomCategoriesProvider>
  );
}
