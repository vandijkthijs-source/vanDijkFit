import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";
import { calculateMajorMuscleVolumeComparisons } from "../../../features/body-map/muscle-score.utils";
import { radii, ThemeColors, useThemeColors } from "../../../constants/theme";
import { useAppStore } from "../../../store/useAppStore";
import InfoModal from "../../ui/InfoModal";
import { OverviewCardSurface } from "../OverviewCardWrapper";
import { clamp, formatWeekRangeLabel, startOfWeek } from "../overviewUtils";

const RADAR_SIZE = 250;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 82;
const RADAR_LEVELS = [0.25, 0.5, 0.75, 1];
const RADAR_MAX_RATIO = 1.1;
const RADAR_DRAG_PREVIEW_LIMIT = 72;
const RADAR_TRIGGER_DISTANCE = 24;
const RADAR_TRIGGER_VELOCITY = 0.25;

export default function MuscleBalanceOverviewCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const history = useAppStore((state) => state.workoutHistory);
  const exercises = useAppStore((state) => state.exercises);
  const [selectedRadarWeekIndex, setSelectedRadarWeekIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const radarSlideX = useRef(new Animated.Value(0)).current;
  const radarOpacity = useRef(new Animated.Value(1)).current;
  const isRadarAnimatingRef = useRef(false);

  const radarWeeks = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const weekTimes = new Set([currentWeekStart.getTime()]);

    history.forEach((session) => {
      weekTimes.add(startOfWeek(new Date(session.startedAt)).getTime());
    });

    return [...weekTimes]
      .sort((a, b) => b - a)
      .map((time) => new Date(time));
  }, [history]);

  const selectedRadarWeek = radarWeeks[selectedRadarWeekIndex] ?? startOfWeek(new Date());
  const selectedRadarWeekLabel =
    selectedRadarWeekIndex === 0 ? "" : formatWeekRangeLabel(selectedRadarWeek);

  useEffect(() => {
    setSelectedRadarWeekIndex((current) =>
      Math.min(current, Math.max(radarWeeks.length - 1, 0))
    );
  }, [radarWeeks.length]);

  const radarData = useMemo(
    () => calculateMajorMuscleVolumeComparisons(history, exercises, selectedRadarWeek),
    [exercises, history, selectedRadarWeek]
  );

  const radarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1,
        onPanResponderGrant: () => {
          radarSlideX.stopAnimation();
          radarOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isRadarAnimatingRef.current) {
            return;
          }

          const canSwipeOlder = selectedRadarWeekIndex < radarWeeks.length - 1;
          const canSwipeNewer = selectedRadarWeekIndex > 0;
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
            -RADAR_DRAG_PREVIEW_LIMIT,
            RADAR_DRAG_PREVIEW_LIMIT
          );
          const distanceRatio = Math.min(
            Math.abs(limitedX) / RADAR_DRAG_PREVIEW_LIMIT,
            1
          );

          radarSlideX.setValue(limitedX);
          radarOpacity.setValue(1 - distanceRatio * 0.18);
        },
        onPanResponderRelease: (_, gestureState) => {
          const direction =
            gestureState.dx >= RADAR_TRIGGER_DISTANCE ||
            gestureState.vx >= RADAR_TRIGGER_VELOCITY
              ? "older"
              : gestureState.dx <= -RADAR_TRIGGER_DISTANCE ||
                  gestureState.vx <= -RADAR_TRIGGER_VELOCITY
                ? "newer"
                : null;

          if (!direction || isRadarAnimatingRef.current) {
            Animated.parallel([
              Animated.spring(radarSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(radarOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          const nextIndex =
            direction === "older"
              ? Math.min(selectedRadarWeekIndex + 1, radarWeeks.length - 1)
              : Math.max(selectedRadarWeekIndex - 1, 0);

          if (nextIndex === selectedRadarWeekIndex) {
            Animated.parallel([
              Animated.spring(radarSlideX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.timing(radarOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          isRadarAnimatingRef.current = true;

          Animated.parallel([
            Animated.timing(radarSlideX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(radarOpacity, {
              toValue: 0.18,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setSelectedRadarWeekIndex(nextIndex);
            radarSlideX.setValue(0);

            Animated.parallel([
              Animated.timing(radarSlideX, {
                toValue: 0,
                duration: 190,
                useNativeDriver: true,
              }),
              Animated.timing(radarOpacity, {
                toValue: 1,
                duration: 190,
                useNativeDriver: true,
              }),
            ]).start(() => {
              isRadarAnimatingRef.current = false;
            });
          });
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(radarSlideX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(radarOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [radarOpacity, radarSlideX, selectedRadarWeekIndex, radarWeeks.length]
  );

  const radarPoints = radarData.map((item, index) => {
    const angle = -Math.PI / 2 + (index / radarData.length) * Math.PI * 2;
    const clampedRatio = Math.min(item.ratio, RADAR_MAX_RATIO);
    const distance = (clampedRatio / RADAR_MAX_RATIO) * RADAR_RADIUS;
    const labelDistance = RADAR_RADIUS + 28;

    return {
      ...item,
      angle,
      axisX: RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS,
      axisY: RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS,
      pointX: RADAR_CENTER + Math.cos(angle) * distance,
      pointY: RADAR_CENTER + Math.sin(angle) * distance,
      labelX: RADAR_CENTER + Math.cos(angle) * labelDistance,
      labelY: RADAR_CENTER + Math.sin(angle) * labelDistance,
    };
  });
  const radarPolygonPoints = radarPoints
    .map((point) => `${point.pointX},${point.pointY}`)
    .join(" ");
  const radarRingPolygons = RADAR_LEVELS.map((level) =>
    radarPoints
      .map((point) => {
        const distance = RADAR_RADIUS * level;
        const x = RADAR_CENTER + Math.cos(point.angle) * distance;
        const y = RADAR_CENTER + Math.sin(point.angle) * distance;
        return `${x},${y}`;
      })
      .join(" ")
  );
  const radarPolygonFill = darkMode
    ? "rgba(182, 126, 244, 0.22)"
    : "rgba(31, 143, 255, 0.16)";

  return (
    <>
      <OverviewCardSurface style={styles.card} {...radarPanResponder.panHandlers}>
        <View style={styles.radarTop}>
          <Text style={styles.radarTitle}>Muscle balance</Text>
          <Pressable
            onPress={() => setHelpOpen(true)}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.helpButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.helpText}>?</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.radarSwipeContent,
            {
              opacity: radarOpacity,
              transform: [{ translateX: radarSlideX }],
            },
          ]}
        >
          {selectedRadarWeekLabel ? (
            <Text style={styles.radarWeekLabel}>{selectedRadarWeekLabel}</Text>
          ) : null}

          <View style={styles.radarWrap}>
            <View style={styles.radarSurface}>
              <View style={styles.radarGlow} pointerEvents="none" />
              <View style={styles.radarPrZone} pointerEvents="none" />

              <Svg
                width={RADAR_SIZE}
                height={RADAR_SIZE}
                style={styles.radarSvg}
                pointerEvents="none"
              >
                {radarRingPolygons.map((points, index) => (
                  <Polygon
                    key={`ring-${RADAR_LEVELS[index]}`}
                    points={points}
                    fill="none"
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                ))}

                {radarPoints.map((point) => (
                  <Line
                    key={`axis-${point.key}`}
                    x1={RADAR_CENTER}
                    y1={RADAR_CENTER}
                    x2={point.axisX}
                    y2={point.axisY}
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                ))}

                <Polygon
                  points={radarPolygonPoints}
                  fill={radarPolygonFill}
                  stroke={colors.accent}
                  strokeWidth={4}
                  strokeLinejoin="round"
                />
              </Svg>

              {radarPoints.map((point) => (
                <View
                  key={`label-${point.key}`}
                  pointerEvents="none"
                  style={[
                    styles.radarAxisLabelWrap,
                    {
                      left: point.labelX - 42,
                      top: point.labelY - 10,
                    },
                  ]}
                >
                  <Text style={styles.radarAxisLabel}>{point.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </OverviewCardSurface>

      <InfoModal
        visible={helpOpen}
        title="Muscle balance"
        message="Volume this week compared with the average of your 3 strongest separate calendar weeks from the previous 12 weeks."
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 18,
      gap: 8,
    },
    radarTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    radarTitle: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    helpButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundAlt,
      overflow: "hidden",
    },
    helpText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
    },
    radarWeekLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 2,
    },
    radarSwipeContent: {
      overflow: "hidden",
    },
    radarWrap: {
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 4,
    },
    radarSurface: {
      width: RADAR_SIZE,
      height: RADAR_SIZE,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    radarSvg: {
      position: "absolute",
      left: 0,
      top: 0,
    },
    radarGlow: {
      position: "absolute",
      width: RADAR_RADIUS * 1.95,
      height: RADAR_RADIUS * 1.95,
      borderRadius: RADAR_RADIUS,
      backgroundColor: colors.accentSoft,
      opacity: 0.5,
    },
    radarPrZone: {
      position: "absolute",
      width: RADAR_RADIUS * 2,
      height: RADAR_RADIUS * 2,
      borderRadius: RADAR_RADIUS,
      borderWidth: 12,
      borderColor: "rgba(63, 214, 146, 0.12)",
    },
    radarAxisLabelWrap: {
      position: "absolute",
      width: 84,
      alignItems: "center",
    },
    radarAxisLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    buttonPressed: {
      opacity: 0.96,
    },
  });
