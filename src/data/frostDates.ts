import type { ZoneRange } from "../types/plant";

export const LAST_FROST_BY_ZONE: Record<
  ZoneRange,
  { month: number; day: number; label: string }
> = {
  "3-4": { month: 5, day: 22, label: "Approx. May 22" },
  "5-6": { month: 4, day: 22, label: "Approx. April 22" },
  "7-8": { month: 3, day: 22, label: "Approx. March 22" },
  "9-10": { month: 2, day: 1, label: "Approx. February 1" }
};