import { EquipmentType } from "../features/exercises/exercise.types";
import { MAJOR_MUSCLE_OPTIONS, MajorMuscleGroupKey } from "./muscles";

export const muscleOptions: MajorMuscleGroupKey[] = MAJOR_MUSCLE_OPTIONS;

export const equipmentOptions: EquipmentType[] = [
  "machine",
  "dumbbell",
  "barbell",
  "cable",
  "bodyweight",
  "smith",
  "kettlebell",
  "band",
  "other",
];

export const restPresetOptions = [45, 60, 90, 120, 180];
