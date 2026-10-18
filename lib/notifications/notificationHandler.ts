type NotificationsModule = typeof import("expo-notifications");

let hasConfiguredNotificationHandler = false;

export const configureNotificationHandler = (notifications: NotificationsModule) => {
  if (hasConfiguredNotificationHandler) {
    return;
  }

  notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isRestTimer = notification.request.content.data?.kind === "rest-timer";
      const shouldPresent = !isRestTimer;

      return {
        shouldPlaySound: shouldPresent,
        shouldSetBadge: false,
        shouldShowBanner: shouldPresent,
        shouldShowList: shouldPresent,
      };
    },
  });

  hasConfiguredNotificationHandler = true;
};
