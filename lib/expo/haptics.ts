import * as Haptics from "expo-haptics";

export const triggerSuccessHaptic = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.log("Haptics error:", error);
  }
};
