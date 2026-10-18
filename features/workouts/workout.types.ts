import type { EquipmentType, Exercise, MuscleGroup } from "../exercises/exercise.types";

export type BodyweightLoadMode = "added" | "assisted";

export type ExerciseSnapshot = Pick<
  Exercise,
  | "id"
  | "name"
  | "primaryMuscle"
  | "secondaryMuscles"
  | "equipment"
  | "muscleContributions"
> & {
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentType;
};

export interface SetLog {
  id: string;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  timestamp?: string;
  notes?: string;
}

export interface PerformedExercise {
  id: string;
  exerciseId: string;
  order: number;
  sets: SetLog[];
  notes?: string;
  restTimerEnabled?: boolean;
  restSeconds?: number;
  exerciseSnapshot?: ExerciseSnapshot;
  bodyweightLoadMode?: BodyweightLoadMode;
}

export interface WorkoutTemplateExercise {
  exerciseId: string;
  targetSets: number;
  repRange?: {
    min: number;
    max: number;
  };
  notes?: string;
  restSecondsOverride?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutTemplateExercise[];
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  templateName?: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  bodyWeightKg?: number;
  exercises: PerformedExercise[];
}

export interface RestTimerState {
  setId: string;
  durationSeconds: number;
  endsAt: string;
}

export interface ExerciseStats {
  exerciseId: string;
  lastTrainedAt?: string;
  timesTrained: number;
  personalBest?: {
    weight: number;
    reps: number;
  };
  lastSession?: {
    sessionId: string;
    bodyWeightKg?: number;
    bodyweightLoadMode?: BodyweightLoadMode;
    sets: {
      weight: number | null;
      reps: number | null;
    }[];
  };
}
