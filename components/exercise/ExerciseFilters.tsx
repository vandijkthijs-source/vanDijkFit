import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

import { exerciseSortOptions, type ExerciseSortOrder } from "../../features/exercises/exercise-sort";

type Props = {
  sort: ExerciseSortOrder;
  onSortChange: (sort: ExerciseSortOrder) => void;
  activeCount: number;
  children: ReactNode;
};

export default function ExerciseFilters({ activeCount, children, sort, onSortChange }: Props) {
  const [panel, setPanel] = useState<"Filter" | "Sort" | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <View style={styles.buttons}>
        {(["Filter", "Sort"] as const).map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label === "Filter" && activeCount > 0 ? `Filter, ${activeCount} active` : label}
            accessibilityState={{ expanded: panel === label }}
            aria-expanded={panel === label}
            onPress={() => setPanel((value) => value === label ? null : label)}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Ionicons name={label === "Filter" ? "options-outline" : "swap-vertical-outline"} size={18} color={colors.accent} />
            <Text style={styles.label}>{label}{label === "Filter" && activeCount > 0 ? ` (${activeCount})` : ""}</Text>
            <Ionicons name={panel === label ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      {panel === "Filter" ? children : null}
      {panel === "Sort" ? (
        <View style={styles.sortOptions} accessibilityRole="radiogroup" accessibilityLabel="Sort exercises">
          {exerciseSortOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: sort === option.value }}
              aria-checked={sort === option.value}
              onPress={() => onSortChange(option.value)}
              android_ripple={{ color: colors.ripple }}
              style={[styles.button, sort === option.value && styles.active]}
            >
              <Text style={styles.label}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sortOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  active: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
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
