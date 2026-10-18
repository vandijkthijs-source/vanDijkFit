import { StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import AppInput from "../ui/AppInput";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  name: string;
  notes: string;
  defaultRestSeconds: string;
  onChangeName: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangeDefaultRestSeconds: (value: string) => void;
};

export default function ExerciseForm({
  name,
  notes,
  defaultRestSeconds,
  onChangeName,
  onChangeNotes,
  onChangeDefaultRestSeconds,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Exercise name</Text>
        <AppInput placeholder="Cable Fly" value={name} onChangeText={onChangeName} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Coaching notes</Text>
        <AppInput
          placeholder="Bench angle, cues, or progression ideas"
          value={notes}
          onChangeText={onChangeNotes}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Default rest (seconds)</Text>
        <AppInput
          placeholder="90"
          value={defaultRestSeconds}
          onChangeText={onChangeDefaultRestSeconds}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: 14,
  },
  card: {
    gap: 10,
    backgroundColor: colors.panel,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  notes: {
    minHeight: 100,
    textAlignVertical: "top",
  },
});
