import {
  aggregateToMajorMuscleContributions,
  MAJOR_MUSCLE_LABELS,
} from "../constants/muscles";

export const formatWeight = (weight: number | null | undefined) => {
  if (weight === null || weight === undefined) return "-";
  return `${weight} kg`;
};

export const formatDuration = (startedAt?: string, endedAt?: string) => {
  if (!startedAt) return "-";

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

export const formatSessionDuration = (startedAt?: string, endedAt?: string) => {
  if (!startedAt) return "-";

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${minutes}m`;
};

export const formatRestPreset = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
};

export const titleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatMuscleSplitSummary = (
  muscleContributions: Record<string, number> | Partial<Record<string, number>>,
  limit: number = 2
) => {
  const entries = Object.entries(
    aggregateToMajorMuscleContributions(muscleContributions)
  )
    .filter(([, value]) => typeof value === "number" && value > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, limit)
    .map(([muscle]) => MAJOR_MUSCLE_LABELS[muscle as keyof typeof MAJOR_MUSCLE_LABELS] ?? titleCase(muscle));

  return entries.length > 0 ? entries.join(", ") : "-";
};

export const formatWeightReps = (
  weight: number | null | undefined,
  reps: number | null | undefined
) => {
  if (weight == null && reps == null) return "-";
  if (weight == null) return `${reps ?? "-"} reps`;
  if (reps == null) return `${weight} kg`;
  return `${weight} x ${reps}`;
};

export const calculateSessionVolume = (
  sets: Array<{ weight: number | null; reps: number | null; completed?: boolean }>
) =>
  sets.reduce((total, set) => {
    if (set.completed === false) return total;
    return total + (set.weight ?? 0) * (set.reps ?? 0);
  }, 0);
