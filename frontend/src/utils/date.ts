export const formatKst = (
  value?: string | null,
  fallback: string = "-"
): string => {
  if (!value) {
    return fallback;
  }

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};
