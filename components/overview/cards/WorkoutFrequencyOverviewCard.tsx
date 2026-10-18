import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { radii, ThemeColors, useThemeColors } from "../../../constants/theme";
import { useAppStore } from "../../../store/useAppStore";
import { OverviewCardSurface } from "../OverviewCardWrapper";
import { clamp, formatWeekLabel, startOfWeek } from "../overviewUtils";

const goalOptions = Array.from({ length: 20 }, (_, index) => index + 2);
const CHART_HEIGHT = 270;
const CHART_WINDOW_SIZE = 8;
const CHART_DRAG_PREVIEW_LIMIT = 72;
const CHART_TRIGGER_DISTANCE = 24;
const CHART_TRIGGER_VELOCITY = 0.25;

export default function WorkoutFrequencyOverviewCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const history = useAppStore((state) => state.workoutHistory);
  const weeklyWorkoutGoal = useAppStore((state) => state.weeklyWorkoutGoal);
  const setWeeklyWorkoutGoal = useAppStore((state) => state.setWeeklyWorkoutGoal);
  const [isGoalMenuOpen, setIsGoalMenuOpen] = useState(false);
  const [selectedChartWindowIndex, setSelectedChartWindowIndex] = useState(0);
  const chartSlideX = useRef(new Animated.Value(0)).current;
  const chartOpacity = useRef(new Animated.Value(1)).current;
  const isChartAnimatingRef = useRef(false);

  const chartWindowCount = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const oldestSessionTime = history.reduce<number | null>((oldest, session) => {
      const sessionTime = startOfWeek(new Date(session.startedAt)).getTime();
      return oldest === null ? sessionTime : Math.min(oldest, sessionTime);
    }, null);

    if (oldestSessionTime === null) {
      return 1;
    }

    const weekSpan =
      Math.floor(
        (currentWeekStart.getTime() - oldestSessionTime) /
          (7 * 24 * 60 * 60 * 1000)
      ) + 1;

    return Math.max(1, Math.ceil(weekSpan / CHART_WINDOW_SIZE));
  }, [history]);

  useEffect(() => {
    setSelectedChartWindowIndex((current) =>
      Math.min(current, Math.max(chartWindowCount - 1, 0))
    );
  }, [chartWindowCount]);

  const weeklyData = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const windowNewestWeekStart = new Date(currentWeekStart);
    windowNewestWeekStart.setDate(
      currentWeekStart.getDate() -
        selectedChartWindowIndex * CHART_WINDOW_SIZE * 7
    );
    windowNewestWeekStart.setHours(0, 0, 0, 0);

    return Array.from({ length: CHART_WINDOW_SIZE }, (_, index) => {
      const weekStart = new Date(windowNewestWeekStart);
      weekStart.setDate(
        windowNewestWeekStart.getDate() - (CHART_WINDOW_SIZE - 1 - index) * 7
      );
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const count = history.filter((session) => {
        const sessionDate = new Date(session.startedAt);
        return sessionDate >= weekStart && sessionDate < weekEnd;
      }).length;

      return {
        label: formatWeekLabel(weekStart),
        weekStart,
        count,
      };
    });
  }, [history, selectedChartWindowIndex]);

  const selectedChartRangeLabel =
    selectedChartWindowIndex === 0
      ? ""
      : `${formatWeekLabel(weeklyData[0]?.weekStart ?? new Date())} - ${
          formatWeekLabel(weeklyData[weeklyData.length - 1]?.weekStart ?? new Date())
        }`;
  const highestWeekCount = Math.max(0, ...weeklyData.map((item) => item.count));
  const chartMax = Math.max(
    6,
    weeklyWorkoutGoal + 2,
    Math.ceil((highestWeekCount + 1) * 1.2)
  );
  const goalLineBottom = (weeklyWorkoutGoal / chartMax) * CHART_HEIGHT;
  const chartSegmentHeight = CHART_HEIGHT / chartMax;

  const chartPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onPanResponderGrant: () => {
          chartSlideX.stopAnimation();
          chartOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isChartAnimatingRef.current) {
            return;
          }

          const canSwipeOlder = selectedChartWindowIndex < chartWindowCount - 1;
          const canSwipeNewer = selectedChartWindowIndex > 0;
          const intendedDirection =
            gestureState.dx > 0 ? "older" : gestureState.dx < 0 ? "newer" : null;
          const shouldResist =
            (intendedDirection === "older" && !canSwipeOlder) ||
            (intendedDirection === "newer" && !canSwipeNewer);
          const previewX = shouldResist
            ? gestureState.dx * 0.18
            : gestureState.dx * 0.35;
          const limitedX = clamp(
            previewX,
            -CHART_DRAG_PREVIEW_LIMIT,
            CHART_DRAG_PREVIEW_LIMIT
          );
          const distanceRatio = Math.min(
            Math.abs(limitedX) / CHART_DRAG_PREVIEW_LIMIT,
            1
          );

          chartSlideX.setValue(limitedX);
          chartOpacity.setValue(1 - distanceRatio * 0.18);
        },
        onPanResponderRelease: (_, gestureState) => {
          const direction =
            gestureState.dx >= CHART_TRIGGER_DISTANCE ||
            gestureState.vx >= CHART_TRIGGER_VELOCITY
              ? "older"
              : gestureState.dx <= -CHART_TRIGGER_DISTANCE ||
                  gestureState.vx <= -CHART_TRIGGER_VELOCITY
                ? "newer"
                : null;

          if (!direction || isChartAnimatingRef.current) {
            Animated.parallel([
              Animated.spring(chartSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(chartOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          const nextIndex =
            direction === "older"
              ? Math.min(selectedChartWindowIndex + 1, chartWindowCount - 1)
              : Math.max(selectedChartWindowIndex - 1, 0);

          if (nextIndex === selectedChartWindowIndex) {
            Animated.parallel([
              Animated.spring(chartSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(chartOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          isChartAnimatingRef.current = true;

          Animated.parallel([
            Animated.timing(chartSlideX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(chartOpacity, {
              toValue: 0.18,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setSelectedChartWindowIndex(nextIndex);
            chartSlideX.setValue(0);

            Animated.parallel([
              Animated.timing(chartSlideX, {
                toValue: 0,
                duration: 190,
                useNativeDriver: true,
              }),
              Animated.timing(chartOpacity, {
                toValue: 1,
                duration: 190,
                useNativeDriver: true,
              }),
            ]).start(() => {
              isChartAnimatingRef.current = false;
            });
          });
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(chartSlideX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(chartOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [chartOpacity, chartSlideX, chartWindowCount, selectedChartWindowIndex]
  );

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={isGoalMenuOpen}
        onRequestClose={() => setIsGoalMenuOpen(false)}
      >
        <View style={styles.goalMenuModal}>
          <Pressable
            onPress={() => setIsGoalMenuOpen(false)}
            style={styles.goalMenuBackdrop}
          />
          <View style={styles.goalMenuFloating}>
            <Text style={styles.goalMenuTitle}>Weekly goal</Text>
            <ScrollView
              style={styles.goalOptionsScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="always"
            >
              {goalOptions.map((goal) => {
                const selected = goal === weeklyWorkoutGoal;
                return (
                  <Pressable
                    key={goal}
                    onPress={() => {
                      setWeeklyWorkoutGoal(goal);
                      setIsGoalMenuOpen(false);
                    }}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.goalOption,
                      selected && styles.goalOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalOptionText,
                        selected && styles.goalOptionTextSelected,
                      ]}
                    >
                      {goal} workouts
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OverviewCardSurface style={styles.card}>
        <View style={styles.chartTop}>
          <View style={styles.chartTitleWrap}>
            <Text style={styles.chartTitle}>Workouts per week</Text>
            {selectedChartRangeLabel ? (
              <Text style={styles.chartRangeLabel}>{selectedChartRangeLabel}</Text>
            ) : null}
          </View>
          <View style={styles.goalMenuWrap}>
            <Pressable
              onPress={() => setIsGoalMenuOpen((current) => !current)}
              hitSlop={10}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.goalButton,
                pressed && styles.buttonPressed,
              ]}
            >
              {Array.from({ length: 3 }, (_, index) => (
                <View key={index} style={styles.goalDot} />
              ))}
            </Pressable>

            {isGoalMenuOpen ? <View style={styles.goalMenuPlaceholder} /> : null}
          </View>
        </View>

        <Animated.View
          {...chartPanResponder.panHandlers}
          style={[
            styles.chartFrame,
            {
              opacity: chartOpacity,
              transform: [{ translateX: chartSlideX }],
            },
          ]}
        >
          <View style={styles.chartPlotGroup}>
            <View style={styles.plotArea}>
              {Array.from({ length: chartMax + 1 }, (_, level) => (
                <View
                  key={`h-${level}`}
                  pointerEvents="none"
                  style={[
                    styles.horizontalGrid,
                    { bottom: level * chartSegmentHeight },
                  ]}
                />
              ))}

              {Array.from({ length: weeklyData.length + 1 }, (_, index) => (
                <View
                  key={`v-${index}`}
                  pointerEvents="none"
                  style={[
                    styles.verticalGrid,
                    { left: `${(index / weeklyData.length) * 100}%` },
                  ]}
                />
              ))}

              <View
                pointerEvents="none"
                style={[styles.goalLine, { bottom: goalLineBottom }]}
              />

              <View style={styles.barsRow}>
                {weeklyData.map((item) => (
                  <View key={item.label} style={styles.barColumn}>
                    <View style={styles.barZone}>
                      {item.count > 0 ? (
                        <View
                          style={[
                            styles.barStack,
                            { height: item.count * chartSegmentHeight },
                          ]}
                        >
                          {Array.from({ length: item.count }, (_, blockIndex) => (
                            <View
                              key={`${item.label}-${blockIndex}`}
                              style={[
                                styles.barBlock,
                                { height: Math.max(chartSegmentHeight - 2, 0) },
                              ]}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.barLabelsRow}>
              {weeklyData.map((item) => (
                <View key={`label-${item.label}`} style={styles.barLabelColumn}>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View pointerEvents="none" style={styles.axisLabels}>
            <Text style={[styles.goalLineLabel, { bottom: goalLineBottom }]}>
              {weeklyWorkoutGoal}
            </Text>
          </View>
        </Animated.View>
      </OverviewCardSurface>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 18,
    },
    chartTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    chartTitleWrap: {
      flex: 1,
      paddingRight: 12,
    },
    chartTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    chartRangeLabel: {
      color: colors.textSoft,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 5,
    },
    goalMenuWrap: {
      position: "relative",
      zIndex: 2,
    },
    goalMenuModal: {
      flex: 1,
    },
    goalMenuBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    goalMenuFloating: {
      position: "absolute",
      top: 118,
      right: 18,
      width: 188,
      backgroundColor: colors.panelStrong,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      gap: 8,
      maxHeight: 260,
    },
    goalButton: {
      flexDirection: "row",
      gap: 3,
      minWidth: 32,
      minHeight: 32,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    goalDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    goalMenuPlaceholder: {
      position: "absolute",
      top: 30,
      right: 0,
      width: 188,
      height: 1,
    },
    goalMenuTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    goalOptionsScroll: {
      height: 220,
    },
    goalOption: {
      minHeight: 38,
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      alignItems: "flex-start",
      justifyContent: "center",
      overflow: "hidden",
    },
    goalOptionSelected: {
      backgroundColor: colors.accentSoft,
    },
    goalOptionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    goalOptionTextSelected: {
      color: colors.accent,
    },
    chartFrame: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 0,
    },
    chartPlotGroup: {
      flex: 1,
      gap: 10,
    },
    plotArea: {
      flex: 1,
      height: CHART_HEIGHT,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      borderRadius: 14,
      position: "relative",
      overflow: "hidden",
    },
    horizontalGrid: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "rgba(170, 183, 194, 0.12)",
    },
    verticalGrid: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: "rgba(170, 183, 194, 0.08)",
    },
    goalLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.accent,
      zIndex: 2,
    },
    goalLineLabel: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 11,
      position: "absolute",
      left: 10,
      zIndex: 3,
      transform: [{ translateY: 5.5 }],
    },
    axisLabels: {
      width: 14,
      height: CHART_HEIGHT,
      position: "relative",
    },
    barsRow: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "row",
      zIndex: 1,
    },
    barColumn: {
      flex: 1,
      alignItems: "center",
    },
    barZone: {
      flex: 1,
      width: "100%",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    barStack: {
      width: "46%",
      justifyContent: "flex-end",
    },
    barBlock: {
      width: "100%",
      borderRadius: 5,
      backgroundColor: colors.accent,
      marginTop: 1,
      marginBottom: 1,
    },
    barLabel: {
      color: colors.textSoft,
      fontSize: 9,
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
    barLabelsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: -2,
    },
    barLabelColumn: {
      flex: 1,
      alignItems: "center",
    },
    buttonPressed: {
      opacity: 0.96,
    },
  });
