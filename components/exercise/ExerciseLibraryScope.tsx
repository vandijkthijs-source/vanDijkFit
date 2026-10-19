import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

import { exerciseCategories, type ExerciseCategory } from "../../features/exercises/exercise-category";

type Props = {
  category: ExerciseCategory;
  onChange: (category: ExerciseCategory) => void;
};

export default function ExerciseLibraryScope({ category, onChange }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Exercise category">
        {exerciseCategories.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === option.value }}
            aria-checked={category === option.value}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: colors.ripple }}
            style={[styles.option, category === option.value && styles.active]}
          >
            <Text style={[styles.label, category === option.value && styles.activeLabel]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
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
});
