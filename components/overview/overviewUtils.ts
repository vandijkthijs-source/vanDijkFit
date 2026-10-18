export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const formatWeekLabel = (date: Date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

export const formatWeekRangeLabel = (weekStart: Date) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return `${formatWeekLabel(weekStart)} - ${formatWeekLabel(weekEnd)}`;
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getOffsetDateKey = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);

  return getLocalDateKey(date);
};
