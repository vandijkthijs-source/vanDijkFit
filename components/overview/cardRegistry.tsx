import { ComponentType } from "react";
import {
  OVERVIEW_CARD_KEYS,
  OVERVIEW_CARD_LABELS,
  OverviewCardKey,
} from "../../features/overview/overview-cards";
import CreatineOverviewCard from "./cards/CreatineOverviewCard";
import MuscleBalanceOverviewCard from "./cards/MuscleBalanceOverviewCard";
import WorkoutFrequencyOverviewCard from "./cards/WorkoutFrequencyOverviewCard";

export type OverviewCardDefinition = {
  id: OverviewCardKey;
  label: string;
  Component: ComponentType;
};

export const overviewCardRegistry: Record<OverviewCardKey, OverviewCardDefinition> = {
  creatine: {
    id: "creatine",
    label: OVERVIEW_CARD_LABELS.creatine,
    Component: CreatineOverviewCard,
  },
  workouts: {
    id: "workouts",
    label: OVERVIEW_CARD_LABELS.workouts,
    Component: WorkoutFrequencyOverviewCard,
  },
  muscleBalance: {
    id: "muscleBalance",
    label: OVERVIEW_CARD_LABELS.muscleBalance,
    Component: MuscleBalanceOverviewCard,
  },
};

export const overviewCards = OVERVIEW_CARD_KEYS.map(
  (card) => overviewCardRegistry[card]
);
