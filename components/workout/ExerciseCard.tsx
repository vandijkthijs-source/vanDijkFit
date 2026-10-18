import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ExerciseSnapshot,
  PerformedExercise,
} from "../../features/workouts/workout.types";
import { Exercise } from "../../features/exercises/exercise.types";
import { useExerciseStats } from "../../hooks/useExerciseStats";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { daysAgoText } from "../../utils/date";
import { formatMuscleSplitSummary, formatWeightReps, titleCase } from "../../utils/format";
import AppInput from "../ui/AppInput";
import SetRow from "./SetRow";
import { showAlert } from "../../lib/ui/alert";

type Props = {
  exercise: Exercise | ExerciseSnapshot;
  performedExercise: PerformedExercise;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
  onUpdateSet: (
    setId: string,
    field: "weight" | "reps",
    value: string
  ) => void;
  onUpdateNotes: (value: string) => void;
  onUpdateRest: (restSeconds: number) => void;
  activeRestSetId: string | null;
  isRestTimerRunning: boolean;
  remainingSeconds: number;
  restTimerDurationSeconds: number;
  finishedRestSetIds: string[];
  onCompleteSet: (setId: string) => void;
  onTitlePress?: () => void;
  onTitleLongPress?: () => void;
  onTitleReorderMove?: (dy: number) => void;
  onTitleReorderRelease?: () => void;
  onLayout?: (height: number) => void;
  hidden?: boolean;
};

const formatRest = (seconds?: number) => {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

const secondsToDigits = (seconds?: number) => {
  const safeSeconds = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}${remainingSeconds.toString().padStart(2, "0")}`;
};

const formatRestDigits = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (!digits) {
    return "0:00";
  }

  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2) || "0");
  return formatRest(minutes * 60 + seconds);
};

const parseRestDigits = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (!digits) {
    return 0;
  }

  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2) || "0");
  return minutes * 60 + seconds;
};

function SwipeToDeleteRow({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const hasRemovedRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(Math.min(0, gestureState.dx));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -72) {
            hasRemovedRef.current = true;
            Animated.timing(translateX, {
              toValue: -120,
              duration: 140,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                onRemove();
              }
            });

            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          if (hasRemovedRef.current) {
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onRemove, translateX]
  );

  return (
    <View style={styles.swipeRowWrap}>
      <View pointerEvents="none" style={styles.deleteAction}>
        <Ionicons name="trash-outline" size={18} color={colors.white} />
        <Text style={styles.deleteActionText}>Delete</Text>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeContent, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function ExerciseCard({
  exercise,
  performedExercise,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onUpdateSet,
  onUpdateNotes,
  onUpdateRest,
  activeRestSetId,
  isRestTimerRunning,
  remainingSeconds,
  restTimerDurationSeconds,
  finishedRestSetIds,
  onCompleteSet,
  onTitlePress,
  onTitleLongPress,
  onTitleReorderMove,
  onTitleReorderRelease,
  onLayout,
  hidden,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const stats = useExerciseStats(exercise.id);
  const [editingRestSetId, setEditingRestSetId] = useState<string | null>(null);
  const [restInput, setRestInput] = useState(secondsToDigits(performedExercise.restSeconds ?? 90));
  const restInputRef = useRef<TextInput | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleReorderingRef = useRef(false);
  const hasTitleMovedRef = useRef(false);
  const onTitlePressRef = useRef(onTitlePress);
  const onTitleLongPressRef = useRef(onTitleLongPress);
  const onTitleReorderMoveRef = useRef(onTitleReorderMove);
  const onTitleReorderReleaseRef = useRef(onTitleReorderRelease);

  useEffect(() => {
    onTitlePressRef.current = onTitlePress;
    onTitleLongPressRef.current = onTitleLongPress;
    onTitleReorderMoveRef.current = onTitleReorderMove;
    onTitleReorderReleaseRef.current = onTitleReorderRelease;
  }, [onTitleLongPress, onTitlePress, onTitleReorderMove, onTitleReorderRelease]);

  const clearTitleLongPressTimeout = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const titlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isTitleReorderingRef.current ||
          Math.abs(gestureState.dx) > 8 ||
          Math.abs(gestureState.dy) > 8,
        onPanResponderGrant: () => {
          isTitleReorderingRef.current = false;
          hasTitleMovedRef.current = false;
          clearTitleLongPressTimeout();
          longPressTimeoutRef.current = setTimeout(() => {
            isTitleReorderingRef.current = true;
            onTitleLongPressRef.current?.();
          }, 360);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!isTitleReorderingRef.current) {
            if (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8) {
              hasTitleMovedRef.current = true;
              clearTitleLongPressTimeout();
            }
            return;
          }

          onTitleReorderMoveRef.current?.(gestureState.dy);
        },
        onPanResponderRelease: () => {
          clearTitleLongPressTimeout();
          if (isTitleReorderingRef.current) {
            isTitleReorderingRef.current = false;
            onTitleReorderReleaseRef.current?.();
            return;
          }

          if (!hasTitleMovedRef.current) {
            onTitlePressRef.current?.();
          }
        },
        onPanResponderTerminate: () => {
          clearTitleLongPressTimeout();
          if (isTitleReorderingRef.current) {
            isTitleReorderingRef.current = false;
            onTitleReorderReleaseRef.current?.();
          }
        },
      }),
    []
  );

  useEffect(() => {
    if (!editingRestSetId) {
      return;
    }

    const timeout = setTimeout(() => {
      restInputRef.current?.focus();
    }, 40);

    return () => clearTimeout(timeout);
  }, [editingRestSetId]);

  const saveRest = () => {
    const parsed = parseRestDigits(restInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRestInput(secondsToDigits(performedExercise.restSeconds ?? 90));
      setEditingRestSetId(null);
      return;
    }

    onUpdateRest(Math.round(parsed));
    setRestInput(secondsToDigits(Math.round(parsed)));
    setEditingRestSetId(null);
  };

  useEffect(() => clearTitleLongPressTimeout, []);

  const restProgress =
    restTimerDurationSeconds > 0
      ? Math.max(0, Math.min(1, remainingSeconds / restTimerDurationSeconds))
      : 0;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => onLayout?.(event.nativeEvent.layout.height)}
      pointerEvents={hidden ? "box-none" : "auto"}
      style={[styles.card, hidden && styles.hiddenCard]}
    >
      <View style={styles.header}>
        <View {...titlePanResponder.panHandlers} style={styles.headerText}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.subTitle}>
            {formatMuscleSplitSummary(exercise.muscleContributions)}  |  {titleCase(exercise.equipment)}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <View style={styles.memoryChip}>
            <Ionicons name="flash-outline" size={14} color={colors.accent} />
            <Text style={styles.memoryChipText}>{stats.timesTrained}x</Text>
          </View>
          <Pressable
            onPress={() =>
              showAlert(
                "Remove exercise?",
                "This exercise and all of its sets will be removed from the workout.",
                [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: onRemoveExercise,
                  },
                ]
              )
            }
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && styles.glowPressed,
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.memoryRow}>
        <Text style={styles.memoryText}>Last: {daysAgoText(stats.lastTrainedAt)}</Text>
        <Text style={styles.memoryText}>
          PR:{" "}
          {stats.personalBest
            ? formatWeightReps(stats.personalBest.weight, stats.personalBest.reps)
            : "-"}
        </Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.headerLabel, styles.setColumn]}>SET</Text>
        <Text style={[styles.headerLabel, styles.previousColumn]}>PREVIOUS SETS</Text>
        <Text style={[styles.headerLabel, styles.inputColumn]}>KG</Text>
        <Text style={[styles.headerLabel, styles.inputColumn]}>REPS</Text>
        <Text style={[styles.headerLabel, styles.checkColumn]}>OK</Text>
      </View>

      {performedExercise.sets.map((setItem, index) => (
        <SwipeToDeleteRow key={setItem.id} onRemove={() => onRemoveSet(setItem.id)}>
          <View style={styles.setBlock}>
            <SetRow
              setNumber={index + 1}
              previous={stats.lastSession?.sets[index]}
              weight={setItem.weight}
              reps={setItem.reps}
              completed={setItem.completed}
              onChangeWeight={(value) => onUpdateSet(setItem.id, "weight", value)}
              onChangeReps={(value) => onUpdateSet(setItem.id, "reps", value)}
              onComplete={() => onCompleteSet(setItem.id)}
            />
            {editingRestSetId === setItem.id ? (
              <Pressable
                onPress={() => restInputRef.current?.focus()}
                style={styles.restInputWrap}
              >
                <View style={styles.restInput}>
                  <Text style={styles.restInputText}>{formatRestDigits(restInput)}</Text>
                  <TextInput
                    ref={restInputRef}
                    value={restInput}
                    onChangeText={(value) =>
                      setRestInput(value.replace(/\D/g, "").slice(0, 4))
                    }
                    onBlur={saveRest}
                    onSubmitEditing={saveRest}
                    keyboardType="number-pad"
                    maxLength={4}
                    caretHidden
                    contextMenuHidden
                    selectionColor="transparent"
                    style={styles.hiddenRestInput}
                  />
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setRestInput("");
                  setEditingRestSetId(setItem.id);
                }}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.restButton,
                  activeRestSetId === setItem.id && styles.restButtonActive,
                  finishedRestSetIds.includes(setItem.id) && styles.restButtonComplete,
                  pressed && styles.glowPressed,
                ]}
              >
                {activeRestSetId === setItem.id ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.restProgressFill,
                      isRestTimerRunning
                        ? { width: `${restProgress * 100}%`, backgroundColor: colors.accent }
                        : styles.restProgressEmpty,
                    ]}
                  />
                ) : null}
                {finishedRestSetIds.includes(setItem.id) ? (
                  <View pointerEvents="none" style={[styles.restProgressFill, styles.restProgressEmpty]} />
                ) : null}
                <Text style={styles.restLabel}>
                  {activeRestSetId === setItem.id
                    ? formatRest(remainingSeconds)
                    : finishedRestSetIds.includes(setItem.id)
                      ? "0:00"
                      : formatRest(performedExercise.restSeconds)}
                </Text>
              </Pressable>
            )}
          </View>
        </SwipeToDeleteRow>
      ))}

      <Pressable
        onPress={onAddSet}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [styles.addSetButton, pressed && styles.glowPressed]}
      >
        <Text style={styles.addSetText}>
          ADD SET ({formatRest(performedExercise.restSeconds)})
        </Text>
      </Pressable>

      <View style={styles.notesWrap}>
        <Text style={styles.notesLabel}>Exercise notes</Text>
        <AppInput
          value={performedExercise.notes ?? ""}
          onChangeText={onUpdateNotes}
          placeholder="Technique cues, tempo, machine seat setting..."
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: 14,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hiddenCard: {
    opacity: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  subTitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  memoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  memoryChipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  memoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  memoryText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  headerLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  setColumn: {
    width: 32,
  },
  previousColumn: {
    flex: 1,
    textAlign: "center",
  },
  inputColumn: {
    width: 72,
    textAlign: "center",
  },
  checkColumn: {
    width: 46,
    textAlign: "center",
  },
  setBlock: {
    backgroundColor: colors.panel,
  },
  swipeRowWrap: {
    position: "relative",
    marginBottom: 4,
    overflow: "hidden",
    borderRadius: radii.md,
  },
  swipeContent: {
    backgroundColor: colors.panel,
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 108,
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
  restLabel: {
    color: colors.accent,
    fontSize: 15,
    textAlign: "center",
    marginVertical: 6,
    position: "relative",
    zIndex: 1,
  },
  restButton: {
    alignSelf: "stretch",
    borderRadius: radii.pill,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  restButtonActive: {
    backgroundColor: colors.backgroundAlt,
    shadowColor: colors.accent,
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  restButtonComplete: {
    backgroundColor: "transparent",
  },
  restProgressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    opacity: 0.32,
  },
  restProgressEmpty: {
    width: "100%",
    backgroundColor: "transparent",
    opacity: 0,
  },
  restInputWrap: {
    alignSelf: "center",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 6,
    minWidth: 116,
  },
  restInput: {
    width: 116,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  restInputText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.6,
    fontVariant: ["tabular-nums"],
  },
  hiddenRestInput: {
    position: "absolute",
    inset: 0,
    opacity: 0.02,
  },
  notesWrap: {
    marginTop: 6,
  },
  notesLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  addSetButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 6,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  addSetText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
