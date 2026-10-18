import { NativeModules, Platform } from "react-native";

type RestTimerAlarmModule = {
  scheduleTimer(timerKey: string, endsAt: number): Promise<boolean>;
  cancelTimer(): Promise<void>;
  cancelTimerForKey(timerKey: string): Promise<void>;
  shouldVibrate(): Promise<boolean>;
  requestExactAlarmPermission(): Promise<boolean>;
};

export const getRestTimerAlarmModule = (): RestTimerAlarmModule | undefined =>
  Platform.OS === "android" ? NativeModules.RestTimerAlarm : undefined;

export const shouldVibrateForRestTimer = async (): Promise<boolean> => {
  const alarm = getRestTimerAlarmModule();
  return alarm ? alarm.shouldVibrate() : false;
};

export const completeForegroundRestTimerAlarm = async (timerKey: string): Promise<void> => {
  const alarm = getRestTimerAlarmModule();
  if (alarm) {
    await alarm.cancelTimerForKey(timerKey);
  }
};
