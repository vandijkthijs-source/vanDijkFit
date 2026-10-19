import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ExerciseImages from "../../components/exercise/ExerciseImages";
import ExerciseForm from "../../components/exercise/ExerciseForm";
import AppInput from "../../components/ui/AppInput";
import { useAppStore } from "../../store/useAppStore";
import { showAlert } from "../../lib/ui/alert";
import { exercisesSeed } from "../../data/exercises.seed";
import { EquipmentType, MuscleGroup } from "../../features/exercises/exercise.types";
import { equipmentOptions, muscleOptions } from "../../constants/exercise-options";
import {
  aggregateToMajorMuscleContributions,
  expandMajorMuscleContributions,
  MAJOR_MUSCLE_LABELS,
  MajorMuscleGroupKey,
} from "../../constants/muscles";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { titleCase } from "../../utils/format";

const toPercentInputs = (
  contributions?: Partial<Record<MajorMuscleGroupKey, number>>
): Partial<Record<MajorMuscleGroupKey, string>> =>
  Object.fromEntries(
    Object.entries(contributions ?? {})
      .filter(([, value]) => typeof value === "number" && value > 0)
      .map(([muscle, value]) => [
        muscle,
        `${Math.round((value as number) * 100)}`,
      ])
  ) as Partial<Record<MajorMuscleGroupKey, string>>;

const getEffectivePercentages = (
  selectedMuscles: MajorMuscleGroupKey[],
  musclePercentages: Partial<Record<MajorMuscleGroupKey, string>>
) => {
  if (selectedMuscles.length === 0) {
    return {} as Partial<Record<MajorMuscleGroupKey, number>>;
  }

  if (selectedMuscles.length === 1) {
    return {
      [selectedMuscles[0]]: 100,
    } as Partial<Record<MajorMuscleGroupKey, number>>;
  }

  const lockedMuscle = selectedMuscles[selectedMuscles.length - 1];
  const editableMuscles = selectedMuscles.slice(0, -1);
  const editableTotal = editableMuscles.reduce((total, muscle) => {
    const value = Number(musclePercentages[muscle] ?? "0");
    return total + (Number.isFinite(value) ? Math.max(0, value) : 0);
  }, 0);
  const lockedValue = Math.max(0, 100 - editableTotal);

  return Object.fromEntries(
    selectedMuscles.map((muscle) => [
      muscle,
      muscle === lockedMuscle
        ? lockedValue
        : Math.max(0, Number(musclePercentages[muscle] ?? "0")),
    ])
  ) as Partial<Record<MajorMuscleGroupKey, number>>;
};

const createEqualPercentages = (selectedMuscles: MajorMuscleGroupKey[]) => {
  if (selectedMuscles.length === 0) {
    return {} as Partial<Record<MajorMuscleGroupKey, string>>;
  }

  const baseValue = Math.floor(100 / selectedMuscles.length);
  const remainder = 100 - baseValue * selectedMuscles.length;

  return Object.fromEntries(
    selectedMuscles.map((muscle, index) => [
      muscle,
      `${baseValue + (index === selectedMuscles.length - 1 ? remainder : 0)}`,
    ])
  ) as Partial<Record<MajorMuscleGroupKey, string>>;
};

const getComparableExerciseShape = (exercise?: {
  name: string;
  notes?: string;
  equipment: EquipmentType;
  defaultRestSeconds?: number;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  muscleContributions: Partial<Record<MuscleGroup, number>>;
}) => {
  if (!exercise) {
    return null;
  }

  return {
    name: exercise.name,
    notes: exercise.notes ?? "",
    equipment: exercise.equipment,
    defaultRestSeconds: exercise.defaultRestSeconds ?? 90,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: [...exercise.secondaryMuscles].sort(),
    muscleContributions: Object.fromEntries(
      Object.entries(exercise.muscleContributions ?? {}).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    ),
  };
};

export default function CreateExerciseScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const exercises = useAppStore((state) => state.exercises);
  const addCustomExercise = useAppStore((state) => state.addCustomExercise);
  const updateCustomExercise = useAppStore((state) => state.updateCustomExercise);
  const revertExerciseToSeed = useAppStore((state) => state.revertExerciseToSeed);

  const existingExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === exerciseId),
    [exerciseId, exercises]
  );
  const seedExercise = useMemo(
    () => exercisesSeed.find((exercise) => exercise.id === exerciseId),
    [exerciseId]
  );
  const isEditing = Boolean(existingExercise);
  const canRevertToStandard = Boolean(
    existingExercise &&
      seedExercise &&
      !existingExercise.isCustom &&
      JSON.stringify(getComparableExerciseShape(existingExercise)) !==
        JSON.stringify(getComparableExerciseShape(seedExercise))
  );

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [equipment, setEquipment] = useState<EquipmentType | null>(null);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState("90");
  const [selectedMuscles, setSelectedMuscles] = useState<MajorMuscleGroupKey[]>([]);
  const [musclePercentages, setMusclePercentages] = useState<
    Partial<Record<MajorMuscleGroupKey, string>>
  >({});

  useEffect(() => {
    if (!existingExercise) {
      setName("");
      setNotes("");
      setEquipment(null);
      setDefaultRestSeconds("90");
      setSelectedMuscles([]);
      setMusclePercentages({});
      return;
    }

    const existingMajorContributions = aggregateToMajorMuscleContributions(
      existingExercise.muscleContributions
    );
    const existingMuscles = Object.entries(existingMajorContributions)
      .filter(([, value]) => typeof value === "number" && value > 0)
      .map(([muscle]) => muscle as MajorMuscleGroupKey);

    setName(existingExercise.name);
    setNotes(existingExercise.notes ?? "");
    setEquipment(existingExercise.equipment);
    setDefaultRestSeconds(`${existingExercise.defaultRestSeconds ?? 90}`);
    setSelectedMuscles(existingMuscles.length > 0 ? existingMuscles : ["chest"]);
    setMusclePercentages(
      existingMuscles.length > 0
        ? toPercentInputs(existingMajorContributions)
        : { chest: "100" }
    );
  }, [existingExercise]);

  const effectivePercentages = getEffectivePercentages(selectedMuscles, musclePercentages);
  const totalPercentage = Object.values(effectivePercentages).reduce(
    (total, value) => total + (value ?? 0),
    0
  );

  const toggleMuscle = (muscle: MajorMuscleGroupKey) => {
    setSelectedMuscles((current) => {
      const next = current.includes(muscle)
        ? current.filter((item) => item !== muscle)
        : [...current, muscle];

      setMusclePercentages(createEqualPercentages(next));
      return next;
    });
  };

  const handleChangePercentage = (muscle: MajorMuscleGroupKey, value: string) => {
    const lockedMuscle = selectedMuscles[selectedMuscles.length - 1];
    if (selectedMuscles.length > 1 && muscle === lockedMuscle) {
      return;
    }

    const cleanValue = value.replace(/[^\d]/g, "").slice(0, 3);
    const parsedValue = Math.min(100, Number(cleanValue || "0"));
    const otherEditableTotal = selectedMuscles
      .filter((item) => item !== muscle)
      .slice(0, -1)
      .reduce((total, item) => {
        const currentValue = Number(musclePercentages[item] ?? "0");
        return total + (Number.isFinite(currentValue) ? currentValue : 0);
      }, 0);
    const maxAllowed = Math.max(0, 100 - otherEditableTotal);
    const nextValue = `${Math.min(parsedValue, maxAllowed)}`;

    setMusclePercentages((current) => ({
      ...current,
      [muscle]: cleanValue === "" ? "" : nextValue,
    }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      showAlert("Missing name", "Please enter an exercise name.");
      return;
    }

    if (selectedMuscles.length === 0) {
      showAlert("No muscles selected", "Select at least one muscle group.");
      return;
    }

    if (!equipment) {
      showAlert("Missing equipment", "Please select an equipment type.");
      return;
    }

    const restValue = Number(defaultRestSeconds);
    const majorMuscleContributions = Object.fromEntries(
      selectedMuscles.map((muscle) => [
        muscle,
        (effectivePercentages[muscle] ?? 0) / 100,
      ])
    ) as Partial<Record<MajorMuscleGroupKey, number>>;
    const muscleContributions = expandMajorMuscleContributions(
      majorMuscleContributions
    );
    const sortedMuscles = Object.entries(muscleContributions)
      .filter(([, value]) => typeof value === "number" && value > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([muscle]) => muscle as MuscleGroup);

    if (sortedMuscles.length === 0) {
      showAlert("No muscles selected", "Select at least one muscle group.");
      return;
    }
    const nextExercise = {
      name: name.trim(),
      notes: notes.trim(),
      isCustom: existingExercise?.isCustom ?? true,
      isModified: existingExercise
        ? existingExercise.isCustom
          ? existingExercise.isModified ?? false
          : true
        : false,
      primaryMuscle: sortedMuscles[0],
      secondaryMuscles: sortedMuscles.slice(1),
      equipment,
      defaultRestSeconds: Number.isFinite(restValue) ? restValue : 90,
      muscleContributions,
    };

    if (existingExercise) {
      updateCustomExercise(existingExercise.id, nextExercise);
    } else {
      addCustomExercise(nextExercise);
    }

    router.back();
  };

  const handleRevert = () => {
    if (!existingExercise || !canRevertToStandard) {
      return;
    }

    showAlert(
      "Revert to standard?",
      "This will restore the original built-in exercise setup.",
      [
        { text: "Keep edits", style: "cancel" },
        {
          text: "Revert",
          style: "destructive",
          onPress: () => {
            revertExerciseToSeed(existingExercise.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/workout");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <View style={styles.topBar}>
        <View />
        <Pressable
          onPress={handleClose}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.glowPressed]}
        >
          <Text style={styles.cancelButtonText}>CANCEL</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <Text style={styles.title}>{isEditing ? "Edit Exercise" : "Create Exercise"}</Text>
        <Text style={styles.subtitle}>
          Add custom movements with muscles trained and default rest.
        </Text>

        {existingExercise ? <ExerciseImages exercise={existingExercise} /> : null}

        <ExerciseForm
          name={name}
          notes={notes}
          defaultRestSeconds={defaultRestSeconds}
          onChangeName={setName}
          onChangeNotes={setNotes}
          onChangeDefaultRestSeconds={setDefaultRestSeconds}
        />

        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>Muscles trained</Text>
            <Text style={styles.groupMeta}>{totalPercentage}% total</Text>
          </View>
          <View style={styles.chipWrap}>
            {muscleOptions.map((option) => {
              const selected = selectedMuscles.includes(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => toggleMuscle(option)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {MAJOR_MUSCLE_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedMuscles.length > 0 ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Training split (%)</Text>
            <View style={styles.splitCard}>
              {selectedMuscles.map((muscle) => (
                <View key={muscle} style={styles.splitRow}>
                  <Text style={styles.splitLabel}>{MAJOR_MUSCLE_LABELS[muscle]}</Text>
                  <View style={styles.percentInputWrap}>
                    <AppInput
                      value={`${effectivePercentages[muscle] ?? 0}`}
                      onChangeText={(value) => handleChangePercentage(muscle, value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      editable={
                        selectedMuscles.length <= 1 ||
                        muscle !== selectedMuscles[selectedMuscles.length - 1]
                      }
                      style={[
                        styles.percentInput,
                        selectedMuscles.length > 1 &&
                          muscle === selectedMuscles[selectedMuscles.length - 1] &&
                          styles.percentInputLocked,
                      ]}
                    />
                    <Text style={styles.percentSign}>%</Text>
                  </View>
                </View>
              ))}
            </View>
            {selectedMuscles.length > 1 ? (
              <Text style={styles.splitHint}>
                The last muscle auto-balances the split to keep the total at 100%.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Equipment</Text>
          <View style={styles.chipWrap}>
            {equipmentOptions.map((option) => {
              const selected = option === equipment;
              return (
                <Pressable
                  key={option}
                  onPress={() =>
                    setEquipment((current) => (current === option ? null : option))
                  }
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {titleCase(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.saveButton, pressed && styles.glowPressed]}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? "SAVE CHANGES" : "SAVE EXERCISE"}
          </Text>
        </Pressable>

        {canRevertToStandard ? (
          <Pressable
            onPress={handleRevert}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [styles.revertButton, pressed && styles.glowPressed]}
          >
            <Text style={styles.revertButtonText}>REVERT TO STANDARD</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  cancelButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
    gap: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: -8,
    lineHeight: 20,
  },
  group: {
    gap: 10,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  groupMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.accent,
  },
  splitCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  splitLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  percentInputWrap: {
    width: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  percentInput: {
    flex: 1,
    textAlign: "center",
  },
  percentInputLocked: {
    opacity: 0.72,
  },
  percentSign: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  splitHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  revertButton: {
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  revertButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
