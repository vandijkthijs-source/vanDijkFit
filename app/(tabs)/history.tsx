import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../components/ui/AppButton";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { calculatePerformedExerciseVolume } from "../../features/body-map/muscle-score.utils";
import { WorkoutSession } from "../../features/workouts/workout.types";
import { shareCoachReportPdf } from "../../lib/pdf/coachReportPdf";
import { showAlert } from "../../lib/ui/alert";
import { useAppStore } from "../../store/useAppStore";
import { formatTimeRange } from "../../utils/date";
import { formatSessionDuration } from "../../utils/format";

const formatSessionDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const getSessionVolume = (
  session: WorkoutSession,
  exercises: ReturnType<typeof useAppStore.getState>["exercises"]
) =>
  session.exercises.reduce((total, performedExercise) => {
    const exercise =
      performedExercise.exerciseSnapshot ??
      exercises.find((item) => item.id === performedExercise.exerciseId);
    return exercise
      ? total + calculatePerformedExerciseVolume(session, performedExercise, exercise)
      : total;
  }, 0);

const TAB_BAR_HEIGHT = 54;
const RESUME_BAR_HEIGHT = 54;
const EXPORT_BAR_BOTTOM_GAP = 12;
const EXPORT_BAR_ESTIMATED_HEIGHT = 82;

export default function HistoryScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const darkMode = useAppStore((state) => state.darkMode);
  const workoutHistory = useAppStore((state) => state.workoutHistory);
  const exercises = useAppStore((state) => state.exercises);
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const isWorkoutMinimized = useAppStore((state) => state.isWorkoutMinimized);
  const saveWorkoutAsTemplate = useAppStore((state) => state.saveWorkoutAsTemplate);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedExportSessionIds, setSelectedExportSessionIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const selectedExportSessionSet = useMemo(
    () => new Set(selectedExportSessionIds),
    [selectedExportSessionIds]
  );
  const selectedExportSessions = useMemo(
    () => workoutHistory.filter((session) => selectedExportSessionSet.has(session.id)),
    [selectedExportSessionSet, workoutHistory]
  );
  const exportBarBottom =
    TAB_BAR_HEIGHT +
    insets.bottom +
    EXPORT_BAR_BOTTOM_GAP +
    (activeWorkout && isWorkoutMinimized ? RESUME_BAR_HEIGHT : 0);
  const exportModePaddingBottom = exportBarBottom + EXPORT_BAR_ESTIMATED_HEIGHT + 18;
  const allSessionsSelected =
    workoutHistory.length > 0 && selectedExportSessionIds.length === workoutHistory.length;

  useEffect(() => {
    if (!selectedSessionId) return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, [selectedSessionId]);

  const handleOpenTemplateModal = (sessionId: string, name?: string) => {
    setSelectedSessionId(sessionId);
    setTemplateName(name?.trim() || "Workout Template");
  };

  const handleSaveTemplate = () => {
    if (!selectedSessionId) return;
    saveWorkoutAsTemplate(selectedSessionId, templateName);
    setSelectedSessionId(null);
    setTemplateName("");
  };

  const enterExportMode = () => {
    if (workoutHistory.length === 0) {
      showAlert("No workouts yet", "Finish a workout before creating a coach report.");
      return;
    }

    setIsExportMode(true);
    setSelectedExportSessionIds([]);
  };

  const exitExportMode = () => {
    if (isExporting) return;
    setIsExportMode(false);
    setSelectedExportSessionIds([]);
  };

  const toggleExportSession = (sessionId: string) => {
    setSelectedExportSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((item) => item !== sessionId)
        : [...current, sessionId]
    );
  };

  const selectAllSessions = () => {
    setSelectedExportSessionIds(
      allSessionsSelected ? [] : workoutHistory.map((session) => session.id)
    );
  };

  const selectRecentSessions = (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessionIds = workoutHistory
      .filter((session) => new Date(session.startedAt).getTime() >= cutoff)
      .map((session) => session.id);

    if (sessionIds.length === 0) {
      showAlert("No recent workouts", `No workouts found in the last ${days} days.`);
      return;
    }

    setSelectedExportSessionIds(sessionIds);
  };

  const handleExportSelectedSessions = async () => {
    if (selectedExportSessions.length === 0) {
      showAlert("Select workouts", "Choose at least one workout for the PDF report.");
      return;
    }

    try {
      setIsExporting(true);
      await shareCoachReportPdf({
        sessions: selectedExportSessions,
        exercises,
      });
      setIsExportMode(false);
      setSelectedExportSessionIds([]);
    } catch (error) {
      console.error(error);
      showAlert("Export failed", "The PDF could not be created. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          isExportMode && { paddingBottom: exportModePaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Your logged sessions, volume, and notes.</Text>
          </View>
          <Pressable
            onPress={isExportMode ? exitExportMode : enterExportMode}
            hitSlop={10}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.headerIconButton,
              isExportMode && styles.headerIconButtonActive,
              pressed && styles.glowPressed,
            ]}
          >
            <Ionicons
              name={isExportMode ? "close" : "document-text-outline"}
              size={21}
              color={isExportMode ? colors.white : colors.accent}
            />
          </Pressable>
        </View>

        {isExportMode ? (
          <View style={styles.exportPanel}>
            <View>
              <Text style={styles.exportTitle}>Coach PDF export</Text>
              <Text style={styles.exportSubtitle}>
                Select the workouts your coach should review.
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exportQuickActions}
            >
              <Pressable
                onPress={selectAllSessions}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.glowPressed,
                ]}
              >
                <Text style={styles.quickActionText}>
                  {allSessionsSelected ? "Clear all" : "Select all"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectRecentSessions(7)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.glowPressed,
                ]}
              >
                <Text style={styles.quickActionText}>Last 7 days</Text>
              </Pressable>
              <Pressable
                onPress={() => selectRecentSessions(30)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.glowPressed,
                ]}
              >
                <Text style={styles.quickActionText}>Last 30 days</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}

        {workoutHistory.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptyText}>
              Finish a session and it will show up here with details and memory.
            </Text>
          </View>
        ) : (
          workoutHistory.map((session) => {
            const selected = selectedExportSessionSet.has(session.id);
            const completedSets = session.exercises
              .flatMap((exercise) => exercise.sets)
              .filter((set) => set.completed).length;
            const volume = getSessionVolume(session, exercises);

            return (
              <View key={session.id} style={styles.cardWrap}>
                <Pressable
                  onPress={() =>
                    isExportMode
                      ? toggleExportSession(session.id)
                      : router.push(`/history/${session.id}`)
                  }
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.card,
                    isExportMode && styles.cardSelectable,
                    selected && styles.cardSelected,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardTitle}>
                        {session.templateName ?? "Workout"}
                      </Text>
                      <Text style={styles.meta}>{formatSessionDate(session.startedAt)}</Text>
                      <Text style={styles.meta}>
                        {formatTimeRange(session.startedAt, session.endedAt)}
                      </Text>
                    </View>
                    <View style={styles.cardRight}>
                      {isExportMode ? (
                        <View
                          style={[
                            styles.selectCircle,
                            selected && styles.selectCircleSelected,
                          ]}
                        >
                          {selected ? (
                            <Ionicons name="checkmark" size={16} color={colors.white} />
                          ) : null}
                        </View>
                      ) : null}
                      <Text style={styles.duration}>
                        {formatSessionDuration(session.startedAt, session.endedAt)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Exercises</Text>
                      <Text style={styles.metricValue}>{session.exercises.length}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Completed sets</Text>
                      <Text style={styles.metricValue}>{completedSets}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Volume</Text>
                      <Text style={styles.metricValue}>{Math.round(volume)}</Text>
                    </View>
                  </View>

                  {session.notes ? (
                    <Text style={styles.notesPreview} numberOfLines={2}>
                      {session.notes}
                    </Text>
                  ) : null}

                  {!isExportMode ? (
                    <View style={styles.cardFooter}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          handleOpenTemplateModal(session.id, session.templateName);
                        }}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.templateAction,
                          pressed && styles.glowPressed,
                        ]}
                      >
                        <Text style={styles.templateActionText}>SAVE AS TEMPLATE</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {isExportMode ? (
        <View style={[styles.exportBar, { bottom: exportBarBottom }]}>
          <View style={styles.exportBarHeader}>
            <View style={styles.exportBarCopy}>
              <Text style={styles.exportCount}>
                {selectedExportSessionIds.length} selected
              </Text>
              <Text style={styles.exportHint}>Build a polished PDF for your coach.</Text>
            </View>
          </View>
          <Pressable
            onPress={handleExportSelectedSessions}
            disabled={isExporting || selectedExportSessionIds.length === 0}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.exportButton,
              (isExporting || selectedExportSessionIds.length === 0) &&
                styles.exportButtonDisabled,
              pressed && selectedExportSessionIds.length > 0 && styles.glowPressed,
            ]}
          >
            {isExporting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="share-outline" size={18} color={colors.white} />
            )}
            <Text style={styles.exportButtonText}>
              {isExporting ? "Creating" : "Export PDF"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={selectedSessionId !== null}
        onRequestClose={() => setSelectedSessionId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save as template</Text>
            <Text style={styles.modalText}>Rename this template before saving it.</Text>
            <TextInput
              ref={inputRef}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Template name"
              placeholderTextColor={colors.textSoft}
              selectTextOnFocus
              selectionColor={colors.accent}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setSelectedSessionId(null)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.glowPressed,
                ]}
              >
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </Pressable>
              <AppButton
                title="Save template"
                onPress={handleSaveTemplate}
                disabled={!templateName.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  container: {
    padding: 18,
    paddingBottom: 112,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    overflow: "hidden",
  },
  headerIconButtonActive: {
    backgroundColor: colors.danger,
  },
  exportPanel: {
    padding: 16,
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  exportTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  exportSubtitle: {
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 20,
  },
  exportQuickActions: {
    gap: 8,
    paddingRight: 16,
  },
  quickAction: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  quickActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardSelectable: {
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  cardWrap: {
    marginBottom: 14,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  selectCircleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  meta: {
    color: colors.textMuted,
    marginTop: 4,
  },
  duration: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.panelStrong,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 78,
    justifyContent: "space-between",
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  notesPreview: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  cardFooter: {
    marginTop: 2,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  templateAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    overflow: "hidden",
  },
  templateActionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  exportBar: {
    position: "absolute",
    left: 14,
    right: 14,
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    zIndex: 20,
    elevation: 12,
  },
  exportBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exportBarCopy: {
    flex: 1,
  },
  exportCount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  exportHint: {
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 12,
  },
  exportButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    overflow: "hidden",
  },
  exportButtonDisabled: {
    opacity: 0.48,
  },
  exportButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    backgroundColor: colors.panel,
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
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.input,
    fontSize: 16,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
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
});
