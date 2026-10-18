export const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    hour12: false,
  });
};

export const formatTime = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatTimeRange = (startedAt?: string, endedAt?: string) => {
  if (!startedAt) return "-";
  return `${formatTime(startedAt)} - ${formatTime(endedAt)}`;
};

export const formatShortDate = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
};

export const daysAgoText = (iso?: string) => {
  if (!iso) return "Never";
  const now = new Date().getTime();
  const then = new Date(iso).getTime();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};
