import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

const getRemainingSeconds = (endsAt: string | undefined, currentTime: number) => {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - currentTime) / 1000));
};

export const useRestTimer = () => {
  const activeRestTimer = useAppStore((state) => state.activeRestTimer);
  const startRestTimer = useAppStore((state) => state.startRestTimer);
  const stopRestTimer = useAppStore((state) => state.stopRestTimer);
  const [now, setNow] = useState(() => Date.now());

  const remainingSeconds = getRemainingSeconds(activeRestTimer?.endsAt, now);
  const durationSeconds = activeRestTimer?.durationSeconds ?? 0;
  const isRunning = Boolean(activeRestTimer && remainingSeconds > 0);

  const startTimer = useCallback(
    (setId: string, seconds: number) => {
      startRestTimer(setId, seconds);
      setNow(Date.now());
    },
    [startRestTimer]
  );

  const stopTimer = useCallback(() => {
    stopRestTimer();
    setNow(Date.now());
  }, [stopRestTimer]);

  useEffect(() => {
    if (!activeRestTimer) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRestTimer]);

  return {
    remainingSeconds,
    durationSeconds,
    isRunning,
    activeRestSetId: activeRestTimer?.setId ?? null,
    startTimer,
    stopTimer,
  };
};
