import { Exercise } from "../exercises/exercise.types";
import { WorkoutSession } from "../workouts/workout.types";
import { calculateMuscleVolumeProgress } from "./muscle-score.utils";
import { frontMapRegions } from "./front-map-regions";
import { backMapRegions } from "./back-map-regions";

export interface BodyHeatmapWidgetPayload {
  weekLabel: string;
  emptyMessage: string;
  hasData: boolean;
  updatedAt: string;
  regions: Record<
    "front" | "back",
    Record<
      string,
      {
        intensity: number;
        opacity: number;
        fill: string;
        isNewPr: boolean;
      }
    >
  >;
  daily: Record<
    string,
    Pick<BodyHeatmapWidgetPayload, "emptyMessage" | "hasData" | "regions">
  >;
}

const getRegionState = (
  regions: { label: string; muscles: string[] }[],
  progressMap: Map<
    string,
    { currentVolume: number; ratio: number; isNewPr: boolean; hasBenchmark: boolean }
  >
) =>
  Object.fromEntries(
    regions.map((region) => {
      const matched = region.muscles
        .map((muscle) => progressMap.get(muscle))
        .filter(Boolean);
      const regionRatio = matched.reduce(
        (highest, item) => Math.max(highest, item?.ratio ?? 0),
        0
      );
      const normalizedRatio = Math.min(regionRatio, 1.25);
      const hasUnbenchmarkedVolume = matched.some(
        (item) => (item?.currentVolume ?? 0) > 0 && !item?.hasBenchmark
      );
      const opacity =
        normalizedRatio > 0
          ? Math.min(0.14 + normalizedRatio * 0.46, 0.8)
          : hasUnbenchmarkedVolume
            ? 0.48
            : 0;
      const isNewPr = matched.some((item) => item?.isNewPr);
      const intensity = clamp(opacity / 0.8, 0, 1);

      return [
        region.label,
        {
          intensity,
          opacity,
          fill: isNewPr
            ? "#ff394f"
            : hasUnbenchmarkedVolume
              ? "#f8c96a"
              : "#f13e50",
          isNewPr,
        },
      ] as const;
    })
  );

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const padTwoDigits = (value: number) => value.toString().padStart(2, "0");

const formatWeekLabel = (date: Date) =>
  `${padTwoDigits(date.getDate())}/${padTwoDigits(date.getMonth() + 1)}`;

const formatWeekRangeLabel = (weekStart: Date) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return `${formatWeekLabel(weekStart)} - ${formatWeekLabel(weekEnd)}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDayState = (
  history: WorkoutSession[],
  exercises: Exercise[],
  targetDate: Date
) => {
  const progress = calculateMuscleVolumeProgress(history, exercises, targetDate);
  const progressMap = new Map(progress.map((entry) => [entry.key, entry]));
  const hasData = progress.some((entry) => entry.currentVolume > 0);

  return {
    emptyMessage: hasData ? "" : "Train this week to light it up.",
    hasData,
    regions: {
      front: getRegionState(frontMapRegions, progressMap),
      back: getRegionState(backMapRegions, progressMap),
    },
  };
};

export const buildBodyHeatmapWidgetPayload = (
  history: WorkoutSession[],
  exercises: Exercise[]
): BodyHeatmapWidgetPayload => {
  const today = new Date();
  const targetWeek = startOfWeek(today);
  const current = buildDayState(history, exercises, today);
  const daily = Object.fromEntries(
    Array.from({ length: 35 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return [formatLocalDateKey(date), buildDayState(history, exercises, date)];
    })
  );

  return {
    weekLabel: formatWeekRangeLabel(targetWeek),
    ...current,
    updatedAt: new Date().toISOString(),
    daily,
  };
};
