import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  activeCount: number;
  children: ReactNode;
};

export default function ExerciseFilters({ activeCount, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeCount > 0 ? `Filter, ${activeCount} active` : "Filter"}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="options-outline" size={18} color={colors.accent} />
        <Text style={styles.label}>Filter{activeCount > 0 ? ` (${activeCount})` : ""}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  button: {
    alignSelf: "flex-start",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  label: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
});
