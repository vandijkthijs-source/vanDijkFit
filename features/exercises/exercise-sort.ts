import type { WorkoutSession } from "../workouts/workout.types";

export const exerciseSortOptions = [
  { value: "recent", label: "Recently used" },
  { value: "most-used", label: "Most used" },
] as const;

export type ExerciseSortOrder = typeof exerciseSortOptions[number]["value"];

// Count workouts with a completed set, once per exercise per workout.
export const getExerciseUsageCounts = (history: WorkoutSession[]) => {
  const counts = new Map<string, number>();
  for (const session of history) {
    const usedIds = new Set(session.exercises
      .filter((exercise) => exercise.sets.some((set) => set.completed))
      .map((exercise) => exercise.exerciseId));
    for (const id of usedIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};
