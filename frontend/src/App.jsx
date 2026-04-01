import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { api } from "./api/client";
import BottomNav from "./components/BottomNav";
import { MonthProvider, useStoredMonth } from "./context/MonthContext";
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

function primeBootstrapCaches(initData, monthEnc, data) {
  if (!data || typeof data !== "object") return;
  api.primeCache(
    [
      ["/users/settings", data.settings],
      [`/bootstrap?month=${monthEnc}`, data],
      [`/balance?month=${monthEnc}`, data.balance],
      [`/transactions?limit=5&month=${monthEnc}`, data.transactions],
      [`/stats?period=month&month=${monthEnc}`, data.stats],
      [`/stats/trend?days=30&month=${monthEnc}`, data.trend],
      [`/budgets?month=${monthEnc}`, data.budgets],
      ["/savings", data.savings],
      ["/goals", data.goals],
    ],
    initData
  );
}

function AppRoutes() {
  const loc = useLocation();
  const nav = useNavigate();
  const { initData } = useTelegram();
  const [month, setStoredMonth] = useStoredMonth();
  const [bootReady, setBootReady] = useState(true);
  const lastBootstrapMonthRef = useRef(null);
  const initialBootstrapDoneRef = useRef(false);

  const rootTabs = ["/", "/stats", "/history", "/budgets", "/savings"];
  const isRootTab = rootTabs.includes(loc.pathname);
  const hideNav = !isRootTab;
  useTelegramBackButton(!isRootTab, () => nav(-1));

  useEffect(() => {
    if (!initData) {
      setBootReady(true);
      lastBootstrapMonthRef.current = null;
      initialBootstrapDoneRef.current = false;
      return;
    }
    let cancelled = false;
    setBootReady(false);
    lastBootstrapMonthRef.current = null;
    initialBootstrapDoneRef.current = false;
    (async () => {
      try {
        const data = await api.get("/bootstrap?month=auto", initData);
        if (cancelled || !data || typeof data !== "object") return;
        const m = data.month ?? data.month_key;
        if (!m) return;
        const enc = encodeURIComponent(m);
        lastBootstrapMonthRef.current = m;
        setStoredMonth(m);
        api.primeCache([[`/bootstrap?month=auto`, data]], initData);
        primeBootstrapCaches(initData, enc, data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          initialBootstrapDoneRef.current = true;
          setBootReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initData, setStoredMonth]);

  useEffect(() => {
    if (!initData || !bootReady || !initialBootstrapDoneRef.current) return;
    const m = month;
    if (lastBootstrapMonthRef.current === m) return;
    lastBootstrapMonthRef.current = m;
    const enc = encodeURIComponent(m);
    (async () => {
      try {
        const data = await api.get(`/bootstrap?month=${enc}`, initData);
        primeBootstrapCaches(initData, enc, data);
      } catch {
        // ignore
      }
      Promise.allSettled([`/transactions?limit=50&month=${enc}`].map((p) => api.get(p, initData))).catch(
        () => {}
      );
    })();
  }, [initData, month, bootReady]);

  if (initData && !bootReady) {
    return (
      <div
        className="flex items-center justify-center text-[var(--app-hint)] text-sm px-4"
        style={{ minHeight: "var(--tg-viewport-height, 100dvh)" }}
      >
        Завантаження…
      </div>
    );
  }

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

export default function App() {
  return (
    <MonthProvider>
      <AppRoutes />
    </MonthProvider>
  );
}
