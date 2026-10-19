import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  showAll: boolean;
  onChange: (showAll: boolean) => void;
  searching: boolean;
};

export default function ExerciseLibraryScope({ showAll, onChange, searching }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Exercise library">
        {[{ label: "Curated", value: false }, { label: "All Exercises", value: true }].map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: showAll === option.value }}
            aria-checked={showAll === option.value}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: colors.ripple }}
            style={[styles.option, showAll === option.value && styles.active]}
          >
            <Text style={[styles.label, showAll === option.value && styles.activeLabel]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {searching ? "Searching all exercises" : showAll ? "Full library · recently used first" : "175 selected exercises + your custom exercises · recently used first"}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: 8,
    marginVertical: 12,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  active: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  activeLabel: {
    color: colors.accent,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
