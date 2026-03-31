import WebApp from "@twa-dev/sdk";
import { useEffect, useState } from "react";

export function useTelegram() {
  const [ready, setReady] = useState(false);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    const setViewportHeightVar = () => {
      const h = WebApp?.viewportStableHeight || WebApp?.viewportHeight;
      if (h) {
        document.documentElement.style.setProperty("--tg-viewport-height", `${h}px`);
      }
    };

    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.disableVerticalSwipes?.();
      WebApp.requestFullscreen?.();
      setViewportHeightVar();
      WebApp.onEvent?.("viewportChanged", setViewportHeightVar);
      setInitData(WebApp.initData || "");
    } catch {
      setInitData("");
    }
    setReady(true);

    return () => {
      try {
        WebApp.offEvent?.("viewportChanged", setViewportHeightVar);
      } catch {
        // noop
      }
    };
  }, []);

  return {
    ready,
    initData,
    user: WebApp.initDataUnsafe?.user,
    WebApp,
  };
}
