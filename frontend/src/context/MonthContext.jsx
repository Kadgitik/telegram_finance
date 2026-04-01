import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { currentMonthKey } from "../utils/month";

const STORAGE_KEY = "finance:month";

const MonthCtx = createContext(null);

function readStoredMonth() {
  return localStorage.getItem(STORAGE_KEY) || currentMonthKey();
}

export function MonthProvider({ children }) {
  const [month, setMonthState] = useState(readStoredMonth);

  const setStoredMonth = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setMonthState(next);
  }, []);

  const value = useMemo(() => [month, setStoredMonth], [month, setStoredMonth]);
  return <MonthCtx.Provider value={value}>{children}</MonthCtx.Provider>;
}

export function useStoredMonth() {
  const v = useContext(MonthCtx);
  if (!v) {
    throw new Error("useStoredMonth має використовуватись всередині MonthProvider");
  }
  return v;
}
