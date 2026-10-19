import curated from "../../data/exercises.curated.json";
import { MAJOR_MUSCLE_LABELS } from "../../constants/muscles";
import { titleCase } from "../../utils/format";
import type { WorkoutSession } from "../workouts/workout.types";
import type { Exercise } from "./exercise.types";

export const curatedExerciseIds = new Set(Object.values(curated).flat());

// A presentation filter only: the complete seed/store catalog stays intact.
export const isDefaultExercise = (exercise: Exercise) =>
  curatedExerciseIds.has(exercise.id) || Boolean(exercise.isCustom);

export const getExerciseRecency = (history: WorkoutSession[]) => {
  const recency = new Map<string, number>();
  for (const session of history) {
    const time = Date.parse(session.endedAt ?? session.startedAt);
    if (!Number.isFinite(time)) continue;
    for (const exercise of session.exercises) {
      recency.set(exercise.exerciseId, Math.max(time, recency.get(exercise.exerciseId) ?? 0));
    }
  }
  return recency;
};

export const getSearchScore = (exercise: Exercise, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const exerciseName = exercise.name.toLowerCase();
  const nameWords = exerciseName.split(/[\s()\-]+/).filter(Boolean);
  const equipmentLabel = titleCase(exercise.equipment).toLowerCase();
  const muscleLabels = Object.keys(exercise.muscleContributions ?? {}).map(
    (muscle) =>
      (
        MAJOR_MUSCLE_LABELS[
          muscle as keyof typeof MAJOR_MUSCLE_LABELS
        ] ?? titleCase(muscle)
      ).toLowerCase()
  );

  if (exerciseName === normalizedQuery) return 1000;
  if (exerciseName.startsWith(normalizedQuery)) return 900;
  if (nameWords.some((word) => word === normalizedQuery)) return 820;
  if (nameWords.some((word) => word.startsWith(normalizedQuery))) return 760;
  if (exerciseName.includes(normalizedQuery)) return 620;
  if (muscleLabels.some((label) => label.startsWith(normalizedQuery))) return 340;
  if (muscleLabels.some((label) => label.includes(normalizedQuery))) return 260;
  if (equipmentLabel.startsWith(normalizedQuery)) return 140;
  if (equipmentLabel.includes(normalizedQuery)) return 100;

  return -1;
};

export const selectLibraryExercises = (
  exercises: Exercise[],
  query: string,
  showAll: boolean,
  recency: ReadonlyMap<string, number>,
) => {
  const normalized = query.trim().toLowerCase();
  return exercises
    .filter((exercise) => normalized || showAll || isDefaultExercise(exercise))
    .map((exercise) => ({ exercise, score: getSearchScore(exercise, normalized) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score ||
      (recency.get(b.exercise.id) ?? 0) - (recency.get(a.exercise.id) ?? 0) ||
      a.exercise.name.localeCompare(b.exercise.name))
    .map(({ exercise }) => exercise);
};
