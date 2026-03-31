import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useTelegram } from "./useTelegram";

export function useFxRate() {
  const { initData } = useTelegram();
  const [rate, setRate] = useState(null);

  useEffect(() => {
    if (!initData) return;
    api
      .get("/fx/usd-uah", initData)
      .then((r) => {
        setRate(Number(r?.rate) || null);
      })
      .catch(() => setRate(null));
  }, [initData]);

  return rate;
}
