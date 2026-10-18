import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { ExerciseStats } from "../features/workouts/workout.types";

export const useExerciseStats = (exerciseId: string): ExerciseStats => {
  const workoutHistory = useAppStore((state) => state.workoutHistory);

  return useMemo(() => {
    const sessionsWithExercise = workoutHistory.filter((session) =>
      session.exercises.some((exercise) => exercise.exerciseId === exerciseId)
    );

    const sortedSessions = [...sessionsWithExercise].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    const lastSession = sortedSessions[0];
    const lastPerformedExercise = lastSession?.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId
    );

    let personalBest: ExerciseStats["personalBest"] | undefined;

    for (const session of sessionsWithExercise) {
      for (const performedExercise of session.exercises) {
        if (performedExercise.exerciseId !== exerciseId) continue;

        for (const set of performedExercise.sets) {
          if (!set.completed || set.weight == null || set.reps == null) continue;

          if (
            !personalBest ||
            set.weight > personalBest.weight ||
            (set.weight === personalBest.weight && set.reps > personalBest.reps)
          ) {
            personalBest = {
              weight: set.weight,
              reps: set.reps,
            };
          }
        }
      }
    }

    return {
      exerciseId,
      lastTrainedAt: lastSession?.startedAt,
      timesTrained: sessionsWithExercise.length,
      personalBest,
      lastSession:
        lastSession && lastPerformedExercise
          ? {
              sessionId: lastSession.id,
              bodyWeightKg: lastSession.bodyWeightKg,
              bodyweightLoadMode: lastPerformedExercise.bodyweightLoadMode,
              sets: lastPerformedExercise.sets.map((set) => ({
                weight: set.weight,
                reps: set.reps,
              })),
            }
          : undefined,
    };
  }, [exerciseId, workoutHistory]);
};
