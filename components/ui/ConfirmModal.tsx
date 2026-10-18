import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmTone?: "accent" | "danger";
  cancelTone?: "neutral" | "danger";
  primaryActionFirst?: boolean;
  confirmFlex?: number;
  cancelFlex?: number;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmTone = "accent",
  cancelTone = "neutral",
  primaryActionFirst = false,
  confirmFlex = 1,
  cancelFlex = 1,
}: ConfirmModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const confirmButton = (
    <Pressable
      onPress={onConfirm}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        styles.actionButton,
        { flex: confirmFlex },
        confirmTone === "danger" ? styles.dangerAction : styles.accentAction,
        pressed && styles.glowPressed,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          confirmTone === "danger" && styles.dangerActionText,
        ]}
      >
        {confirmLabel}
      </Text>
    </Pressable>
  );

  const cancelButton = (
    <Pressable
      onPress={onCancel}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        styles.actionButton,
        { flex: cancelFlex },
        cancelTone === "danger" ? styles.dangerAction : styles.secondaryAction,
        pressed && styles.glowPressed,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          cancelTone === "danger" ? styles.dangerActionText : styles.secondaryActionText,
        ]}
      >
        {cancelLabel}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>
          <View style={styles.modalActions}>
            {primaryActionFirst ? confirmButton : cancelButton}
            {primaryActionFirst ? cancelButton : confirmButton}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  modalText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  accentAction: {
    backgroundColor: colors.accent,
  },
  secondaryAction: {
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerAction: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionText: {
    color: colors.text,
  },
  dangerActionText: {
    color: colors.white,
  },
  glowPressed: {
    opacity: 0.92,
  },
});
