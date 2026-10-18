import { Modal, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import AppButton from "./AppButton";

type InfoModalProps = {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
};

export default function InfoModal({
  visible,
  title,
  message,
  buttonLabel = "Close",
  onClose,
}: InfoModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>
          <AppButton title={buttonLabel} onPress={onClose} />
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
});
