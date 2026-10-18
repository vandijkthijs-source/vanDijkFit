import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Vibration } from "react-native";
import {
  completeForegroundRestTimerAlarm,
  shouldVibrateForRestTimer,
} from "../lib/notifications/restTimerAlarm";
import {
  dismissRestTimerNotifications,
  syncRestTimerNotification,
} from "../lib/notifications/restTimerNotification";
import { useAppStore } from "../store/useAppStore";

const timerChime = require("../assets/sounds/rest_timer.wav");

export const useRestTimerAlerts = () => {
  const activeRestTimer = useAppStore((state) => state.activeRestTimer);
  const player = useAudioPlayer(timerChime);
  const lastPlayedTimer = useRef<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    }).catch((error) => {
      console.warn("Could not configure rest timer audio.", error);
    });
  }, []);

  useEffect(() => {
    void syncRestTimerNotification(activeRestTimer);
  }, [activeRestTimer]);

  useEffect(() => {
    let cancelled = false;
    let foregroundRevision = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const armForegroundChime = (nextState: AppStateStatus) => {
      const revision = ++foregroundRevision;
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (nextState !== "active") {
        player.pause();
        return;
      }
      if (!activeRestTimer) {
        return;
      }

      const remainingMs = new Date(activeRestTimer.endsAt).getTime() - Date.now();
      // Expired timers restored from storage or the background must not ring again.
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return;
      }

      const timerKey = `${activeRestTimer.setId}:${activeRestTimer.endsAt}`;
      const isCurrentForegroundTimer = () => {
        const currentTimer = useAppStore.getState().activeRestTimer;
        return (
          !cancelled &&
          foregroundRevision === revision &&
          AppState.currentState === "active" &&
          currentTimer?.setId === activeRestTimer.setId &&
          currentTimer?.endsAt === activeRestTimer.endsAt
        );
      };

      timeout = setTimeout(() => {
        if (!isCurrentForegroundTimer() || lastPlayedTimer.current === timerKey) {
          return;
        }

        lastPlayedTimer.current = timerKey;
        void completeForegroundRestTimerAlarm(timerKey).catch((error) => {
          console.warn("Could not cancel completed native rest timer.", error);
        });
        void shouldVibrateForRestTimer()
          .then(async (shouldVibrate) => {
            if (!isCurrentForegroundTimer()) {
              return;
            }
            if (shouldVibrate) {
              Vibration.vibrate([0, 180, 90, 180]);
              return;
            }
            await player.seekTo(0);
            if (isCurrentForegroundTimer()) {
              player.play();
            }
          })
          .catch((error) => {
            console.warn("Could not play rest timer chime.", error);
            if (isCurrentForegroundTimer()) {
              Vibration.vibrate([0, 180, 90, 180]);
            }
          });
      }, remainingMs);
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void dismissRestTimerNotifications();
      }
      armForegroundChime(nextState);
    });
    armForegroundChime(AppState.currentState);

    return () => {
      cancelled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      subscription.remove();
    };
  }, [activeRestTimer, player]);
};
