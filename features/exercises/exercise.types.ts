export type EquipmentType =
  | "machine"
  | "dumbbell"
  | "barbell"
  | "cable"
  | "bodyweight"
  | "smith"
  | "kettlebell"
  | "band"
  | "other";

export type MuscleGroup =
  | "chest"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "neck"
  | "lats"
  | "traps"
  | "lower_back"
  | "abs"
  | "obliques"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "abductors"
  | "adductors"
  | "upper_chest"
  | "lower_chest"
  | "upper_back"
  | "hip_flexors"
  | "tibialis"
  | "serratus"
  | "rotator_cuff";

export interface Exercise {
  id: string;
  name: string;
  isCustom?: boolean;
  isModified?: boolean;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentType;
  defaultRestSeconds?: number;
  notes?: string;
  imageUri?: string;
  muscleContributions: Partial<Record<MuscleGroup, number>>;
}
