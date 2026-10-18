import { MuscleGroup } from "../features/exercises/exercise.types";

export const MUSCLE_LABELS: Record<string, string> = {
  abs: "Abs",
  front_delts: "Front Delts",
  side_delts: "Side Delts",
  rear_delts: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  neck: "Neck",
  traps: "Traps",
  lats: "Lats",
  lower_back: "Lower Back",
  chest: "Chest",
  obliques: "Obliques",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  abductors: "Abductors",
  adductors: "Adductors",
};

export const MAJOR_MUSCLE_GROUPS = {
  abs: ["abs"],
  front_delts: ["front_delts"],
  side_delts: ["side_delts"],
  rear_delts: ["rear_delts"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  neck: ["neck"],
  traps: ["traps"],
  lats: ["lats"],
  lower_back: ["lower_back"],
  chest: ["chest"],
  obliques: ["obliques"],
  glutes: ["glutes"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  calves: ["calves"],
  abductors: ["abductors"],
  adductors: ["adductors"],
} as const satisfies Record<string, readonly MuscleGroup[]>;

export type MajorMuscleGroupKey = keyof typeof MAJOR_MUSCLE_GROUPS;

export const MAJOR_MUSCLE_LABELS: Record<MajorMuscleGroupKey, string> = {
  abs: "Abs",
  front_delts: "Front Delts",
  side_delts: "Side Delts",
  rear_delts: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  neck: "Neck",
  traps: "Traps",
  lats: "Lats",
  lower_back: "Lower Back",
  chest: "Chest",
  obliques: "Obliques",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  abductors: "Abductors",
  adductors: "Adductors",
};

export const MAJOR_MUSCLE_OPTIONS: MajorMuscleGroupKey[] = [
  "abs",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
  "neck",
  "traps",
  "lats",
  "lower_back",
  "chest",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "abductors",
  "adductors",
];

const LEGACY_MUSCLE_TO_MAJOR: Partial<Record<MuscleGroup, MajorMuscleGroupKey>> = {
  upper_chest: "chest",
  lower_chest: "chest",
  upper_back: "traps",
};

const LEGACY_MAJOR_EXPANSION: Record<string, Partial<Record<MuscleGroup, number>>> = {
  shoulders: {
    front_delts: 0.34,
    side_delts: 0.33,
    rear_delts: 0.33,
  },
  back: {
    lats: 0.55,
    traps: 0.3,
    lower_back: 0.15,
  },
};

const MAJOR_MUSCLE_EXPANSION: Record<
  MajorMuscleGroupKey,
  Partial<Record<MuscleGroup, number>>
> = {
  abs: { abs: 1 },
  front_delts: { front_delts: 1 },
  side_delts: { side_delts: 1 },
  rear_delts: { rear_delts: 1 },
  biceps: { biceps: 1 },
  triceps: { triceps: 1 },
  forearms: { forearms: 1 },
  neck: { neck: 1 },
  traps: { traps: 1 },
  lats: { lats: 1 },
  lower_back: { lower_back: 1 },
  chest: { chest: 1 },
  obliques: { obliques: 1 },
  glutes: { glutes: 1 },
  quads: { quads: 1 },
  hamstrings: { hamstrings: 1 },
  calves: { calves: 1 },
  abductors: { abductors: 1 },
  adductors: { adductors: 1 },
};

export const getMajorMuscleKey = (
  muscle: MuscleGroup
): MajorMuscleGroupKey | null => {
  const directMatch = (Object.entries(MAJOR_MUSCLE_GROUPS) as Array<
    [MajorMuscleGroupKey, readonly MuscleGroup[]]
  >).find(([, muscles]) => muscles.includes(muscle))?.[0];

  if (directMatch) {
    return directMatch;
  }

  return LEGACY_MUSCLE_TO_MAJOR[muscle] ?? null;
};

export const aggregateToMajorMuscleContributions = (
  muscleContributions: Record<string, number> | Partial<Record<string, number>>
): Partial<Record<MajorMuscleGroupKey, number>> => {
  const aggregated: Partial<Record<MajorMuscleGroupKey, number>> = {};

  for (const [muscle, value] of Object.entries(muscleContributions ?? {})) {
    if (typeof value !== "number" || value <= 0) continue;

    if (muscle in LEGACY_MAJOR_EXPANSION) {
      for (const [expandedMuscle, expandedValue] of Object.entries(
        LEGACY_MAJOR_EXPANSION[muscle] ?? {}
      )) {
        const majorKey = getMajorMuscleKey(expandedMuscle as MuscleGroup);
        if (!majorKey) continue;
        aggregated[majorKey] =
          (aggregated[majorKey] ?? 0) + value * (expandedValue ?? 0);
      }
      continue;
    }

    const majorKey = getMajorMuscleKey(muscle as MuscleGroup);
    if (!majorKey) continue;
    aggregated[majorKey] = (aggregated[majorKey] ?? 0) + value;
  }

  return aggregated;
};

export const expandMajorMuscleContributions = (
  muscleContributions: Partial<Record<MajorMuscleGroupKey, number>>
): Partial<Record<MuscleGroup, number>> => {
  const expanded: Partial<Record<MuscleGroup, number>> = {};

  for (const [majorKey, value] of Object.entries(muscleContributions ?? {})) {
    if (typeof value !== "number" || value <= 0) continue;
    const expansion =
      MAJOR_MUSCLE_EXPANSION[majorKey as MajorMuscleGroupKey] ?? {};

    for (const [muscle, weight] of Object.entries(expansion)) {
      expanded[muscle as MuscleGroup] =
        (expanded[muscle as MuscleGroup] ?? 0) + value * (weight ?? 0);
    }
  }

  return expanded;
};
