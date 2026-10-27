import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { calculateMuscleVolumeProgress } from "../../features/body-map/muscle-score.utils";
import { MUSCLE_LABELS } from "../../constants/muscles";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import InfoModal from "../../components/ui/InfoModal";
import Svg, { G, Path } from "react-native-svg";
import {
  FRONT_MAP_LAYER_TRANSLATE,
  FRONT_MAP_VIEWBOX,
  frontMapRegions,
} from "../../features/body-map/front-map-regions";
import {
  BACK_MAP_LAYER_TRANSLATE,
  BACK_MAP_VIEWBOX,
  backMapRegions,
} from "../../features/body-map/back-map-regions";

const frontImage = require("../../assets/body-map/front-man.png");
const backImage = require("../../assets/body-map/back-man.png");

const MAP_WIDTH = 160;
const MAP_HEIGHT = 420;
const HEATMAP_DRAG_PREVIEW_LIMIT = 72;
const HEATMAP_TRIGGER_DISTANCE = 24;
const HEATMAP_TRIGGER_VELOCITY = 0.25;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatWeekLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });

const formatRangeLabel = (targetDate: Date) => {
  const rangeStart = new Date(targetDate);
  rangeStart.setDate(targetDate.getDate() - 6);

  return `${formatWeekLabel(rangeStart)} - ${formatWeekLabel(targetDate)}`;
};

const getRegionHeatMap = (
  regions: { label: string; muscles: string[] }[],
  progressMap: Map<
    string,
    {
      currentVolume: number;
      benchmarkVolume: number;
      ratio: number;
      isNewPr: boolean;
      hasBenchmark: boolean;
    }
  >
) =>
  new Map(
    regions.map((region) => {
      const matchedProgress = region.muscles
        .map((muscle) => progressMap.get(muscle))
        .filter(Boolean);
      const regionRatio = matchedProgress.reduce(
        (highest, item) =>
          Math.max(
            highest,
            (item?.currentVolume ?? 0) > 0 && !item?.hasBenchmark
              ? 1
              : item?.ratio ?? 0
          ),
        0
      );
      const hasNewPr = matchedProgress.some((item) => item?.isNewPr);
      const normalizedRatio = Math.min(regionRatio, 1.25);
      const opacity =
        normalizedRatio > 0
          ? Math.min(0.14 + normalizedRatio * 0.46, 0.8)
          : 0;

      return [
        region.label,
        {
          opacity,
          fill: hasNewPr
            ? "#ff394f"
            : "#f13e50",
        },
      ] as const;
    })
  );

export default function BodyMapScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const exercises = useAppStore((state) => state.exercises);
  const history = useAppStore((state) => state.workoutHistory);
  const [showBack, setShowBack] = useState(false);
  const [selectedHeatmapDateIndex, setSelectedHeatmapDateIndex] = useState(0);
  const [helpModalContent, setHelpModalContent] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const heatmapSlideX = useRef(new Animated.Value(0)).current;
  const heatmapOpacity = useRef(new Animated.Value(1)).current;
  const isHeatmapAnimatingRef = useRef(false);

  const heatmapDates = useMemo(() => {
    const currentDay = startOfDay(new Date());
    const dayTimes = new Set([currentDay.getTime()]);

    history.forEach((session) => {
      dayTimes.add(startOfDay(new Date(session.startedAt)).getTime());
    });

    return [...dayTimes]
      .sort((a, b) => b - a)
      .map((time) => new Date(time));
  }, [history]);
  const selectedHeatmapDate =
    heatmapDates[selectedHeatmapDateIndex] ?? startOfDay(new Date());
  const selectedHeatmapWeekLabel =
    selectedHeatmapDateIndex === 0 ? "" : formatRangeLabel(selectedHeatmapDate);

  useEffect(() => {
    setSelectedHeatmapDateIndex((current) =>
      Math.min(current, Math.max(heatmapDates.length - 1, 0))
    );
  }, [heatmapDates.length]);

  const progress = calculateMuscleVolumeProgress(
    history,
    exercises,
    selectedHeatmapDate
  );
  const heatmapPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onPanResponderGrant: () => {
          heatmapSlideX.stopAnimation();
          heatmapOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isHeatmapAnimatingRef.current) {
            return;
          }

          const canSwipeOlder = selectedHeatmapDateIndex < heatmapDates.length - 1;
          const canSwipeNewer = selectedHeatmapDateIndex > 0;
          const intendedDirection =
            gestureState.dx > 0 ? "older" : gestureState.dx < 0 ? "newer" : null;

          const shouldResist =
            (intendedDirection === "older" && !canSwipeOlder) ||
            (intendedDirection === "newer" && !canSwipeNewer);

          const previewX = shouldResist ? gestureState.dx * 0.18 : gestureState.dx * 0.35;
          const limitedX = clamp(
            previewX,
            -HEATMAP_DRAG_PREVIEW_LIMIT,
            HEATMAP_DRAG_PREVIEW_LIMIT
          );
          const distanceRatio = Math.min(
            Math.abs(limitedX) / HEATMAP_DRAG_PREVIEW_LIMIT,
            1
          );

          heatmapSlideX.setValue(limitedX);
          heatmapOpacity.setValue(1 - distanceRatio * 0.18);
        },
        onPanResponderRelease: (_, gestureState) => {
          const direction =
            gestureState.dx >= HEATMAP_TRIGGER_DISTANCE ||
            gestureState.vx >= HEATMAP_TRIGGER_VELOCITY
              ? "older"
              : gestureState.dx <= -HEATMAP_TRIGGER_DISTANCE ||
                  gestureState.vx <= -HEATMAP_TRIGGER_VELOCITY
                ? "newer"
                : null;

          if (!direction || isHeatmapAnimatingRef.current) {
            Animated.parallel([
              Animated.spring(heatmapSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(heatmapOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          const nextIndex =
            direction === "older"
              ? Math.min(selectedHeatmapDateIndex + 1, heatmapDates.length - 1)
              : Math.max(selectedHeatmapDateIndex - 1, 0);

          if (nextIndex === selectedHeatmapDateIndex) {
            Animated.parallel([
              Animated.spring(heatmapSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(heatmapOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          isHeatmapAnimatingRef.current = true;

          Animated.parallel([
            Animated.timing(heatmapSlideX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(heatmapOpacity, {
              toValue: 0.18,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setSelectedHeatmapDateIndex(nextIndex);
            heatmapSlideX.setValue(0);

            Animated.parallel([
              Animated.timing(heatmapSlideX, {
                toValue: 0,
                duration: 190,
                useNativeDriver: true,
              }),
              Animated.timing(heatmapOpacity, {
                toValue: 1,
                duration: 190,
                useNativeDriver: true,
              }),
            ]).start(() => {
              isHeatmapAnimatingRef.current = false;
            });
          });
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(heatmapSlideX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(heatmapOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [
      heatmapOpacity,
      heatmapSlideX,
      heatmapDates.length,
      selectedHeatmapDateIndex,
    ]
  );
  const progressMap = new Map(progress.map((entry) => [entry.key, entry]));
  const frontRegionHeatMap = getRegionHeatMap(frontMapRegions, progressMap);
  const backRegionHeatMap = getRegionHeatMap(backMapRegions, progressMap);
  const entries = Object.entries(MUSCLE_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      volume: progressMap.get(key)?.currentVolume ?? 0,
      benchmarkVolume: progressMap.get(key)?.benchmarkVolume ?? 0,
      currentSessionCount: progressMap.get(key)?.currentSessionCount ?? 0,
      benchmarkSessionCount: progressMap.get(key)?.benchmarkSessionCount ?? 0,
    }))
    .sort((a, b) => b.volume - a.volume);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Body Heatmap</Text>
          <Pressable
            onPress={() =>
              setHelpModalContent({
                title: "Body heatmap",
                message:
                  "The heatmap compares each muscle's last 7 days of volume to its own benchmark. Brighter red means that muscle is closer to or above its benchmark. Muscles with training volume but no earlier benchmark are shown as having reached their benchmark. Swipe left or right to compare date ranges, and switch between front and back views.",
              })
            }
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.helpButton,
              pressed && styles.helpButtonPressed,
            ]}
          >
            <Text style={styles.helpButtonText}>?</Text>
          </Pressable>
        </View>

        <View style={styles.mapCard} {...heatmapPanResponder.panHandlers}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapEyebrow}>MUSCLES TRAINED</Text>
            <Text style={styles.mapHint}>{showBack ? "Back" : "Front"}</Text>
          </View>

          <Animated.View
            style={[
              styles.heatmapSwipeContent,
              {
                opacity: heatmapOpacity,
                transform: [{ translateX: heatmapSlideX }],
              },
            ]}
          >
            {selectedHeatmapWeekLabel ? (
              <Text style={styles.heatmapWeekLabel}>{selectedHeatmapWeekLabel}</Text>
            ) : null}

            <View style={styles.figureCard}>
              <View style={styles.figureWrap}>
                <Image
                  source={showBack ? backImage : frontImage}
                  style={styles.figureImage}
                  resizeMode="contain"
                />
                {!showBack ? (
                  <Svg
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    viewBox={`0 0 ${FRONT_MAP_VIEWBOX.width} ${FRONT_MAP_VIEWBOX.height}`}
                    style={styles.heatmapOverlay}
                  >
                    <G transform={`translate(${FRONT_MAP_LAYER_TRANSLATE})`}>
                      {frontMapRegions.map((region) => {
                        const heat = frontRegionHeatMap.get(region.label);
                        return (
                          <Path
                            key={region.label}
                            d={region.d}
                            fill={heat?.fill ?? "#f13e50"}
                            opacity={heat?.opacity ?? 0}
                          />
                        );
                      })}
                    </G>
                  </Svg>
                ) : (
                  <Svg
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    viewBox={`0 0 ${BACK_MAP_VIEWBOX.width} ${BACK_MAP_VIEWBOX.height}`}
                    style={styles.heatmapOverlay}
                  >
                    <G transform={`translate(${BACK_MAP_LAYER_TRANSLATE})`}>
                      {backMapRegions.map((region) => {
                        const heat = backRegionHeatMap.get(region.label);
                        return (
                          <Path
                            key={region.label}
                            d={region.d}
                            fill={heat?.fill ?? "#f13e50"}
                            opacity={heat?.opacity ?? 0}
                          />
                        );
                      })}
                    </G>
                  </Svg>
                )}
              </View>
            </View>
          </Animated.View>

          <Pressable
            onPress={() => setShowBack((current) => !current)}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.switchButton,
              pressed && styles.switchButtonPressed,
            ]}
          >
            <Text style={styles.switchButtonText}>
              {showBack ? "SHOW FRONT" : "SHOW BACK"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listEyebrow}>MUSCLE VOLUME</Text>
              <Pressable
                onPress={() =>
                  setHelpModalContent({
                    title: "Muscle volume",
                    message:
                      "Each muscle uses its own scale. The yellow marker is a frequency-aware benchmark: it first uses earlier 7-day periods with the same number of muscle-training sessions. If there is not enough matching history, it uses your median volume per session multiplied by the current session count.",
                  })
                }
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.helpButton,
                  pressed && styles.helpButtonPressed,
                ]}
              >
                <Text style={styles.helpButtonText}>?</Text>
              </Pressable>
            </View>
          </View>

          {entries.map((entry) => {
            const rowPeak = Math.max(entry.volume, entry.benchmarkVolume, 1);

            return (
              <View key={entry.key} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.label}>{entry.label}</Text>
                  <Text style={styles.value}>
                    {Math.round(entry.volume)} kg · {entry.currentSessionCount}x
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width:
                          entry.volume > 0
                            ? `${Math.max((entry.volume / rowPeak) * 100, 6)}%`
                            : "0%",
                        opacity: entry.volume > 0 ? 1 : 0.22,
                      },
                    ]}
                  />
                  {entry.benchmarkVolume > 0 ? (
                    <View
                      style={[
                        styles.previousBestMarker,
                        {
                          left: `${Math.min(
                            (entry.benchmarkVolume / rowPeak) * 100,
                            98
                          )}%`,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <InfoModal
        visible={helpModalContent !== null}
        title={helpModalContent?.title ?? ""}
        message={helpModalContent?.message ?? ""}
        onClose={() => setHelpModalContent(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 18,
    paddingBottom: 112,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  helpButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  helpButtonPressed: {
    opacity: 0.96,
  },
  helpButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  mapCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  mapHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  heatmapWeekLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  heatmapSwipeContent: {
    overflow: "hidden",
  },
  figureCard: {
    alignItems: "center",
    paddingVertical: 6,
  },
  figureWrap: {
    position: "relative",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    alignSelf: "center",
  },
  figureImage: {
    width: "100%",
    height: "100%",
  },
  heatmapOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  switchButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  switchButtonPressed: {
    opacity: 0.96,
  },
  switchButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  listCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  listHeader: {
    gap: 4,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  row: {
    gap: 8,
  },
  rowText: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.text,
    fontWeight: "600",
  },
  value: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  barTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.panelStrong,
    overflow: "hidden",
    position: "relative",
  },
  barFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: "#e8314a",
  },
  previousBestMarker: {
    position: "absolute",
    top: -1,
    bottom: -1,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#f8c96a",
  },
});
