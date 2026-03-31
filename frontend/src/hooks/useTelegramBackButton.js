import WebApp from "@twa-dev/sdk";
import { useEffect } from "react";

export function useTelegramBackButton(visible, onClick) {
  useEffect(() => {
    if (!visible) {
      try {
        WebApp.BackButton.hide();
      } catch {
        // no-op outside Telegram
      }
      return;
    }
    try {
      WebApp.BackButton.show();
      WebApp.BackButton.onClick(onClick);
    } catch {
      // no-op outside Telegram
    }
    return () => {
      try {
        WebApp.BackButton.offClick(onClick);
        WebApp.BackButton.hide();
      } catch {
        // no-op outside Telegram
      }
    };
  }, [visible, onClick]);
}
