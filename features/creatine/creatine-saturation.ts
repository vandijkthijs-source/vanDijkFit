export const CREATINE_PORTION_OPTIONS = [5, 10, 15, 20];

const SATURATION_DECAY_PER_MISSED_DAY = 3;
const MAINTENANCE_GRAMS = 5;
const MAINTENANCE_GAIN = 4;
const LOADING_GRAMS = 20;
const LOADING_GAIN = 15;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const parseDateKeyUtcTime = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return Number.NaN;
  }

  return Date.UTC(year, month - 1, day);
};

const formatDateKeyFromUtcTime = (time: number) => {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getCreatineGainForGrams = (grams: number) => {
  const safeGrams = Math.max(0, grams);

  if (safeGrams >= LOADING_GRAMS) {
    return LOADING_GAIN;
  }

  return (safeGrams / MAINTENANCE_GRAMS) * MAINTENANCE_GAIN;
};

export const calculateCreatineSaturation = (
  logs: Record<string, number>,
  targetDateKey: string
) => {
  const loggedDates = Object.entries(logs)
    .filter(([, grams]) => grams > 0)
    .map(([dateKey]) => dateKey)
    .sort();

  if (loggedDates.length === 0) {
    return 0;
  }

  const firstLogTime = parseDateKeyUtcTime(loggedDates[0]);
  const targetTime = parseDateKeyUtcTime(targetDateKey);

  if (!Number.isFinite(firstLogTime) || !Number.isFinite(targetTime)) {
    return 0;
  }

  let saturation = 0;

  for (let time = firstLogTime; time <= targetTime; time += 24 * 60 * 60 * 1000) {
    const dateKey = formatDateKeyFromUtcTime(time);
    const grams = logs[dateKey] ?? 0;

    saturation = clampPercent(
      grams > 0
        ? saturation + getCreatineGainForGrams(grams)
        : saturation - SATURATION_DECAY_PER_MISSED_DAY
    );
  }

  return Math.round(saturation);
};
