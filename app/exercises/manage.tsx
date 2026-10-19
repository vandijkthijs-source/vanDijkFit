import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useAppStore } from "../../store/useAppStore";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { formatMuscleSplitSummary, titleCase } from "../../utils/format";
import { Exercise } from "../../features/exercises/exercise.types";
import { showAlert } from "../../lib/ui/alert";
import { REPDB_CREDIT, REPDB_URL } from "../../features/exercises/repdb-catalog";

import type { ExerciseCategory } from "../../features/exercises/exercise-category";
import ExerciseLibraryScope from "../../components/exercise/ExerciseLibraryScope";
import { getExerciseRecency, selectLibraryExercises } from "../../features/exercises/exercise-library";

type ExerciseListItemProps = {
  exercise: Exercise;
  timesDone: number;
  onRemove: (exerciseId: string, exerciseName: string) => void;
};

const ExerciseListItem = memo(function ExerciseListItem({
  exercise,
  timesDone,
  onRemove,
}: ExerciseListItemProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Swipeable
      overshootRight={false}
      rightThreshold={28}
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <Ionicons name="trash-outline" size={18} color={colors.white} />
          <Text style={styles.deleteActionText}>Delete</Text>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === "right") {
          onRemove(exercise.id, exercise.name);
        }
      }}
    >
      <View style={styles.exerciseCard}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/exercises/[exerciseId]",
              params: { exerciseId: exercise.id },
            })
          }
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.exerciseDetailsButton,
            pressed && styles.glowPressed,
          ]}
        >
          <View style={styles.exerciseCopy}>
            <View style={styles.exerciseNameRow}>
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
              {formatMuscleSplitSummary(exercise.muscleContributions)} |{" "}
              {titleCase(exercise.equipment)}
            </Text>
            {timesDone > 0 ? (
              <Text style={styles.exerciseUsage}>
                Done {timesDone} {timesDone === 1 ? "time" : "times"}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/exercises/create",
              params: { exerciseId: exercise.id },
            })
          }
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.exerciseEditButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="create-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>
    </Swipeable>
  );
});

export default function ManageExercisesScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const exercises = useAppStore((state) => state.exercises);
  const workoutHistory = useAppStore((state) => state.workoutHistory);
  const removeCustomExercise = useAppStore((state) => state.removeCustomExercise);
  const [query, setQuery] = useState("");

  const [category, setCategory] = useState<ExerciseCategory>("strength");
  const recency = useMemo(() => getExerciseRecency(workoutHistory), [workoutHistory]);

  const doneCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const session of workoutHistory) {
      for (const performedExercise of session.exercises) {
        counts.set(
          performedExercise.exerciseId,
          (counts.get(performedExercise.exerciseId) ?? 0) + 1
        );
      }
    }

    return counts;
  }, [workoutHistory]);

  const visibleExercises = useMemo(
    () => selectLibraryExercises(exercises, query, category, recency),
    [exercises, query, category, recency]
  );

  const handleRemove = useCallback((exerciseId: string, exerciseName: string) => {
    showAlert(
      "Remove exercise?",
      `Delete "${exerciseName}" from your exercise list?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeCustomExercise(exerciseId),
        },
      ]
    );
  }, [removeCustomExercise]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace("/(tabs)/today");
          }}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/exercises/create")}
          android_ripple={{ color: colors.ripple }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>CREATE</Text>
        </Pressable>
      </View>

      <FlatList
        data={visibleExercises}
        keyExtractor={(exercise) => exercise.id}
        renderItem={({ item }) => (
          <ExerciseListItem
            exercise={item}
            timesDone={doneCounts.get(item.id) ?? 0}
            onRemove={handleRemove}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.title}>Manage Exercises</Text>
            <Text style={styles.subtitle}>
              Edit your exercise library or create a new movement.
            </Text>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textSoft} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search all ${category} exercises`}
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  android_ripple={{ color: colors.ripple, borderless: true }}
                  style={styles.clearSearchButton}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <ExerciseLibraryScope category={category} onChange={setCategory} searching={Boolean(query.trim())} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No exercises found.</Text>
          </View>
        }
        ListFooterComponent={
          <Text
            style={styles.credit}
            accessibilityRole="link"
            onPress={() => Linking.openURL(REPDB_URL)}
          >
            {REPDB_CREDIT}
          </Text>
        }
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        scrollsToTop={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  credit: {
    marginTop: 20,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  addButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  listHeader: {
    gap: 10,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  searchBox: {
    minHeight: 46,
    marginTop: 6,
    backgroundColor: colors.input,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    overflow: "hidden",
  },
  emptyState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  listSeparator: {
    height: 10,
  },
  exerciseCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    minHeight: 92,
  },
  exerciseDetailsButton: {
    flexBasis: "85%",
    flexGrow: 1,
    flexShrink: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exerciseEditButton: {
    flexBasis: "15%",
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  exerciseName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
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
    marginTop: 4,
    fontSize: 14,
  },
  exerciseUsage: {
    color: colors.textSoft,
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  deleteAction: {
    width: 108,
    borderRadius: radii.lg,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  buttonPressed: {
    opacity: 0.96,
  },
});
