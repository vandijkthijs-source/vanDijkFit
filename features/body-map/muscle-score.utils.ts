import { Exercise, MuscleGroup } from "../exercises/exercise.types";
import { PerformedExercise, WorkoutSession } from "../workouts/workout.types";
import {
  aggregateToMajorMuscleContributions,
  expandMajorMuscleContributions,
} from "../../constants/muscles";

const CHART_MAJOR_MUSCLE_GROUPS = {
  chest: ["chest"],
  triceps: ["triceps"],
  shoulders: ["front_delts", "side_delts", "rear_delts"],
  back: ["lats", "traps", "lower_back"],
  biceps: ["biceps"],
  legs: ["glutes", "quads", "hamstrings", "abductors", "adductors"],
  abs: ["abs", "obliques"],
} as const;

export const majorMuscleGroupLabels: Record<keyof typeof CHART_MAJOR_MUSCLE_GROUPS, string> = {
  chest: "Chest",
  triceps: "Triceps",
  shoulders: "Shoulders",
  back: "Back",
  biceps: "Biceps",
  legs: "Legs",
  abs: "Abs",
};

type MajorMuscleGroupKey = keyof typeof CHART_MAJOR_MUSCLE_GROUPS;

export interface MajorMuscleStrengthIndex {
  key: MajorMuscleGroupKey;
  label: string;
  recentBest: number;
  previousBest: number;
  ratio: number;
  isNewPr: boolean;
}

export interface MajorMuscleVolumeComparison {
  key: MajorMuscleGroupKey;
  label: string;
  currentWeekVolume: number;
  benchmarkWeekVolume: number;
  ratio: number;
  isNewPr: boolean;
}

export interface MuscleVolumeProgress {
  key: string;
  label: string;
  currentVolume: number;
  benchmarkVolume: number;
  currentSessionCount: number;
  benchmarkSessionCount: number;
  ratio: number;
  isNewPr: boolean;
  hasBenchmark: boolean;
}

const getWeekStart = (dateInput: string | number | Date) => {
  const date = new Date(dateInput);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateSetStrength = (weight: number | null, reps: number | null) => {
  const safeWeight = weight ?? 0;
  const safeReps = reps ?? 0;
  return safeWeight > 0 && safeReps > 0 ? safeWeight * (1 + safeReps / 30) : 0;
};

const calculateWeeklyBenchmark = (priorWeeks: number[]) => {
  if (priorWeeks.length === 0) {
    return 0;
  }

  if (priorWeeks.length === 1) {
    return priorWeeks[0];
  }

  const topWeeks = [...priorWeeks].sort((a, b) => b - a).slice(0, 3);
  return topWeeks.reduce((total, value) => total + value, 0) / topWeeks.length;
};

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const normalizeMuscleContributions = (
  muscleContributions: Partial<Record<string, number>>
): Partial<Record<MuscleGroup, number>> => {
  const aggregated = aggregateToMajorMuscleContributions(muscleContributions);
  return expandMajorMuscleContributions(aggregated);
};

const resolveExercise = (
  performedExercise: PerformedExercise,
  exerciseMap: Map<string, Exercise>
) => performedExercise.exerciseSnapshot ?? exerciseMap.get(performedExercise.exerciseId);

const getEffectiveSetWeight = (weight: number | null) => Math.max(0, weight ?? 0);

export const calculatePerformedExerciseVolume = (
  _session: WorkoutSession,
  performedExercise: PerformedExercise,
  _exercise: Pick<Exercise, "equipment">
) =>
  performedExercise.sets.reduce((total, set) => {
    if (!set.completed) return total;
    return total + getEffectiveSetWeight(set.weight) * (set.reps ?? 0);
  }, 0);

export const calculateMuscleScores = (
  sessions: WorkoutSession[],
  exercises: Exercise[],
  days: number = 14
) => {
  const scores: Record<string, number> = {};
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  for (const session of sessions) {
    const sessionTime = new Date(session.startedAt).getTime();
    if (sessionTime < cutoff) continue;

    for (const performedExercise of session.exercises) {
      const exercise = resolveExercise(performedExercise, exerciseMap);
      if (!exercise) continue;
      const normalizedContributions = normalizeMuscleContributions(
        exercise.muscleContributions
      );

      const completedSets = performedExercise.sets.filter((set) => set.completed);
      const baseScore = completedSets.length;

      for (const [muscle, value] of Object.entries(normalizedContributions)) {
        scores[muscle] = (scores[muscle] ?? 0) + baseScore * (value ?? 0);
      }
    }
  }

  return scores;
};

export const calculateMuscleVolumes = (
  sessions: WorkoutSession[],
  exercises: Exercise[],
  days: number = 14
) => {
  const volumes: Record<string, number> = {};
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  for (const session of sessions) {
    const sessionTime = new Date(session.startedAt).getTime();
    if (sessionTime < cutoff) continue;

    for (const performedExercise of session.exercises) {
      const exercise = resolveExercise(performedExercise, exerciseMap);
      if (!exercise) continue;
      const normalizedContributions = normalizeMuscleContributions(
        exercise.muscleContributions
      );

      const completedVolume = calculatePerformedExerciseVolume(
        session,
        performedExercise,
        exercise
      );

      for (const [muscle, value] of Object.entries(normalizedContributions)) {
        volumes[muscle] = (volumes[muscle] ?? 0) + completedVolume * (value ?? 0);
      }
    }
  }

  return volumes;
};

export const calculateSessionMuscleVolumes = (
  session: WorkoutSession,
  exercises: Exercise[]
) => {
  const volumes: Record<string, number> = {};
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  for (const performedExercise of session.exercises) {
    const exercise = resolveExercise(performedExercise, exerciseMap);
    if (!exercise) continue;
    const normalizedContributions = normalizeMuscleContributions(
      exercise.muscleContributions
    );

    const completedVolume = calculatePerformedExerciseVolume(
      session,
      performedExercise,
      exercise
    );
    if (completedVolume <= 0) continue;

    for (const [muscle, value] of Object.entries(normalizedContributions)) {
      const weightedVolume = completedVolume * (value ?? 0);
      if (weightedVolume <= 0) continue;

      volumes[muscle] = (volumes[muscle] ?? 0) + weightedVolume;
    }
  }

  return volumes;
};

export const calculateMajorMuscleStrengthIndexes = (
  sessions: WorkoutSession[],
  exercises: Exercise[],
  recentDays: number = 30
): MajorMuscleStrengthIndex[] => {
  const now = Date.now();
  const recentCutoff = now - recentDays * 24 * 60 * 60 * 1000;
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const previousBest: Record<MajorMuscleGroupKey, number> = {
    chest: 0,
    triceps: 0,
    shoulders: 0,
    back: 0,
    biceps: 0,
    legs: 0,
    abs: 0,
  };
  const recentBest: Record<MajorMuscleGroupKey, number> = {
    chest: 0,
    triceps: 0,
    shoulders: 0,
    back: 0,
    biceps: 0,
    legs: 0,
    abs: 0,
  };

  for (const session of sessions) {
    const sessionTime = new Date(session.startedAt).getTime();
    const isRecent = sessionTime >= recentCutoff;

    for (const performedExercise of session.exercises) {
      const exercise = resolveExercise(performedExercise, exerciseMap);
      if (!exercise) continue;
      const normalizedContributions = normalizeMuscleContributions(
        exercise.muscleContributions
      );

      for (const set of performedExercise.sets) {
        if (!set.completed) continue;

        const setStrength = calculateSetStrength(
          getEffectiveSetWeight(set.weight),
          set.reps
        );
        if (setStrength <= 0) continue;

        for (const [groupKey, muscles] of Object.entries(
          CHART_MAJOR_MUSCLE_GROUPS
        ) as [MajorMuscleGroupKey, readonly MuscleGroup[]][]) {
          const contribution = muscles.reduce(
            (total, muscle) => total + (normalizedContributions[muscle] ?? 0),
            0
          );
          if (contribution <= 0) continue;

          const weightedStrength = setStrength * contribution;
          if (isRecent) {
            recentBest[groupKey] = Math.max(recentBest[groupKey], weightedStrength);
          } else {
            previousBest[groupKey] = Math.max(previousBest[groupKey], weightedStrength);
          }
        }
      }
    }
  }

  return (Object.keys(CHART_MAJOR_MUSCLE_GROUPS) as MajorMuscleGroupKey[]).map((key) => {
    const baseline = previousBest[key];
    const current = recentBest[key];
    const fallbackBaseline = baseline > 0 ? baseline : current;
    const ratio = fallbackBaseline > 0 ? current / fallbackBaseline : 0;

    return {
      key,
      label: majorMuscleGroupLabels[key],
      recentBest: current,
      previousBest: baseline,
      ratio,
      isNewPr: baseline > 0 && current > baseline,
    };
  });
};

export const calculateMajorMuscleVolumeComparisons = (
  sessions: WorkoutSession[],
  exercises: Exercise[],
  targetDate: string | number | Date = Date.now()
): MajorMuscleVolumeComparison[] => {
  const targetWeekStart = getWeekStart(targetDate);
  const lookbackCutoff = new Date(targetWeekStart);
  lookbackCutoff.setDate(lookbackCutoff.getDate() - 7 * 11);

  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const targetWeekVolume: Record<MajorMuscleGroupKey, number> = {
    chest: 0,
    triceps: 0,
    shoulders: 0,
    back: 0,
    biceps: 0,
    legs: 0,
    abs: 0,
  };
  const weeklyBuckets = new Map<string, Record<MajorMuscleGroupKey, number>>();

  for (const session of sessions) {
    const sessionWeekStart = getWeekStart(session.startedAt);
    if (sessionWeekStart < lookbackCutoff || sessionWeekStart > targetWeekStart) continue;

    const isTargetWeek = sessionWeekStart.getTime() === targetWeekStart.getTime();
    const weekKey = sessionWeekStart.toISOString();
    const bucket =
      weeklyBuckets.get(weekKey) ??
      {
        chest: 0,
        triceps: 0,
        shoulders: 0,
        back: 0,
        biceps: 0,
        legs: 0,
        abs: 0,
      };

    for (const performedExercise of session.exercises) {
      const exercise = resolveExercise(performedExercise, exerciseMap);
      if (!exercise) continue;
      const normalizedContributions = normalizeMuscleContributions(
        exercise.muscleContributions
      );

      const completedVolume = calculatePerformedExerciseVolume(
        session,
        performedExercise,
        exercise
      );
      if (completedVolume <= 0) continue;

      for (const [groupKey, muscles] of Object.entries(
        CHART_MAJOR_MUSCLE_GROUPS
      ) as [MajorMuscleGroupKey, readonly MuscleGroup[]][]) {
        const contribution = muscles.reduce(
          (total, muscle) => total + (normalizedContributions[muscle] ?? 0),
          0
        );
        if (contribution <= 0) continue;

        const weightedVolume = completedVolume * contribution;
        if (isTargetWeek) {
          targetWeekVolume[groupKey] += weightedVolume;
        }
        bucket[groupKey] += weightedVolume;
      }
    }
    weeklyBuckets.set(weekKey, bucket);
  }

  return (Object.keys(CHART_MAJOR_MUSCLE_GROUPS) as MajorMuscleGroupKey[]).map((key) => {
    const priorWeeks = [...weeklyBuckets.entries()]
      .filter(([weekKey]) => weekKey !== targetWeekStart.toISOString())
      .map(([, volumes]) => volumes[key])
      .filter((value) => value > 0);
    const benchmark = calculateWeeklyBenchmark(priorWeeks);
    const current = targetWeekVolume[key];
    const ratio = benchmark > 0 ? current / benchmark : 0;

    return {
      key,
      label: majorMuscleGroupLabels[key],
      currentWeekVolume: current,
      benchmarkWeekVolume: benchmark,
      ratio,
      isNewPr: benchmark > 0 && current > benchmark,
    };
  });
};

export const calculateMuscleVolumeProgress = (
  sessions: WorkoutSession[],
  exercises: Exercise[],
  targetDate: string | number | Date = Date.now()
): MuscleVolumeProgress[] => {
  const targetWindowEnd = new Date(targetDate);
  targetWindowEnd.setHours(23, 59, 59, 999);
  const targetWindowStart = new Date(targetWindowEnd);
  targetWindowStart.setHours(0, 0, 0, 0);
  targetWindowStart.setDate(targetWindowStart.getDate() - 6);
  const lookbackCutoff = new Date(targetWindowStart);
  lookbackCutoff.setDate(lookbackCutoff.getDate() - 7 * 11);
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const targetVolume: Record<string, number> = {};
  const targetSessionCounts: Record<string, number> = {};
  const historicalSessionVolumes: Record<string, number[]> = {};
  const dailyBuckets = new Map<
    string,
    Record<string, { volume: number; sessionCount: number }>
  >();

  for (const session of sessions) {
    const sessionDate = new Date(session.startedAt);
    if (sessionDate < lookbackCutoff || sessionDate > targetWindowEnd) continue;

    const isTargetWindow =
      sessionDate >= targetWindowStart && sessionDate <= targetWindowEnd;
    const bucketDate = new Date(sessionDate);
    bucketDate.setHours(0, 0, 0, 0);
    const dayKey = bucketDate.toISOString();
    const bucket = dailyBuckets.get(dayKey) ?? {};
    const sessionMuscleVolumes: Record<string, number> = {};

    for (const performedExercise of session.exercises) {
      const exercise = resolveExercise(performedExercise, exerciseMap);
      if (!exercise) continue;
      const normalizedContributions = normalizeMuscleContributions(
        exercise.muscleContributions
      );

      const completedVolume = calculatePerformedExerciseVolume(
        session,
        performedExercise,
        exercise
      );
      if (completedVolume <= 0) continue;

      for (const [muscle, value] of Object.entries(normalizedContributions)) {
        const weightedVolume = completedVolume * (value ?? 0);
        if (weightedVolume <= 0) continue;
        sessionMuscleVolumes[muscle] =
          (sessionMuscleVolumes[muscle] ?? 0) + weightedVolume;
      }
    }

    for (const [muscle, volume] of Object.entries(sessionMuscleVolumes)) {
      if (isTargetWindow) {
        targetVolume[muscle] = (targetVolume[muscle] ?? 0) + volume;
        targetSessionCounts[muscle] = (targetSessionCounts[muscle] ?? 0) + 1;
      } else {
        historicalSessionVolumes[muscle] = [
          ...(historicalSessionVolumes[muscle] ?? []),
          volume,
        ];
      }

      const existing = bucket[muscle] ?? { volume: 0, sessionCount: 0 };
      bucket[muscle] = {
        volume: existing.volume + volume,
        sessionCount: existing.sessionCount + 1,
      };
    }
    dailyBuckets.set(dayKey, bucket);
  }

  const priorWindowStats: Record<
    string,
    { volume: number; sessionCount: number }[]
  > = {};
  const priorWindowEnd = new Date(targetWindowStart);
  priorWindowEnd.setDate(priorWindowEnd.getDate() - 1);

  for (
    let windowEnd = new Date(priorWindowEnd);
    windowEnd >= lookbackCutoff;
    windowEnd.setDate(windowEnd.getDate() - 7)
  ) {
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 6);

    const totals: Record<string, { volume: number; sessionCount: number }> = {};

    for (
      let day = new Date(windowStart);
      day <= windowEnd;
      day.setDate(day.getDate() + 1)
    ) {
      const dayKey = new Date(day).toISOString();
      const bucket = dailyBuckets.get(dayKey);
      if (!bucket) continue;

      for (const [key, value] of Object.entries(bucket)) {
        const existing = totals[key] ?? { volume: 0, sessionCount: 0 };
        totals[key] = {
          volume: existing.volume + value.volume,
          sessionCount: existing.sessionCount + value.sessionCount,
        };
      }
    }

    for (const [key, value] of Object.entries(totals)) {
      if (value.volume <= 0 || value.sessionCount <= 0) continue;
      priorWindowStats[key] = [...(priorWindowStats[key] ?? []), value];
    }
  }

  return Object.keys({
    ...targetVolume,
    ...Object.fromEntries(Object.keys(priorWindowStats).map((key) => [key, true])),
    ...Object.fromEntries(Object.keys(historicalSessionVolumes).map((key) => [key, true])),
  }).map((key) => {
    const currentSessionCount = targetSessionCounts[key] ?? 0;
    const previousWindows = priorWindowStats[key] ?? [];
    const typicalSessionCount = previousWindows.length
      ? Math.max(
          1,
          Math.round(
            calculateMedian(previousWindows.map((window) => window.sessionCount))
          )
        )
      : 0;
    const benchmarkSessionCount =
      currentSessionCount > 0 ? currentSessionCount : typicalSessionCount;
    const comparableWindows = previousWindows.filter(
      (window) => window.sessionCount === benchmarkSessionCount
    );
    const benchmark =
      comparableWindows.length >= 2
        ? calculateMedian(comparableWindows.map((window) => window.volume))
        : calculateMedian(historicalSessionVolumes[key] ?? []) * benchmarkSessionCount;
    const current = targetVolume[key] ?? 0;
    const hasBenchmark = benchmark > 0;
    const ratio = hasBenchmark ? current / benchmark : 0;

    return {
      key,
      label: key,
      currentVolume: current,
      benchmarkVolume: benchmark,
      currentSessionCount,
      benchmarkSessionCount,
      ratio,
      isNewPr: benchmark > 0 && current > benchmark,
      hasBenchmark,
    };
  });
};
