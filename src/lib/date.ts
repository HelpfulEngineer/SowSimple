export function createCalendarDate(
  year: number,
  monthIndex: number,
  day: number
) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

export function normalizeCalendarDate(date: Date) {
  return createCalendarDate(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const nextDate = normalizeCalendarDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return normalizeCalendarDate(nextDate);
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(normalizeCalendarDate(date));
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(normalizeCalendarDate(date));
}

export function formatDateRange(start: Date, end: Date) {
  return `${formatShortDate(start)} to ${formatShortDate(end)}`;
}

export function formatDateInput(date: Date) {
  const normalized = normalizeCalendarDate(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return createCalendarDate(year, month - 1, day);
}
