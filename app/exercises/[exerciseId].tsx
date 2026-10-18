import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useAppStore } from "../../store/useAppStore";
import { formatMuscleSplitSummary, titleCase } from "../../utils/format";
import { calculatePerformedExerciseVolume } from "../../features/body-map/muscle-score.utils";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { PerformedExercise, WorkoutSession } from "../../features/workouts/workout.types";

type ExerciseHistoryEntry = {
  session: WorkoutSession;
  performedExercise: PerformedExercise;
  volume: number;
};

const LINE_CHART_WIDTH = 320;
const LINE_CHART_HEIGHT = 168;
const LINE_CHART_PADDING_TOP = 12;
const LINE_CHART_PADDING_RIGHT = 40;
const LINE_CHART_PADDING_BOTTOM = 24;
const LINE_CHART_PADDING_LEFT = 6;

const startOfMonth = (date: Date) => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const addMonths = (date: Date, offset: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + offset);
  return startOfMonth(result);
};

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRollingThreeMonthDates = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = addMonths(startOfMonth(today), -2);
  const dates: Date[] = [];

  for (const cursor = new Date(rangeStart); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(new Date(cursor));
  }

  return dates;
};

const formatSessionDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function ExerciseDetailScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const exercises = useAppStore((state) => state.exercises);
  const workoutHistory = useAppStore((state) => state.workoutHistory);

  const exercise = exercises.find((item) => item.id === exerciseId);

  const entries = useMemo<ExerciseHistoryEntry[]>(() => {
    return workoutHistory
      .flatMap((session) =>
        session.exercises
          .filter((performedExercise) => performedExercise.exerciseId === exerciseId)
          .map((performedExercise) => ({
            session,
            performedExercise,
            volume: calculatePerformedExerciseVolume(
              session,
              performedExercise,
              performedExercise.exerciseSnapshot ?? exercise ?? { equipment: "other" }
            ),
          }))
      )
      .sort(
        (a, b) =>
          new Date(b.session.startedAt).getTime() -
          new Date(a.session.startedAt).getTime()
      );
  }, [exercise, exerciseId, workoutHistory]);

  const chartDates = useMemo(getRollingThreeMonthDates, []);
  const chartStart = chartDates[0];
  const chartEnd = chartDates[chartDates.length - 1];

  const chartData = useMemo(() => {
    const volumesByDate = new Map<string, number>();
    const firstDateKey = formatLocalDateKey(chartStart);
    const lastDateKey = formatLocalDateKey(chartEnd);

    for (const entry of entries) {
      const sessionDate = new Date(entry.session.startedAt);
      if (Number.isNaN(sessionDate.getTime())) {
        continue;
      }

      const dateKey = formatLocalDateKey(sessionDate);
      if (dateKey < firstDateKey || dateKey > lastDateKey) {
        continue;
      }

      volumesByDate.set(dateKey, (volumesByDate.get(dateKey) ?? 0) + entry.volume);
    }

    return chartDates.map((date, index) => {
      const dateKey = formatLocalDateKey(date);
      return {
        index,
        dateKey,
        dateIso: date.toISOString(),
        volume: volumesByDate.get(dateKey) ?? 0,
      };
    });
  }, [chartDates, chartEnd, chartStart, entries]);

  const heaviestKgChartData = useMemo(() => {
    const heaviestByDate = new Map<string, number>();
    const firstDateKey = formatLocalDateKey(chartStart);
    const lastDateKey = formatLocalDateKey(chartEnd);

    for (const entry of entries) {
      const sessionDate = new Date(entry.session.startedAt);
      if (Number.isNaN(sessionDate.getTime())) {
        continue;
      }

      const dateKey = formatLocalDateKey(sessionDate);
      if (dateKey < firstDateKey || dateKey > lastDateKey) {
        continue;
      }

      const heaviestInEntry = entry.performedExercise.sets.reduce<number | null>(
        (best, set) => {
          if (set.completed === false || set.weight == null) {
            return best;
          }

          return best == null ? set.weight : Math.max(best, set.weight);
        },
        null
      );

      if (heaviestInEntry == null) {
        continue;
      }

      heaviestByDate.set(
        dateKey,
        Math.max(heaviestByDate.get(dateKey) ?? 0, heaviestInEntry)
      );
    }

    return chartDates.map((date, index) => {
      const dateKey = formatLocalDateKey(date);
      return {
        index,
        dateKey,
        dateIso: date.toISOString(),
        kg: heaviestByDate.get(dateKey) ?? 0,
      };
    });
  }, [chartDates, chartEnd, chartStart, entries]);

  const heaviestSet = entries.reduce<{ weight: number; reps: number | null } | undefined>(
    (best, entry) => {
      for (const set of entry.performedExercise.sets) {
        if (set.completed === false || set.weight == null) {
          continue;
        }

        if (
          !best ||
          set.weight > best.weight ||
          (set.weight === best.weight && (set.reps ?? 0) > (best.reps ?? 0))
        ) {
          best = {
            weight: set.weight,
            reps: set.reps,
          };
        }
      }

      return best;
    },
    undefined
  );
  const heaviestEntryKey = entries.find((entry) =>
    entry.performedExercise.sets.some(
      (set) =>
        set.completed !== false &&
        set.weight != null &&
        set.weight === heaviestSet?.weight
    )
  );
  const maxVolume = Math.max(...chartData.map((item) => item.volume), 1);
  const bestEntry = entries.reduce<ExerciseHistoryEntry | undefined>(
    (best, entry) => (!best || entry.volume > best.volume ? entry : best),
    undefined
  );
  const chartPlotWidth =
    LINE_CHART_WIDTH - LINE_CHART_PADDING_LEFT - LINE_CHART_PADDING_RIGHT;
  const chartPlotHeight =
    LINE_CHART_HEIGHT - LINE_CHART_PADDING_TOP - LINE_CHART_PADDING_BOTTOM;
  const linePoints = chartData
    .filter((item) => item.volume > 0)
    .map((item) => {
      const denominator = Math.max(chartData.length - 1, 1);
      const x =
        LINE_CHART_PADDING_LEFT + (item.index / denominator) * chartPlotWidth;
      const y =
        LINE_CHART_PADDING_TOP +
        chartPlotHeight -
        (item.volume / maxVolume) * chartPlotHeight;

      return `${x},${y}`;
    })
    .join(" ");
  const activePoints = chartData
    .map((item) => {
      if (item.volume <= 0) return null;

      const denominator = Math.max(chartData.length - 1, 1);
      const x =
        LINE_CHART_PADDING_LEFT + (item.index / denominator) * chartPlotWidth;
      const y =
        LINE_CHART_PADDING_TOP +
        chartPlotHeight -
        (item.volume / maxVolume) * chartPlotHeight;

      return { ...item, x, y };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const rangeVolume = chartData.reduce((total, item) => total + item.volume, 0);
  const axisTicks = [1, 0.75, 0.5, 0.25].map((ratio) => ({
    ratio,
    label: Math.round(maxVolume * ratio),
  }));
  const maxHeaviestKg = Math.max(...heaviestKgChartData.map((item) => item.kg), 1);
  const heaviestKgLinePoints = heaviestKgChartData
    .filter((item) => item.kg > 0)
    .map((item) => {
      const denominator = Math.max(heaviestKgChartData.length - 1, 1);
      const x =
        LINE_CHART_PADDING_LEFT + (item.index / denominator) * chartPlotWidth;
      const y =
        LINE_CHART_PADDING_TOP +
        chartPlotHeight -
        (item.kg / maxHeaviestKg) * chartPlotHeight;

      return `${x},${y}`;
    })
    .join(" ");
  const heaviestKgActivePoints = heaviestKgChartData
    .map((item) => {
      if (item.kg <= 0) return null;

      const denominator = Math.max(heaviestKgChartData.length - 1, 1);
      const x =
        LINE_CHART_PADDING_LEFT + (item.index / denominator) * chartPlotWidth;
      const y =
        LINE_CHART_PADDING_TOP +
        chartPlotHeight -
        (item.kg / maxHeaviestKg) * chartPlotHeight;

      return { ...item, x, y };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const heaviestKgAxisTicks = [1, 0.75, 0.5, 0.25].map((ratio) => ({
    ratio,
    label: Math.round(maxHeaviestKg * ratio),
  }));
  const hasHeaviestKgInRange = heaviestKgChartData.some((item) => item.kg > 0);
  const xAxisLabels = [0, 1, 2].map((monthOffset, index) => ({
    label: addMonths(chartStart, monthOffset).toLocaleDateString(undefined, {
      month: "short",
    }),
    x: LINE_CHART_PADDING_LEFT + (index / 2) * chartPlotWidth,
    anchor: (index === 0 ? "start" : index === 2 ? "end" : "middle") as
      | "start"
      | "middle"
      | "end",
  }));

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Exercise not found</Text>
          <Pressable
            onPress={() => router.back()}
            android_ripple={{ color: colors.ripple }}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>GO BACK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/exercises/create",
              params: { exerciseId: exercise.id },
            })
          }
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="create-outline" size={18} color={colors.accent} />
          <Text style={styles.editButtonText}>EDIT</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.subtitle}>
            {formatMuscleSplitSummary(exercise.muscleContributions)} |{" "}
            {titleCase(exercise.equipment)}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {heaviestSet ? Math.round(heaviestSet.weight) : 0}
            </Text>
            <Text style={styles.statLabel}>Heaviest kg</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round(bestEntry?.volume ?? 0)}</Text>
            <Text style={styles.statLabel}>Highest volume</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Volume history</Text>
            <Text style={styles.sectionMeta}>Past 3 months</Text>
          </View>
          <View style={styles.chartCard}>
            {rangeVolume > 0 ? (
              <View style={styles.chartSwipeContent}>
                <Svg
                  width="100%"
                  height={LINE_CHART_HEIGHT}
                  viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}
                  pointerEvents="none"
                >
                  {axisTicks.map((tick) => {
                    const y =
                      LINE_CHART_PADDING_TOP +
                      chartPlotHeight -
                      tick.ratio * chartPlotHeight;

                    return (
                      <G key={`grid-${tick.ratio}`}>
                        <Line
                          x1={LINE_CHART_PADDING_LEFT}
                          y1={y}
                          x2={LINE_CHART_WIDTH - LINE_CHART_PADDING_RIGHT}
                          y2={y}
                          stroke="#3a434b"
                          strokeWidth={1}
                          strokeDasharray="3 5"
                          opacity={0.54}
                        />
                        <SvgText
                          x={LINE_CHART_WIDTH - LINE_CHART_PADDING_RIGHT + 10}
                          y={y + 4}
                          fill={colors.textMuted}
                          fontSize={10}
                          fontWeight="700"
                          textAnchor="start"
                        >
                          {tick.label}
                        </SvgText>
                      </G>
                    );
                  })}
                  {[0, 0.5, 1].map((ratio) => {
                    const x = LINE_CHART_PADDING_LEFT + ratio * chartPlotWidth;

                    return (
                      <Line
                        key={`vertical-grid-${ratio}`}
                        x1={x}
                        y1={LINE_CHART_PADDING_TOP}
                        x2={x}
                        y2={LINE_CHART_PADDING_TOP + chartPlotHeight}
                        stroke="#3a434b"
                        strokeWidth={1}
                        strokeDasharray="2 6"
                        opacity={0.3}
                      />
                    );
                  })}
                  <Polyline
                    points={linePoints}
                    fill="none"
                    stroke="#b987ff"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {activePoints.map((point) => (
                    <Circle
                      key={`point-${point.dateKey}`}
                      cx={point.x}
                      cy={point.y}
                      r={3.8}
                      fill={colors.panel}
                      stroke="#b987ff"
                      strokeWidth={2}
                    />
                  ))}
                  {xAxisLabels.map((label) => (
                    <SvgText
                      key={`axis-${label.label}-${label.x}`}
                      x={label.x}
                      y={LINE_CHART_HEIGHT - 5}
                      fill={colors.textMuted}
                      fontSize={10}
                      fontWeight="700"
                      textAnchor={label.anchor}
                    >
                      {label.label}
                    </SvgText>
                  ))}
                </Svg>
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="analytics-outline" size={24} color={colors.textSoft} />
                <Text style={styles.emptyText}>No volume logged in the past 3 months.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Heaviest kg history</Text>
            <Text style={styles.sectionMeta}>Past 3 months</Text>
          </View>
          <View style={styles.chartCard}>
            {hasHeaviestKgInRange ? (
              <View style={styles.chartSwipeContent}>
                <Svg
                  width="100%"
                  height={LINE_CHART_HEIGHT}
                  viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}
                  pointerEvents="none"
                >
                  {heaviestKgAxisTicks.map((tick) => {
                    const y =
                      LINE_CHART_PADDING_TOP +
                      chartPlotHeight -
                      tick.ratio * chartPlotHeight;

                    return (
                      <G key={`kg-grid-${tick.ratio}`}>
                        <Line
                          x1={LINE_CHART_PADDING_LEFT}
                          y1={y}
                          x2={LINE_CHART_WIDTH - LINE_CHART_PADDING_RIGHT}
                          y2={y}
                          stroke="#3a434b"
                          strokeWidth={1}
                          strokeDasharray="3 5"
                          opacity={0.54}
                        />
                        <SvgText
                          x={LINE_CHART_WIDTH - LINE_CHART_PADDING_RIGHT + 10}
                          y={y + 4}
                          fill={colors.textMuted}
                          fontSize={10}
                          fontWeight="700"
                          textAnchor="start"
                        >
                          {tick.label}
                        </SvgText>
                      </G>
                    );
                  })}
                  {[0, 0.5, 1].map((ratio) => {
                    const x = LINE_CHART_PADDING_LEFT + ratio * chartPlotWidth;

                    return (
                      <Line
                        key={`kg-vertical-grid-${ratio}`}
                        x1={x}
                        y1={LINE_CHART_PADDING_TOP}
                        x2={x}
                        y2={LINE_CHART_PADDING_TOP + chartPlotHeight}
                        stroke="#3a434b"
                        strokeWidth={1}
                        strokeDasharray="2 6"
                        opacity={0.3}
                      />
                    );
                  })}
                  <Polyline
                    points={heaviestKgLinePoints}
                    fill="none"
                    stroke={colors.warning}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {heaviestKgActivePoints.map((point) => (
                    <Circle
                      key={`kg-point-${point.dateKey}`}
                      cx={point.x}
                      cy={point.y}
                      r={3.8}
                      fill={colors.panel}
                      stroke={colors.warning}
                      strokeWidth={2}
                    />
                  ))}
                  {xAxisLabels.map((label) => (
                    <SvgText
                      key={`kg-axis-${label.label}-${label.x}`}
                      x={label.x}
                      y={LINE_CHART_HEIGHT - 5}
                      fill={colors.textMuted}
                      fontSize={10}
                      fontWeight="700"
                      textAnchor={label.anchor}
                    >
                      {label.label}
                    </SvgText>
                  ))}
                </Svg>
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="analytics-outline" size={24} color={colors.textSoft} />
                <Text style={styles.emptyText}>
                  No heaviest weight logged in the past 3 months.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past exercises</Text>
          {entries.length > 0 ? (
            entries.map((entry) => {
              const isHeaviestEntry =
                entry.session.id === heaviestEntryKey?.session.id &&
                entry.performedExercise.id === heaviestEntryKey.performedExercise.id;

              return (
                <Pressable
                  key={`${entry.session.id}-${entry.performedExercise.id}`}
                  onPress={() =>
                    router.push({
                      pathname: "/history/[sessionId]",
                      params: { sessionId: entry.session.id },
                    })
                  }
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.historyCard,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <View style={styles.historyTopRow}>
                    <View style={styles.historyCopy}>
                      <View style={styles.historyTitleRow}>
                        <Text style={styles.historyTitle}>
                          {entry.session.templateName?.trim() || "Open Workout"}
                        </Text>
                        {isHeaviestEntry ? (
                          <View style={styles.heaviestBadge}>
                            <Ionicons name="barbell-outline" size={13} color={colors.warning} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.historyDate}>
                        {formatSessionDate(entry.session.startedAt)}
                      </Text>
                    </View>
                    <View style={styles.volumePill}>
                      <Text style={styles.volumePillText}>{Math.round(entry.volume)} kg</Text>
                    </View>
                  </View>
                  <Text style={styles.setSummary}>
                    {entry.performedExercise.sets.filter((set) => set.completed !== false)
                      .length > 0
                      ? entry.performedExercise.sets
                          .filter((set) => set.completed !== false)
                          .map((set, index, completedSets) => {
                            const isHeaviestWeight =
                              set.weight != null && set.weight === heaviestSet?.weight;
                            const reps = set.reps == null ? "-" : `${set.reps} reps`;

                            return (
                              <Text key={set.id}>
                                {set.weight == null ? (
                                  "-"
                                ) : (
                                  <Text
                                    style={
                                      isHeaviestWeight
                                        ? styles.heaviestSetWeight
                                        : undefined
                                    }
                                  >
                                    {set.weight} kg
                                  </Text>
                                )}
                                {" x "}
                                {reps}
                                {index < completedSets.length - 1 ? "  |  " : ""}
                              </Text>
                            );
                          })
                      : "No completed sets"}
                  </Text>
                  {entry.performedExercise.notes?.trim() ? (
                    <Text style={styles.notes}>{entry.performedExercise.notes.trim()}</Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyText}>
                Finished workouts with this exercise will show up here.
              </Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  editButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  container: {
    padding: 18,
    paddingBottom: 42,
  },
  header: {
    marginBottom: 18,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 12,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  section: {
    marginTop: 6,
    marginBottom: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chartCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    overflow: "hidden",
  },
  chartSwipeContent: {
    gap: 8,
  },
  chartSummaryRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingLeft: 4,
  },
  chartSummaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  chartSummaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  lineLabelsRow: {
    marginLeft: LINE_CHART_PADDING_LEFT,
    marginRight: LINE_CHART_PADDING_RIGHT,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  lineLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyChart: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historyCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    overflow: "hidden",
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  historyCopy: {
    flex: 1,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  historyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  heaviestBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 199, 108, 0.14)",
    borderWidth: 1,
    borderColor: colors.warning,
  },
  historyDate: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  volumePill: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  volumePillText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  setSummary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  heaviestSetWeight: {
    color: colors.warning,
    fontWeight: "800",
  },
  notes: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  emptyHistory: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 18,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  emptyButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  buttonPressed: {
    opacity: 0.96,
  },
});
