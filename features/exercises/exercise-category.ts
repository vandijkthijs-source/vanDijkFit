import type { Exercise } from "./exercise.types";
import { getMuscleEstimate } from "./muscle-estimates";
import { getRepDbExercise } from "./repdb-catalog";

export const exerciseCategories = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Mobility" },
] as const;

export type ExerciseCategory = typeof exerciseCategories[number]["value"];

export const getExerciseCategory = (exercise: Pick<Exercise, "id">): ExerciseCategory => {
  const modality = getMuscleEstimate(exercise.id)?.modality;
  if (modality === "mobility") return "mobility";
  if (modality === "cardio" || modality === "power_conditioning") return "cardio";
  const source = getRepDbExercise(exercise.id);
  if (source?.category === "stretching") return "mobility";
  if (source?.category === "cardio") return "cardio";
  // Original and custom exercises without activity metadata remain strength.
  return "strength";
};
