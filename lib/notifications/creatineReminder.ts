import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { configureNotificationHandler } from "./notificationHandler";

const CREATINE_CHANNEL_ID = "creatine-reminders";

type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationId: string | string[] | null;
  creatineLogs: Record<string, number>;
};

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null = null;

export const canUseCreatineReminders = () =>
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const getNotificationsModule = async () => {
  if (!canUseCreatineReminders()) {
    return null;
  }

  notificationsModule ??= await import("expo-notifications");
  configureNotificationHandler(notificationsModule);

  return notificationsModule;
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getReminderDate = (dayOffset: number, hour: number, minute: number) => {
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + dayOffset);
  reminderDate.setHours(hour, minute, 0, 0);

  return reminderDate;
};

const cancelExistingReminder = async (
  notificationId: string | string[] | null
) => {
  try {
    const notifications = await getNotificationsModule();
    if (!notifications) {
      return;
    }

    const scheduledNotifications =
      await notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduledNotifications
        .filter(
          (notification) =>
            notification.content.data?.kind === "creatine-reminder"
        )
        .map((notification) =>
          notifications.cancelScheduledNotificationAsync(
            notification.identifier
          )
        )
    );

    if (!notificationId) {
      return;
    }

    const notificationIds = Array.isArray(notificationId)
      ? notificationId
      : [notificationId];

    await Promise.all(
      notificationIds.map((id) =>
        notifications.cancelScheduledNotificationAsync(id)
      )
    );
  } catch (error) {
    console.warn("Could not cancel creatine reminder notification.", error);
  }
};

const ensureNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  const notifications = await getNotificationsModule();
  if (!notifications) {
    return;
  }

  await notifications.setNotificationChannelAsync(CREATINE_CHANNEL_ID, {
    name: "Creatine reminders",
    importance: notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
  });
};

export const requestCreatineReminderPermission = async () => {
  const notifications = await getNotificationsModule();
  if (!notifications) {
    return false;
  }

  const existing = await notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await notifications.requestPermissionsAsync();
  return requested.granted;
};

export const syncCreatineReminderNotification = async ({
  enabled,
  hour,
  minute,
  notificationId,
  creatineLogs,
}: ReminderSettings) => {
  await cancelExistingReminder(notificationId);

  if (!enabled) {
    return null;
  }

  const notifications = await getNotificationsModule();
  if (!notifications) {
    return null;
  }

  const granted = await requestCreatineReminderPermission();
  if (!granted) {
    return null;
  }

  await ensureNotificationChannel();

  const now = new Date();
  const notificationIds: string[] = [];

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const reminderDate = getReminderDate(dayOffset, hour, minute);
    const dateKey = getLocalDateKey(reminderDate);
    const hasCreatineLogged = (creatineLogs[dateKey] ?? 0) > 0;

    if (hasCreatineLogged || reminderDate <= now) {
      continue;
    }

    const scheduledId = await notifications.scheduleNotificationAsync({
      content: {
        title: "Creatine check",
        body: "Have you taken your creatine today?",
        data: { screen: "overview", kind: "creatine-reminder", dateKey },
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: CREATINE_CHANNEL_ID,
      },
    });

    notificationIds.push(scheduledId);
  }

  return notificationIds;
};
