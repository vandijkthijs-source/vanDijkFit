import estimates from "../../data/exercises.muscle-estimates.json";
import type { Exercise, MuscleGroup } from "./exercise.types";

type MuscleEstimate = {
  modality: string;
  muscleContributions: Partial<Record<MuscleGroup, number>>;
  strengthScoreEligible: boolean;
};

const estimatesById = new Map<string, MuscleEstimate>(
  estimates.exercises.map((entry) => [entry.id, entry])
);

export const getMuscleEstimate = (exerciseId: string) => estimatesById.get(exerciseId);

// Apply reviewed defaults only; the store's existing merge preserves user edits
// and historical snapshots. Fractions describe relative focus, not activation.
export const applyMuscleEstimates = (exercises: Exercise[]): Exercise[] =>
  exercises.map((exercise) => {
    const estimate = getMuscleEstimate(exercise.id);
    if (!estimate) return exercise;
    const muscles = (Object.entries(estimate.muscleContributions) as [MuscleGroup, number][])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([muscle]) => muscle);
    return {
      ...exercise,
      primaryMuscle: muscles[0] ?? exercise.primaryMuscle,
      secondaryMuscles: muscles.slice(1),
      muscleContributions: { ...estimate.muscleContributions },
    };
  });
