import type { ZoneRange } from "../types/plant";

export const USDA_ZONES = ["3", "4", "5", "6", "7", "8", "9", "10"] as const;

export type USDAZone = (typeof USDA_ZONES)[number];

export function isUSDAZone(value: string | null): value is USDAZone {
  return USDA_ZONES.includes(value as USDAZone);
}

export function getZoneRange(zone: USDAZone): ZoneRange {
  if (zone === "3" || zone === "4") return "3-4";
  if (zone === "5" || zone === "6") return "5-6";
  if (zone === "7" || zone === "8") return "7-8";
  return "9-10";
}
