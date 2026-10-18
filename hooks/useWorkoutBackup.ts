import { useEffect, useRef } from "react";
import { createBackupAfterWorkout } from "../lib/backup/localBackup";
import { useAppStore } from "../store/useAppStore";

export const useWorkoutBackup = () => {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const latestWorkoutSessionId = useAppStore(
    (state) => state.workoutHistory[0]?.id ?? null
  );
  const lastSeenWorkoutSessionIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!hasInitializedRef.current) {
      lastSeenWorkoutSessionIdRef.current = latestWorkoutSessionId;
      hasInitializedRef.current = true;
      return;
    }

    if (
      !latestWorkoutSessionId ||
      latestWorkoutSessionId === lastSeenWorkoutSessionIdRef.current
    ) {
      return;
    }

    lastSeenWorkoutSessionIdRef.current = latestWorkoutSessionId;
    void createBackupAfterWorkout(latestWorkoutSessionId);
  }, [hasHydrated, latestWorkoutSessionId]);
};
