import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Swipeable from "react-native-gesture-handler/Swipeable";
import {
  EquipmentType,
  Exercise,
} from "../../features/exercises/exercise.types";
import { useAppStore } from "../../store/useAppStore";
import ExerciseLibraryScope from "../../components/exercise/ExerciseLibraryScope";
import { getExerciseRecency, selectLibraryExercises } from "../../features/exercises/exercise-library";
import AppInput from "../../components/ui/AppInput";
import { equipmentOptions, muscleOptions } from "../../constants/exercise-options";
import {
  aggregateToMajorMuscleContributions,
  MAJOR_MUSCLE_LABELS,
  MajorMuscleGroupKey,
} from "../../constants/muscles";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { formatMuscleSplitSummary, titleCase } from "../../utils/format";

type ExerciseRowProps = {
  exercise: Exercise;
  onPress: () => void;
  onEdit: () => void;
};

const ExerciseRow = memo(({ exercise, onPress, onEdit }: ExerciseRowProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Swipeable
      overshootRight={false}
      rightThreshold={28}
      renderRightActions={() => (
        <View style={styles.editAction}>
          <Ionicons name="create-outline" size={18} color={colors.white} />
          <Text style={styles.editActionText}>Edit</Text>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === "right") {
          onEdit();
        }
      }}
    >
      <Pressable
        onPress={onPress}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [styles.row, pressed && styles.glowPressed]}
      >
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.isCustom && !exercise.isModified ? (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>CUSTOM</Text>
              </View>
            ) : null}
            {exercise.isModified ? (
              <View style={styles.editedBadge}>
                <Text style={styles.editedBadgeText}>EDITED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.exerciseMeta}>
            {formatMuscleSplitSummary(exercise.muscleContributions)}  |  {titleCase(exercise.equipment)}  |  {exercise.defaultRestSeconds ?? 90}s rest
          </Text>
        </View>
        <Ionicons name="add" size={20} color={colors.accent} />
      </Pressable>
    </Swipeable>
  );
});

ExerciseRow.displayName = "ExerciseRow";

export default function WorkoutExercisePickerScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const exercises = useAppStore((state) => state.exercises);
  const workoutHistory = useAppStore((state) => state.workoutHistory);
  const addExerciseToActiveWorkout = useAppStore((state) => state.addExerciseToActiveWorkout);
  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MajorMuscleGroupKey | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null);

  const [showAll, setShowAll] = useState(false);
  const recency = useMemo(() => getExerciseRecency(workoutHistory), [workoutHistory]);
  const filteredExercises = useMemo(
    () => selectLibraryExercises(exercises, query, showAll, recency).filter((exercise) => {
      if (selectedEquipment && exercise.equipment !== selectedEquipment) return false;
      if (!selectedMuscle) return true;
      const contributions = aggregateToMajorMuscleContributions(exercise.muscleContributions);
      return (contributions[selectedMuscle] ?? 0) > 0;
    }),
    [exercises, query, showAll, recency, selectedEquipment, selectedMuscle]
  );

  const handleSelect = useCallback(
    (exerciseId: string) => {
      addExerciseToActiveWorkout(exerciseId);
      router.back();
    },
    [addExerciseToActiveWorkout]
  );

  const handleEdit = useCallback((exerciseId: string) => {
    router.push({
      pathname: "/exercises/create",
      params: { exerciseId },
    });
  }, []);

  const renderExerciseItem = useCallback<ListRenderItem<Exercise>>(
    ({ item }) => (
      <ExerciseRow
        exercise={item}
        onPress={() => handleSelect(item.id)}
        onEdit={() => handleEdit(item.id)}
      />
    ),
    [handleEdit, handleSelect]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <FlatList
        style={styles.scroll}
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseItem}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={8}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <>
            <View style={styles.toolbar}>
              <Pressable
                onPress={() => router.back()}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.closeButton, pressed && styles.glowPressed]}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/exercises/create")}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.newButton, pressed && styles.glowPressed]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.newButtonText}>New</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>Add exercises</Text>

            <AppInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search all exercises"
              style={styles.searchInput}
            />

            <ExerciseLibraryScope showAll={showAll} onChange={setShowAll} searching={Boolean(query.trim())} />

            <View style={styles.filtersWrap}>
              <Text style={styles.filterLabel}>Muscle group</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <Pressable
                  onPress={() => setSelectedMuscle(null)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selectedMuscle === null && styles.filterChipActive,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedMuscle === null && styles.filterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>

                {muscleOptions.map((muscle) => {
                  const active = selectedMuscle === muscle;
                  return (
                    <Pressable
                      key={muscle}
                      onPress={() => setSelectedMuscle(active ? null : muscle)}
                      android_ripple={{ color: colors.ripple }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        active && styles.filterChipActive,
                        pressed && styles.glowPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {MAJOR_MUSCLE_LABELS[muscle]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.filterLabel}>Equipment</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <Pressable
                  onPress={() => setSelectedEquipment(null)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selectedEquipment === null && styles.filterChipActive,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedEquipment === null && styles.filterChipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>

                {equipmentOptions.map((equipment) => {
                  const active = selectedEquipment === equipment;
                  return (
                    <Pressable
                      key={equipment}
                      onPress={() => setSelectedEquipment(active ? null : equipment)}
                      android_ripple={{ color: colors.ripple }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        active && styles.filterChipActive,
                        pressed && styles.glowPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {titleCase(equipment)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {query.trim() ? "Search results" : "Recently used first"}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>
              Try another search or create a new exercise.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "400",
    marginBottom: 18,
  },
  searchInput: {
    marginBottom: 14,
  },
  filtersWrap: {
    marginBottom: 20,
    gap: 8,
  },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  filterChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.accent,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  rowText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  customBadge: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  customBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  editedBadge: {
    backgroundColor: "rgba(248, 201, 106, 0.16)",
    borderWidth: 1,
    borderColor: "#f8c96a",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editedBadgeText: {
    color: "#f8c96a",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  exerciseMeta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  editAction: {
    width: 108,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  editActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
});
