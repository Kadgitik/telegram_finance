import WebApp from "@twa-dev/sdk";
import { useEffect, useState } from "react";

export function useTelegram() {
  const [ready, setReady] = useState(false);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      setInitData(WebApp.initData || "");
    } catch {
      setInitData("");
    }
    setReady(true);
  }, []);

  return {
    ready,
 initData,
    user: WebApp.initDataUnsafe?.user,
    WebApp,
  };
}
