import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MUSCLE_LABELS } from "../../constants/muscles";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import {
  calculatePerformedExerciseVolume,
  calculateSessionMuscleVolumes,
} from "../../features/body-map/muscle-score.utils";
import { useAppStore } from "../../store/useAppStore";
import { formatSessionDuration, titleCase } from "../../utils/format";

const formatNumber = (value: number) => Math.round(value).toLocaleString();

export default function WorkoutFinishedScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const workoutHistory = useAppStore((state) => state.workoutHistory);
  const exercises = useAppStore((state) => state.exercises);
  const introProgress = useRef(new Animated.Value(0)).current;

  const session = useMemo(
    () => workoutHistory.find((item) => item.id === sessionId),
    [sessionId, workoutHistory]
  );

  const summary = useMemo(() => {
    if (!session) {
      return {
        completedSets: 0,
        exerciseCount: 0,
        volume: 0,
        topMuscles: [] as Array<{
          key: string;
          label: string;
          volume: number;
          ratio: number;
        }>,
      };
    }

    const completedSets = session.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
    );
    const volume = session.exercises.reduce((total, performedExercise) => {
      const exercise =
        performedExercise.exerciseSnapshot ??
        exercises.find((item) => item.id === performedExercise.exerciseId);

      return exercise
        ? total + calculatePerformedExerciseVolume(session, performedExercise, exercise)
        : total;
    }, 0);
    const muscleVolumes = calculateSessionMuscleVolumes(session, exercises);
    const peakMuscleVolume = Math.max(0, ...Object.values(muscleVolumes));
    const topMuscles = Object.entries(muscleVolumes)
      .filter(([, muscleVolume]) => muscleVolume > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, muscleVolume]) => ({
        key,
        label: MUSCLE_LABELS[key] ?? titleCase(key),
        volume: muscleVolume,
        ratio: peakMuscleVolume > 0 ? muscleVolume / peakMuscleVolume : 0,
      }));

    return {
      completedSets,
      exerciseCount: session.exercises.length,
      volume,
      topMuscles,
    };
  }, [exercises, session]);

  useEffect(() => {
    Animated.timing(introProgress, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [introProgress]);

  const contentStyle = {
    opacity: introProgress,
    transform: [
      {
        translateY: introProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  const closeHeader = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close workout summary"
        onPress={() => router.replace("/(tabs)/today")}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>
    </View>
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        {closeHeader}
        <View style={styles.missingState}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          <Text style={styles.missingTitle}>Workout saved</Text>
          <Text style={styles.missingText}>
            The workout is in your history, but this summary could not be loaded.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      {closeHeader}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.hero}>
            <View style={styles.checkRing}>
              <Ionicons name="checkmark" size={44} color={colors.white} />
            </View>
            <Text style={styles.kicker}>Workout complete</Text>
            <Text style={styles.title}>
              {session.templateName?.trim() || "Open Workout"}
            </Text>
            <Text style={styles.subtitle}>
              Nice work. This session has been saved to your history.
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>
                {formatSessionDuration(session.startedAt, session.endedAt)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Sets</Text>
              <Text style={styles.summaryValue}>{summary.completedSets}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Volume</Text>
              <Text style={styles.summaryValue}>{formatNumber(summary.volume)} kg</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Exercises</Text>
              <Text style={styles.summaryValue}>{summary.exerciseCount}</Text>
            </View>
          </View>

          {summary.topMuscles.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Muscles hit</Text>
              <View style={styles.muscleList}>
                {summary.topMuscles.map((muscle) => (
                  <View key={muscle.key} style={styles.muscleRow}>
                    <View style={styles.muscleHeader}>
                      <Text style={styles.muscleName}>{muscle.label}</Text>
                      <Text style={styles.muscleValue}>
                        {formatNumber(muscle.volume)} kg
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(8, muscle.ratio * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: "flex-end",
    paddingHorizontal: 18,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 18,
    paddingBottom: 34,
  },
  content: {
    gap: 16,
  },
  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
  },
  checkRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    marginBottom: 16,
    shadowColor: colors.success,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    width: "48.5%",
    minHeight: 88,
    justifyContent: "space-between",
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  section: {
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  muscleList: {
    gap: 12,
  },
  muscleRow: {
    gap: 7,
  },
  muscleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  muscleName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  muscleValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  barTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.input,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.92,
  },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 14,
  },
  missingText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
  },
});
