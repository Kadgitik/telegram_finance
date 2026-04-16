import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTelegram } from "./useTelegram";

export function useFxRate() {
  const { initData } = useTelegram();
  const [rate, setRate] = useState(() => {
    const cached = localStorage.getItem("fx_usd_uah");
    return cached ? Number(cached) : null;
  });

  useEffect(() => {
    if (!initData) return;
    api
      .get("/fx/usd-uah", initData)
      .then((r) => {
        const val = Number(r?.rate);
        if (val) {
          setRate(val);
          localStorage.setItem("fx_usd_uah", val.toString());
        }
      })
      .catch(() => {});
  }, [initData]);

  return rate;
}
