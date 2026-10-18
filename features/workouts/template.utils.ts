import type { WorkoutSession, WorkoutTemplate } from "./workout.types";

export const hasTemplateExerciseChanges = (
  session: WorkoutSession,
  template: WorkoutTemplate
): boolean =>
  session.templateId === template.id &&
  (session.exercises.length !== template.exercises.length ||
    session.exercises.some(
      (exercise, index) => exercise.exerciseId !== template.exercises[index]?.exerciseId
    ));

export const updateTemplateExercisesFromWorkout = (
  template: WorkoutTemplate,
  session: WorkoutSession
): WorkoutTemplate => {
  const remainingExercises = [...template.exercises];

  return {
    ...template,
    exercises: session.exercises.map((exercise) => {
      const existingIndex = remainingExercises.findIndex(
        (item) => item.exerciseId === exercise.exerciseId
      );

      if (existingIndex !== -1) {
        return remainingExercises.splice(existingIndex, 1)[0];
      }

      return {
        exerciseId: exercise.exerciseId,
        targetSets: Math.max(1, exercise.sets.length),
        notes: exercise.notes,
        restSecondsOverride: exercise.restSeconds,
      };
    }),
  };
};
