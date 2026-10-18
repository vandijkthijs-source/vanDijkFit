import {
  Alert,
  AlertButton,
  AlertOptions,
  Platform,
} from "react-native";

export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const content = [title, message].filter(Boolean).join("\n\n");
  const cancelButton = buttons?.find((button) => button.style === "cancel");
  const actionButtons =
    buttons?.filter((button) => button.style !== "cancel") ?? [];

  if (actionButtons.length === 1 && cancelButton) {
    if (globalThis.confirm(content)) {
      actionButtons[0].onPress?.();
    } else {
      cancelButton.onPress?.();
    }
    return;
  }

  globalThis.alert(content);
  actionButtons[0]?.onPress?.();
  options?.onDismiss?.();
};
