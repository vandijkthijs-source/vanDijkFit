import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { RestTimerState } from "../../features/workouts/workout.types";
import { configureNotificationHandler } from "./notificationHandler";
import { getRestTimerAlarmModule } from "./restTimerAlarm";

const REST_TIMER_NOTIFICATION_KIND = "rest-timer";
const REST_TIMER_NOTIFICATION_ID = "rest-timer-complete";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null = null;
let notificationOperationQueue: Promise<void> = Promise.resolve();
let syncRevision = 0;
let hasWarnedMissingNativeAlarm = false;

const canUseRestTimerNotifications = () =>
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const enqueueNotificationOperation = (operation: () => Promise<void>) => {
  notificationOperationQueue = notificationOperationQueue
    .then(operation)
    .catch((error) => {
      console.warn("Could not sync rest timer notification.", error);
    });
  return notificationOperationQueue;
};

const getNotificationsModule = async () => {
  if (!canUseRestTimerNotifications()) {
    return null;
  }

  notificationsModule ??= await import("expo-notifications");
  configureNotificationHandler(notificationsModule);

  return notificationsModule;
};

const requestRestTimerNotificationPermission = async (
  notifications: NotificationsModule
) => {
  const existing = await notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  if (AppState.currentState !== "active") {
    return false;
  }

  const requested = await notifications.requestPermissionsAsync();
  return requested.granted;
};

const cancelScheduledRestTimerNotifications = async (
  notifications: NotificationsModule
) => {
  const scheduledNotifications =
    await notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduledNotifications
      .filter(
        (notification) =>
          notification.content.data?.kind === REST_TIMER_NOTIFICATION_KIND
      )
      .map((notification) =>
        notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
};

const dismissPresentedRestTimerNotifications = async (
  notifications: NotificationsModule
) => {
  const presentedNotifications = await notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presentedNotifications
      .filter(
        (notification) =>
          notification.request.content.data?.kind === REST_TIMER_NOTIFICATION_KIND
      )
      .map((notification) =>
        notifications.dismissNotificationAsync(notification.request.identifier)
      )
  );
};

export const dismissRestTimerNotifications = () =>
  enqueueNotificationOperation(async () => {
    const notifications = await getNotificationsModule();
    if (notifications) {
      await dismissPresentedRestTimerNotifications(notifications);
    }
  });

export const syncRestTimerNotification = (
  activeRestTimer: RestTimerState | null
) => {
  const revision = ++syncRevision;

  return enqueueNotificationOperation(async () => {
    const notifications = await getNotificationsModule();
    if (revision !== syncRevision) {
      return;
    }

    if (notifications) {
      await cancelScheduledRestTimerNotifications(notifications);
      await dismissPresentedRestTimerNotifications(notifications);
    }

    if (revision !== syncRevision) {
      return;
    }

    const endsAt = activeRestTimer ? new Date(activeRestTimer.endsAt).getTime() : NaN;
    const hasFutureTimer = activeRestTimer && Number.isFinite(endsAt) && endsAt > Date.now();

    if (Platform.OS === "android") {
      const alarm = getRestTimerAlarmModule();
      if (!alarm) {
        if (activeRestTimer && !hasWarnedMissingNativeAlarm) {
          console.warn("Rebuild the Android app to enable sound-only background rest timers.");
          hasWarnedMissingNativeAlarm = true;
        }
        return;
      }
      if (!hasFutureTimer) {
        await alarm.cancelTimer();
        return;
      }

      const exact = await alarm.scheduleTimer(
        `${activeRestTimer.setId}:${activeRestTimer.endsAt}`,
        endsAt
      );
      if (revision !== syncRevision) {
        await alarm.cancelTimer();
      } else if (!exact && AppState.currentState === "active") {
        await alarm.requestExactAlarmPermission();
      }
      return;
    }

    if (!notifications || !hasFutureTimer) {
      return;
    }

    const granted = await requestRestTimerNotificationPermission(notifications);
    if (!granted || revision !== syncRevision || endsAt <= Date.now()) {
      return;
    }

    await notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_ID,
      content: {
        data: {
          kind: REST_TIMER_NOTIFICATION_KIND,
          setId: activeRestTimer.setId,
        },
        sound: "rest_timer.wav",
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
      },
    });

    if (revision !== syncRevision) {
      await notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID);
    }
  });
};
