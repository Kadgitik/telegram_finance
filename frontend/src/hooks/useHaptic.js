import { useTelegram } from "./useTelegram";

export function useHaptic() {
  const { WebApp } = useTelegram();
  return {
    light: () => WebApp?.HapticFeedback?.impactOccurred?.("light"),
    success: () => WebApp?.HapticFeedback?.notificationOccurred?.("success"),
    error: () => WebApp?.HapticFeedback?.notificationOccurred?.("error"),
  };
}
