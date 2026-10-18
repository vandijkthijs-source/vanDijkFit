import { MUSCLE_LABELS } from "../../constants/muscles";
import { Exercise } from "../exercises/exercise.types";
import { WorkoutSession } from "../workouts/workout.types";
import {
  calculatePerformedExerciseVolume,
  calculateSessionMuscleVolumes,
} from "../body-map/muscle-score.utils";
import { formatTimeRange } from "../../utils/date";
import {
  formatMuscleSplitSummary,
  formatSessionDuration,
  titleCase,
} from "../../utils/format";

export type CoachReportSetRow = {
  setNumber: number;
  weightLabel: string;
  repsLabel: string;
};
export type CoachReportExerciseRow = {
  id: string;
  name: string;
  meta: string;
  completedSets: number;
  totalSets: number;
  volume: number;
  notes?: string;
  sets: CoachReportSetRow[];
};

export type CoachReportSessionRow = {
  id: string;
  title: string;
  dateLabel: string;
  timeRangeLabel: string;
  durationLabel: string;
  durationMinutes: number;
  exerciseCount: number;
  completedSets: number;
  totalSets: number;
  volume: number;
  notes?: string;
  exercises: CoachReportExerciseRow[];
};

export type CoachReportWeeklyRow = {
  key: string;
  label: string;
  workoutCount: number;
  completedSets: number;
  volume: number;
  ratio: number;
};

export type CoachReportMuscleHitRow = {
  key: string;
  label: string;
  workoutCount: number;
  volume: number;
  ratio: number;
};

export type CoachReportData = {
  generatedAtLabel: string;
  dateRangeLabel: string;
  summary: {
    workoutCount: number;
    totalVolume: number;
    completedSets: number;
    totalSets: number;
    exerciseCount: number;
    averageDurationMinutes: number;
  };
  weeklyAttendance: CoachReportWeeklyRow[];
  muscleHits: CoachReportMuscleHitRow[];
  sessions: CoachReportSessionRow[];
};

const formatSessionDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatReportDateTime = (value: Date) =>
  value.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getWeekStart = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
};

const formatWeekRange = (weekStart: Date) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return `${formatSessionDate(weekStart.toISOString())} - ${formatSessionDate(
    weekEnd.toISOString()
  )}`;
};

const getDurationMinutes = (session: WorkoutSession) => {
  const startedAt = new Date(session.startedAt).getTime();
  const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : startedAt;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;

  return Math.max(0, Math.round((endedAt - startedAt) / (1000 * 60)));
};

const formatDateRange = (sessions: WorkoutSession[]) => {
  if (sessions.length === 0) return "-";

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const first = formatSessionDate(sorted[0]?.startedAt);
  const last = formatSessionDate(sorted[sorted.length - 1]?.startedAt);

  return first === last ? first : `${first} - ${last}`;
};

const resolveExercise = (performedExercise: WorkoutSession["exercises"][number], exercises: Exercise[]) =>
  performedExercise.exerciseSnapshot ??
  exercises.find((exercise) => exercise.id === performedExercise.exerciseId);

const formatSetValue = (value: number | null | undefined, suffix: string) =>
  value === null || value === undefined ? "-" : `${value} ${suffix}`;

const buildSessionRow = (
  session: WorkoutSession,
  exercises: Exercise[]
): CoachReportSessionRow => {
  const exerciseRows = session.exercises.map((performedExercise) => {
    const exercise = resolveExercise(performedExercise, exercises);
    const completedSets = performedExercise.sets.filter((set) => set.completed);
    const volume = exercise
      ? calculatePerformedExerciseVolume(session, performedExercise, exercise)
      : 0;

    return {
      id: performedExercise.id,
      name: exercise?.name ?? "Exercise",
      meta: exercise
        ? `${formatMuscleSplitSummary(exercise.muscleContributions)} | ${titleCase(
            exercise.equipment
          )}`
        : "-",
      completedSets: completedSets.length,
      totalSets: performedExercise.sets.length,
      volume,
      notes: performedExercise.notes?.trim() || undefined,
      sets: performedExercise.sets
        .map((set, index) => ({ set, index }))
        .filter(({ set }) => set.completed)
        .map(({ set, index }) => ({
          setNumber: index + 1,
          weightLabel: formatSetValue(set.weight, "kg"),
          repsLabel: formatSetValue(set.reps, "reps"),
        })),
    };
  });
  const completedSets = exerciseRows.reduce(
    (total, exercise) => total + exercise.completedSets,
    0
  );
  const totalSets = exerciseRows.reduce((total, exercise) => total + exercise.totalSets, 0);
  const volume = exerciseRows.reduce((total, exercise) => total + exercise.volume, 0);

  return {
    id: session.id,
    title: session.templateName?.trim() || "Workout",
    dateLabel: formatSessionDate(session.startedAt),
    timeRangeLabel: formatTimeRange(session.startedAt, session.endedAt),
    durationLabel: formatSessionDuration(session.startedAt, session.endedAt),
    durationMinutes: getDurationMinutes(session),
    exerciseCount: exerciseRows.length,
    completedSets,
    totalSets,
    volume,
    notes: session.notes?.trim() || undefined,
    exercises: exerciseRows,
  };
};
const buildWeeklyAttendance = (
  sessions: WorkoutSession[],
  sessionRows: CoachReportSessionRow[]
): CoachReportWeeklyRow[] => {
  const rowsBySessionId = new Map(sessionRows.map((row) => [row.id, row]));
  const weeks = new Map<
    string,
    {
      weekStart: Date;
      workoutCount: number;
      completedSets: number;
      volume: number;
    }
  >();

  for (const session of sessions) {
    const weekStart = getWeekStart(session.startedAt);
    if (!weekStart) continue;

    const key = weekStart.toISOString();
    const sessionRow = rowsBySessionId.get(session.id);
    const current = weeks.get(key) ?? {
      weekStart,
      workoutCount: 0,
      completedSets: 0,
      volume: 0,
    };

    current.workoutCount += 1;
    current.completedSets += sessionRow?.completedSets ?? 0;
    current.volume += sessionRow?.volume ?? 0;
    weeks.set(key, current);
  }

  const highestWorkoutCount = Math.max(
    0,
    ...Array.from(weeks.values()).map((week) => week.workoutCount)
  );

  return Array.from(weeks.entries())
    .sort((a, b) => a[1].weekStart.getTime() - b[1].weekStart.getTime())
    .map(([key, week]) => ({
      key,
      label: formatWeekRange(week.weekStart),
      workoutCount: week.workoutCount,
      completedSets: week.completedSets,
      volume: week.volume,
      ratio:
        highestWorkoutCount > 0 ? week.workoutCount / highestWorkoutCount : 0,
    }));
};

const buildMuscleHits = (
  sessions: WorkoutSession[],
  exercises: Exercise[]
): CoachReportMuscleHitRow[] => {
  const muscleStats: Record<string, { workoutCount: number; volume: number }> = {};

  for (const session of sessions) {
    const sessionMuscleVolumes = calculateSessionMuscleVolumes(session, exercises);

    for (const [muscle, volume] of Object.entries(sessionMuscleVolumes)) {
      if (volume <= 0) continue;

      const current = muscleStats[muscle] ?? { workoutCount: 0, volume: 0 };
      muscleStats[muscle] = {
        workoutCount: current.workoutCount + 1,
        volume: current.volume + volume,
      };
    }
  }

  const highestWorkoutCount = Math.max(
    0,
    ...Object.values(muscleStats).map((muscle) => muscle.workoutCount)
  );

  return Object.entries(muscleStats)
    .sort(
      (a, b) =>
        b[1].workoutCount - a[1].workoutCount ||
        b[1].volume - a[1].volume ||
        (MUSCLE_LABELS[a[0]] ?? a[0]).localeCompare(MUSCLE_LABELS[b[0]] ?? b[0])
    )
    .map(([key, muscle]) => ({
      key,
      label: MUSCLE_LABELS[key] ?? titleCase(key),
      workoutCount: muscle.workoutCount,
      volume: muscle.volume,
      ratio:
        highestWorkoutCount > 0 ? muscle.workoutCount / highestWorkoutCount : 0,
    }));
};

export const buildCoachReportData = (
  sessions: WorkoutSession[],
  exercises: Exercise[]
): CoachReportData => {
  const orderedSessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const sessionRows = orderedSessions.map((session) => buildSessionRow(session, exercises));
  const totalDurationMinutes = sessionRows.reduce(
    (total, session) => total + session.durationMinutes,
    0
  );

  return {
    generatedAtLabel: formatReportDateTime(new Date()),
    dateRangeLabel: formatDateRange(orderedSessions),
    summary: {
      workoutCount: sessionRows.length,
      totalVolume: sessionRows.reduce((total, session) => total + session.volume, 0),
      completedSets: sessionRows.reduce(
        (total, session) => total + session.completedSets,
        0
      ),
      totalSets: sessionRows.reduce((total, session) => total + session.totalSets, 0),
      exerciseCount: sessionRows.reduce(
        (total, session) => total + session.exerciseCount,
        0
      ),
      averageDurationMinutes:
        sessionRows.length > 0 ? Math.round(totalDurationMinutes / sessionRows.length) : 0,
    },
    weeklyAttendance: buildWeeklyAttendance(orderedSessions, sessionRows),
    muscleHits: buildMuscleHits(orderedSessions, exercises),
    sessions: sessionRows,
  };
};

