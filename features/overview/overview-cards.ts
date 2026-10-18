export const OVERVIEW_CARD_KEYS = ["creatine", "workouts", "muscleBalance"] as const;

export type OverviewCardKey = (typeof OVERVIEW_CARD_KEYS)[number];

export const OVERVIEW_CARD_LABELS: Record<OverviewCardKey, string> = {
  creatine: "Creatine",
  workouts: "Workouts per week",
  muscleBalance: "Muscle balance",
};
