import {
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import AppInput from "../../components/ui/AppInput";
import AppButton from "../../components/ui/AppButton";
import { showAlert } from "../../lib/ui/alert";
import Svg, { G, Path } from "react-native-svg";
import {
  calculatePerformedExerciseVolume,
  calculateSessionMuscleVolumes,
} from "../../features/body-map/muscle-score.utils";
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
import {
  formatMuscleSplitSummary,
  formatSessionDuration,
  titleCase,
} from "../../utils/format";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

const frontImage = require("../../assets/body-map/front-man.png");
const backImage = require("../../assets/body-map/back-man.png");

const MAP_WIDTH = 150;
const MAP_HEIGHT = 394;

const formatHistorySetWeight = (
  weight: number | null
) => {
  return weight == null ? "- kg" : `${weight} kg`;
};

const getRegionHeatMap = (
  regions: { label: string; muscles: string[] }[],
  volumes: Record<string, number>,
  peakVolume: number
) =>
  new Map(
    regions.map((region) => {
      const regionVolume = region.muscles.reduce(
        (highest, muscle) => Math.max(highest, volumes[muscle] ?? 0),
        0
      );
      const ratio = regionVolume > 0 && peakVolume > 0 ? regionVolume / peakVolume : 0;

      return [
        region.label,
        {
          opacity: ratio > 0 ? Math.min(0.16 + ratio * 0.5, 0.82) : 0,
          fill: "#f13e50",
        },
      ] as const;
    })
  );

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const formatCompactDateTime = (iso?: string) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `${day}/${month} ${hours}:${minutes}`;
};

const formatCalendarPreview = (date: Date) => {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const formatTimingRangePreview = (
  session: { startedAt: string; endedAt?: string },
  editorState: { field: "startedAt" | "endedAt"; value: Date }
) => {
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : null;

  const nextStart =
    editorState.field === "startedAt" ? editorState.value : startDate;

  let nextEnd = editorState.field === "endedAt" ? editorState.value : endDate;

  if (editorState.field === "startedAt" && endDate) {
    const durationMs = endDate.getTime() - startDate.getTime();
    nextEnd = new Date(editorState.value.getTime() + durationMs);
  }

  const startText = formatCalendarPreview(nextStart);
  const endText = nextEnd ? formatCalendarPreview(nextEnd) : "-";

  return `${startText} - ${endText}`;
};

const getCalendarMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getCalendarGrid = (monthDate: Date) => {
  const monthStart = getCalendarMonthStart(monthDate);
  const weekdayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - weekdayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    return cellDate;
  });
};

const isSameCalendarDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const shiftMonth = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const withSelectedDay = (source: Date, selectedDay: Date) => {
  const next = new Date(source);
  next.setFullYear(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
  return next;
};

const adjustTimeUnit = (
  source: Date,
  unit: "hours" | "minutes",
  amount: number
) => {
  const next = new Date(source);

  if (unit === "hours") {
    const nextHours = (next.getHours() + amount + 24) % 24;
    next.setHours(nextHours);
    return next;
  }

  const nextMinutes = (next.getMinutes() + amount + 60) % 60;
  next.setMinutes(nextMinutes);
  return next;
};

type TimingEditorState = {
  field: "startedAt" | "endedAt";
  value: Date;
  visibleMonth: Date;
};

export default function SessionDetailScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const history = useAppStore((state) => state.workoutHistory);
  const exercises = useAppStore((state) => state.exercises);
  const updateWorkoutHistoryTitle = useAppStore(
    (state) => state.updateWorkoutHistoryTitle
  );
  const updateWorkoutHistoryTimestamps = useAppStore(
    (state) => state.updateWorkoutHistoryTimestamps
  );
  const updateWorkoutHistoryNotes = useAppStore(
    (state) => state.updateWorkoutHistoryNotes
  );
  const updateWorkoutHistoryExerciseNotes = useAppStore(
    (state) => state.updateWorkoutHistoryExerciseNotes
  );
  const updateWorkoutHistorySet = useAppStore((state) => state.updateWorkoutHistorySet);
  const addSetToWorkoutHistoryExercise = useAppStore(
    (state) => state.addSetToWorkoutHistoryExercise
  );
  const removeSetFromWorkoutHistoryExercise = useAppStore(
    (state) => state.removeSetFromWorkoutHistoryExercise
  );
  const removeExerciseFromWorkoutHistory = useAppStore(
    (state) => state.removeExerciseFromWorkoutHistory
  );
  const addExerciseToWorkoutHistory = useAppStore(
    (state) => state.addExerciseToWorkoutHistory
  );
  const removeWorkoutHistorySession = useAppStore(
    (state) => state.removeWorkoutHistorySession
  );

  const session = history.find((item) => item.id === sessionId);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [workoutNotesDraft, setWorkoutNotesDraft] = useState("");
  const [setValueDraft, setSetValueDraft] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [timingEditorState, setTimingEditorState] = useState<TimingEditorState | null>(null);
  const [showBackHeatmap, setShowBackHeatmap] = useState(false);
  const titleInputRef = useRef<TextInput | null>(null);
  const setValueInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    setTitleDraft(session?.templateName ?? "");
    setWorkoutNotesDraft(session?.notes ?? "");
    setSetValueDraft("");
    setEditingField(null);
  }, [session?.endedAt, session?.id, session?.notes, session?.startedAt, session?.templateName]);

  useEffect(() => {
    if (editingField === "title") {
      const timeout = setTimeout(() => titleInputRef.current?.focus(), 40);
      return () => clearTimeout(timeout);
    }
  }, [editingField]);

  useEffect(() => {
    if (!editingField?.startsWith("weight-") && !editingField?.startsWith("reps-")) {
      return;
    }

    const timeout = setTimeout(() => {
      setValueInputRef.current?.focus();
    }, 40);

    return () => clearTimeout(timeout);
  }, [editingField]);

  const availableExercises = useMemo(() => {
    if (!session) return [];
    const usedExerciseIds = new Set(session.exercises.map((exercise) => exercise.exerciseId));
    const query = exerciseQuery.trim().toLowerCase();

    return exercises
      .filter((exercise) => !usedExerciseIds.has(exercise.id))
      .filter((exercise) =>
        !query
          ? true
          : exercise.name.toLowerCase().includes(query) ||
            exercise.equipment.toLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exerciseQuery, exercises, session]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <View style={styles.container}>
          <Text style={styles.title}>Session not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const volume = session.exercises.reduce(
    (total, performedExercise) => {
      const exercise =
        performedExercise.exerciseSnapshot ??
        exercises.find((item) => item.id === performedExercise.exerciseId);
      return exercise
        ? total + calculatePerformedExerciseVolume(session, performedExercise, exercise)
        : total;
    },
    0
  );
  const sessionMuscleVolumes = calculateSessionMuscleVolumes(session, exercises);
  const peakSessionMuscleVolume = Math.max(
    ...Object.values(sessionMuscleVolumes),
    0
  );
  const frontRegionHeatMap = getRegionHeatMap(
    frontMapRegions,
    sessionMuscleVolumes,
    peakSessionMuscleVolume
  );
  const backRegionHeatMap = getRegionHeatMap(
    backMapRegions,
    sessionMuscleVolumes,
    peakSessionMuscleVolume
  );

  const saveTimingValue = (field: "startedAt" | "endedAt", nextDate: Date) => {
    const parsed = nextDate.toISOString();

    if (field === "startedAt") {
      const currentStart = new Date(session.startedAt).getTime();
      const currentEnd = session.endedAt ? new Date(session.endedAt).getTime() : NaN;
      const nextStart = new Date(parsed).getTime();

      if (
        !Number.isNaN(currentStart) &&
        !Number.isNaN(currentEnd) &&
        !Number.isNaN(nextStart)
      ) {
        const durationMs = currentEnd - currentStart;
        updateWorkoutHistoryTimestamps(session.id, {
          startedAt: parsed,
          endedAt: new Date(nextStart + durationMs).toISOString(),
        });
      } else {
        updateWorkoutHistoryTimestamps(session.id, { startedAt: parsed });
      }
    } else {
      updateWorkoutHistoryTimestamps(session.id, { endedAt: parsed });
    }
  };

  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
    if (editingField === "workout-notes") {
      updateWorkoutHistoryNotes(session.id, workoutNotesDraft);
      setEditingField(null);
    }
  };

  const handleDeleteSession = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSession = () => {
    setIsDeleteModalOpen(false);
    removeWorkoutHistorySession(session.id);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/history");
  };

  const openSetValueEditor = (
    fieldKey: string,
    value: number | null | undefined
  ) => {
    setSetValueDraft(value == null ? "" : value.toString());
    setEditingField(fieldKey);
  };

  const openTimingEditor = (field: "startedAt" | "endedAt", value?: string) => {
    const initialDate = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(initialDate.getTime()) ? new Date() : initialDate;
    setTimingEditorState({
      field,
      value: safeDate,
      visibleMonth: getCalendarMonthStart(safeDate),
    });
  };

  const closeTimingEditor = () => {
    setTimingEditorState(null);
  };

  const selectTimingDay = (selectedDay: Date) => {
    setTimingEditorState((current) =>
      current
        ? {
            ...current,
            value: withSelectedDay(current.value, selectedDay),
            visibleMonth: getCalendarMonthStart(selectedDay),
          }
        : current
    );
  };

  const changeTimingMonth = (amount: number) => {
    setTimingEditorState((current) =>
      current
        ? {
            ...current,
            visibleMonth: shiftMonth(current.visibleMonth, amount),
          }
        : current
    );
  };

  const adjustTimingValue = (unit: "hours" | "minutes", amount: number) => {
    setTimingEditorState((current) =>
      current
        ? {
            ...current,
            value: adjustTimeUnit(current.value, unit, amount),
          }
        : current
    );
  };

  const confirmTimingEditor = () => {
    if (!timingEditorState) return;
    saveTimingValue(timingEditorState.field, timingEditorState.value);
    setTimingEditorState(null);
  };

  const commitSetValue = (
    field: "weight" | "reps",
    performedExerciseId: string,
    setId: string
  ) => {
    const trimmedValue = setValueDraft.trim();

    updateWorkoutHistorySet(session.id, performedExerciseId, setId, {
      [field]: trimmedValue === "" ? null : Number(trimmedValue),
    });
    setEditingField(null);
    setSetValueDraft("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <Modal
        animationType="fade"
        transparent
        visible={isExercisePickerOpen}
        onRequestClose={() => setIsExercisePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add exercise</Text>
            <AppInput
              value={exerciseQuery}
              onChangeText={setExerciseQuery}
              placeholder="Search exercises"
            />
            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              {availableExercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => {
                    addExerciseToWorkoutHistory(session.id, exercise.id);
                    setIsExercisePickerOpen(false);
                    setExerciseQuery("");
                  }}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.exerciseOption,
                    pressed && styles.pressedOpacity,
                  ]}
                >
                  <Text style={styles.exerciseOptionTitle}>{exercise.name}</Text>
                  <Text style={styles.exerciseOptionMeta}>
                    {formatMuscleSplitSummary(exercise.muscleContributions)}  |  {titleCase(exercise.equipment)}
                  </Text>
                </Pressable>
              ))}
              {availableExercises.length === 0 ? (
                <Text style={styles.emptyPickerText}>No exercises available.</Text>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={() => {
                setIsExercisePickerOpen(false);
                setExerciseQuery("");
              }}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.closeModalButton,
                pressed && styles.pressedOpacity,
              ]}
            >
              <Text style={styles.closeModalButtonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isDeleteModalOpen}
        onRequestClose={() => setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete workout</Text>
            <Text style={styles.modalText}>
              Delete {session.templateName ?? "Workout"} from history?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsDeleteModalOpen(false)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.pressedOpacity,
                ]}
              >
                <Text style={styles.secondaryActionText}>Keep</Text>
              </Pressable>
              <AppButton title="Delete workout" onPress={confirmDeleteSession} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={timingEditorState !== null}
        onRequestClose={closeTimingEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.timingModalCard}>
            <Text style={styles.modalTitle}>
              {timingEditorState?.field === "startedAt" ? "Select start" : "Select end"}
            </Text>
            {timingEditorState ? (
              <>
                <View style={styles.calendarHeader}>
                  <Pressable
                    onPress={() => changeTimingMonth(-1)}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.calendarArrow,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.calendarTitle}>
                    {MONTH_LABELS[timingEditorState.visibleMonth.getMonth()]}{" "}
                    {timingEditorState.visibleMonth.getFullYear()}
                  </Text>
                  <Pressable
                    onPress={() => changeTimingMonth(1)}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.calendarArrow,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>

                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={label} style={styles.weekdayCell}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {getCalendarGrid(timingEditorState.visibleMonth).map((day) => {
                    const isCurrentMonth =
                      day.getMonth() === timingEditorState.visibleMonth.getMonth();
                    const isSelected = isSameCalendarDay(day, timingEditorState.value);

                    return (
                      <Pressable
                        key={day.toISOString()}
                        onPress={() => selectTimingDay(day)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            !isCurrentMonth && styles.dayCellTextMuted,
                            isSelected && styles.dayCellTextSelected,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.timeEditorRow}>
                  <Text style={styles.timeEditorLabel}>Time</Text>
                  <View style={styles.timeStepperGroup}>
                    <View style={styles.timeStepper}>
                      <Pressable
                        onPress={() => adjustTimingValue("hours", 1)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.timeStepButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Ionicons name="chevron-up" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={styles.timeValue}>
                        {`${timingEditorState.value.getHours()}`.padStart(2, "0")}
                      </Text>
                      <Pressable
                        onPress={() => adjustTimingValue("hours", -1)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.timeStepButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Ionicons name="chevron-down" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                    <Text style={styles.timeSeparator}>:</Text>
                    <View style={styles.timeStepper}>
                      <Pressable
                        onPress={() => adjustTimingValue("minutes", 1)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.timeStepButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Ionicons name="chevron-up" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={styles.timeValue}>
                        {`${timingEditorState.value.getMinutes()}`.padStart(2, "0")}
                      </Text>
                      <Pressable
                        onPress={() => adjustTimingValue("minutes", -1)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.timeStepButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        <Ionicons name="chevron-down" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={styles.calendarPreview}>
                  {formatTimingRangePreview(session, timingEditorState)}
                </Text>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={closeTimingEditor}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={styles.secondaryActionText}>Cancel</Text>
                  </Pressable>
                  <AppButton title="Save time" onPress={confirmTimingEditor} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            handleDismissKeyboard();
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/history");
          }}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressedOpacity]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable onPress={handleDismissKeyboard} style={styles.contentTapArea}>
          <Pressable
            onPress={() => setEditingField("title")}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.titleInputWrap,
              pressed && styles.pressedOpacity,
            ]}
          >
            {editingField === "title" ? (
              <TextInput
                ref={titleInputRef}
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={() => {
                  updateWorkoutHistoryTitle(session.id, titleDraft);
                  setEditingField(null);
                }}
                onSubmitEditing={() => {
                  updateWorkoutHistoryTitle(session.id, titleDraft);
                  setEditingField(null);
                  Keyboard.dismiss();
                }}
                placeholder="Workout title"
                placeholderTextColor={colors.textMuted}
                selectTextOnFocus
                selectionColor={colors.accent}
                style={styles.title}
              />
            ) : (
              <Text style={styles.title}>{session.templateName ?? "Workout"}</Text>
            )}
          </Pressable>

          <View style={styles.summaryCard}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>
                {formatSessionDuration(session.startedAt, session.endedAt)}
              </Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Volume</Text>
              <Text style={styles.summaryValue}>{volume}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Exercises</Text>
              <Text style={styles.summaryValue}>{session.exercises.length}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Workout timing</Text>

            <View style={styles.timingRow}>
              <Pressable
                onPress={() => openTimingEditor("startedAt", session.startedAt)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.infoRow, pressed && styles.pressedOpacity]}
              >
                <Text style={styles.infoValue}>{formatCompactDateTime(session.startedAt)}</Text>
              </Pressable>

              <Text style={styles.timingSeparator}>-</Text>

              <Pressable
                onPress={() => openTimingEditor("endedAt", session.endedAt)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.infoRow, pressed && styles.pressedOpacity]}
              >
                <Text style={styles.infoValue}>{formatCompactDateTime(session.endedAt)}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Workout notes</Text>
            <Pressable
              onPress={() => setEditingField("workout-notes")}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [styles.notesPressable, pressed && styles.pressedOpacity]}
            >
              {editingField === "workout-notes" ? (
                <AppInput
                  value={workoutNotesDraft}
                  onChangeText={setWorkoutNotesDraft}
                  onBlur={() => {
                    updateWorkoutHistoryNotes(session.id, workoutNotesDraft);
                    setEditingField(null);
                  }}
                  placeholder="Workout notes"
                  multiline
                  numberOfLines={4}
                  style={styles.notesInput}
                />
              ) : (
                <Text style={styles.notesPreviewText}>
                  {session.notes?.trim() || "Tap to add workout notes"}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.heatmapCard}>
            <View style={styles.heatmapHeader}>
              <Text style={styles.cardSectionTitle}>Workout heatmap</Text>
              <Text style={styles.heatmapSideLabel}>
                {showBackHeatmap ? "Back" : "Front"}
              </Text>
            </View>

            <View style={styles.heatmapFigureCard}>
              <View style={styles.heatmapFigureWrap}>
                <Image
                  source={showBackHeatmap ? backImage : frontImage}
                  style={styles.heatmapFigureImage}
                  resizeMode="contain"
                />
                {!showBackHeatmap ? (
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

            <Pressable
              onPress={() => setShowBackHeatmap((current) => !current)}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.heatmapSwitchButton,
                pressed && styles.pressedOpacity,
              ]}
            >
              <Text style={styles.heatmapSwitchText}>
                {showBackHeatmap ? "SHOW FRONT" : "SHOW BACK"}
              </Text>
            </Pressable>
          </View>

          {session.exercises.map((performedExercise) => {
            const exercise =
              performedExercise.exerciseSnapshot ??
              exercises.find((item) => item.id === performedExercise.exerciseId);

            return (
              <View key={performedExercise.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{exercise?.name ?? "Exercise"}</Text>
                    <Text style={styles.cardMeta}>
                      {exercise
                        ? `${formatMuscleSplitSummary(exercise.muscleContributions)}  |  ${titleCase(exercise.equipment)}`
                        : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      showAlert(
                        "Remove exercise?",
                        "This exercise will be removed from the saved workout.",
                        [
                          { text: "Keep", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () =>
                              removeExerciseFromWorkoutHistory(session.id, performedExercise.id),
                          },
                        ]
                      )
                    }
                    android_ripple={{ color: colors.ripple }}
                    style={styles.trashButton}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setEditingField(`notes-${performedExercise.id}`)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [styles.notesPressable, pressed && styles.pressedOpacity]}
                >
                  {editingField === `notes-${performedExercise.id}` ? (
                    <AppInput
                      value={performedExercise.notes ?? ""}
                      onChangeText={(value) =>
                        updateWorkoutHistoryExerciseNotes(session.id, performedExercise.id, value)
                      }
                      onBlur={() => setEditingField(null)}
                      placeholder="Exercise notes"
                      multiline
                      numberOfLines={3}
                      style={styles.exerciseNotesInput}
                    />
                  ) : (
                    <Text style={styles.notesPreviewText}>
                      {performedExercise.notes?.trim() || "Tap to add exercise notes"}
                    </Text>
                  )}
                </Pressable>

                {performedExercise.sets.map((setItem, index) => {
                  const weightFieldKey = `weight-${setItem.id}`;
                  const repsFieldKey = `reps-${setItem.id}`;

                  return (
                    <View key={setItem.id} style={styles.setRow}>
                      <Text style={styles.setNumber}>Set {index + 1}</Text>

                      <Pressable
                        onPress={() => openSetValueEditor(weightFieldKey, setItem.weight)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.setTextButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        {editingField === weightFieldKey ? (
                          <AppInput
                            ref={setValueInputRef}
                            value={setValueDraft}
                            onChangeText={setSetValueDraft}
                            onBlur={() => commitSetValue("weight", performedExercise.id, setItem.id)}
                            onSubmitEditing={() => {
                              commitSetValue("weight", performedExercise.id, setItem.id);
                              Keyboard.dismiss();
                            }}
                            keyboardType="number-pad"
                            placeholder="0"
                            selectTextOnFocus
                            style={styles.setInput}
                          />
                        ) : (
                          <Text style={styles.setTextValue}>
                            {formatHistorySetWeight(setItem.weight)}
                          </Text>
                        )}
                      </Pressable>

                      <Text style={styles.setInlineSeparator}>x</Text>

                      <Pressable
                        onPress={() => openSetValueEditor(repsFieldKey, setItem.reps)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.setTextButton,
                          pressed && styles.pressedOpacity,
                        ]}
                      >
                        {editingField === repsFieldKey ? (
                          <AppInput
                            ref={setValueInputRef}
                            value={setValueDraft}
                            onChangeText={setSetValueDraft}
                            onBlur={() => commitSetValue("reps", performedExercise.id, setItem.id)}
                            onSubmitEditing={() => {
                              commitSetValue("reps", performedExercise.id, setItem.id);
                              Keyboard.dismiss();
                            }}
                            keyboardType="number-pad"
                            placeholder="0"
                            selectTextOnFocus
                            style={styles.setInput}
                          />
                        ) : (
                          <Text style={styles.setTextValue}>
                            {setItem.reps == null ? "- reps" : `${setItem.reps} reps`}
                          </Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          removeSetFromWorkoutHistoryExercise(
                            session.id,
                            performedExercise.id,
                            setItem.id
                          )
                        }
                        android_ripple={{ color: colors.ripple }}
                        style={styles.smallTrashButton}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                  );
                })}

                <Pressable
                  onPress={() => addSetToWorkoutHistoryExercise(session.id, performedExercise.id)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [styles.addSetButton, pressed && styles.pressedOpacity]}
                >
                  <Text style={styles.addSetText}>ADD SET</Text>
                </Pressable>
              </View>
            );
          })}

          <Pressable
            onPress={() => setIsExercisePickerOpen(true)}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.addExerciseButton,
              pressed && styles.pressedOpacity,
            ]}
          >
            <Text style={styles.addExerciseButtonText}>ADD EXERCISE</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteSession}
            android_ripple={{ color: "rgba(255,255,255,0.08)" }}
            style={({ pressed }) => [
              styles.deleteWorkoutButton,
              pressed && styles.pressedOpacity,
            ]}
          >
            <Text style={styles.deleteWorkoutButtonText}>DELETE WORKOUT</Text>
          </Pressable>
        </Pressable>
      </ScrollView>
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
    paddingBottom: 36,
  },
  contentTapArea: {
    gap: 14,
  },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    paddingVertical: 0,
  },
  titleInputWrap: {
    marginHorizontal: -4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 10,
  },
  summaryMetric: {
    flex: 1,
    backgroundColor: colors.panelStrong,
    borderRadius: radii.md,
    padding: 12,
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  heatmapCard: {
    backgroundColor: colors.panel,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heatmapSideLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  heatmapFigureCard: {
    alignItems: "center",
    paddingVertical: 4,
  },
  heatmapFigureWrap: {
    position: "relative",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    alignSelf: "center",
  },
  heatmapFigureImage: {
    width: "100%",
    height: "100%",
  },
  heatmapOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  heatmapSwitchButton: {
    minHeight: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  heatmapSwitchText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.panel,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardSectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  infoRow: {
    paddingVertical: 2,
  },
  timingSeparator: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  infoValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  notesPressable: {
    backgroundColor: colors.panelStrong,
    borderRadius: radii.md,
    padding: 12,
  },
  notesPreviewText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  addExerciseButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  addExerciseButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  deleteWorkoutButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  deleteWorkoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  cardMeta: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  trashButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  exerciseNotesInput: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setNumber: {
    width: 42,
    color: colors.text,
    fontWeight: "700",
  },
  setTextButton: {
    paddingVertical: 2,
  },
  setTextValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  setInlineSeparator: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  setInput: {
    textAlign: "center",
    minWidth: 76,
    paddingVertical: 8,
  },
  smallTrashButton: {
    marginLeft: "auto",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong,
    overflow: "hidden",
  },
  addSetButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  addSetText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  timingModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  modalText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayCell: {
    width: "14.28%",
    textAlign: "center",
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dayCell: {
    width: "13.8%",
    aspectRatio: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayCellText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 15,
    includeFontPadding: false,
    textAlign: "center",
  },
  dayCellTextMuted: {
    color: colors.textSoft,
  },
  dayCellTextSelected: {
    color: colors.white,
  },
  timeEditorRow: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 18,
  },
  timeEditorLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  timeStepperGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeStepper: {
    width: 64,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: 6,
    gap: 6,
  },
  timeStepButton: {
    width: 32,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  timeValue: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  timeSeparator: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: "700",
  },
  calendarPreview: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  modalList: {
    maxHeight: 360,
  },
  exerciseOption: {
    backgroundColor: colors.panelStrong,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseOptionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  exerciseOptionMeta: {
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyPickerText: {
    color: colors.textMuted,
    lineHeight: 20,
    paddingVertical: 8,
  },
  closeModalButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
    overflow: "hidden",
  },
  closeModalButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  pressedOpacity: {
    opacity: 0.96,
  },
});
