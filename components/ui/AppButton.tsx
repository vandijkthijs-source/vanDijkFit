import { Pressable, StyleSheet, Text } from "react-native";
import { ReactNode, useMemo } from "react";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export default function AppButton({ title, onPress, disabled }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.96,
    shadowColor: colors.white,
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
