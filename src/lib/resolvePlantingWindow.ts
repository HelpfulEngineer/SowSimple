import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { addDays, createCalendarDate, normalizeCalendarDate } from "./date";
import type { PlantingMethodWindow, ZoneRange } from "../types/plant";

export type PlantingMethodKey =
  | "startIndoors"
  | "transplantOutdoors"
  | "directSow";

export const METHOD_LABELS: Record<PlantingMethodKey, string> = {
  startIndoors: "Start indoors",
  transplantOutdoors: "Transplant outdoors",
  directSow: "Direct sow"
};

export const CALCULATOR_METHODS: PlantingMethodKey[] = [
  "directSow",
  "transplantOutdoors"
];

function resolveRelativeDate(
  anchor: Date,
  weeksBefore?: number,
  weeksAfter?: number
) {
  if (typeof weeksBefore === "number") {
    return addDays(anchor, -7 * weeksBefore);
  }

  if (typeof weeksAfter === "number") {
    return addDays(anchor, 7 * weeksAfter);
  }

  return null;
}

export function getLastFrostAnchor(zone: ZoneRange, year: number) {
  const frost = LAST_FROST_BY_ZONE[zone];
  return createCalendarDate(year, frost.month - 1, frost.day);
}

export function resolvePlantingMethodWindow(
  anchor: Date,
  methodWindow: PlantingMethodWindow | null | undefined
) {
  if (!methodWindow) return null;

  const start =
    resolveRelativeDate(
      anchor,
      methodWindow.startWeeksBeforeLastFrost,
      methodWindow.startWeeksAfterLastFrost
    ) ??
    resolveRelativeDate(
      anchor,
      methodWindow.endWeeksBeforeLastFrost,
      methodWindow.endWeeksAfterLastFrost
    );

  const end =
    resolveRelativeDate(
      anchor,
      methodWindow.endWeeksBeforeLastFrost,
      methodWindow.endWeeksAfterLastFrost
    ) ??
    resolveRelativeDate(
      anchor,
      methodWindow.startWeeksBeforeLastFrost,
      methodWindow.startWeeksAfterLastFrost
    );

  if (!start || !end) return null;

  return start <= end
    ? { start: normalizeCalendarDate(start), end: normalizeCalendarDate(end) }
    : { start: normalizeCalendarDate(end), end: normalizeCalendarDate(start) };
}

export function getWindowStatus(today: Date, start: Date, end: Date) {
  const currentDate = normalizeCalendarDate(today);
  if (currentDate < start) return "Upcoming";
  if (currentDate > end) return "Closed";
  return "Open now";
}
