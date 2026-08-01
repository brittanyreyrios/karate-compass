export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function formatDateRange(start: string, end: string | null): string {
  if (!end) return formatDateOnly(start);
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return `${formatDateOnly(start)}–${formatDateOnly(end)}`;
  }
  const starts = new Date(startYear, startMonth - 1, startDay);
  const ends = new Date(endYear, endMonth - 1, endDay);
  if (startYear === endYear && startMonth === endMonth) {
    return `${starts.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${endDay}, ${endYear}`;
  }
  return `${formatDateOnly(start)}–${formatDateOnly(end)}`;
}