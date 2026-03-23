import type { ZoneRange } from "../types/plant";

export const USDA_ZONES = ["3", "4", "5", "6", "7", "8", "9", "10"] as const;

export type USDAZone = (typeof USDA_ZONES)[number];

export const USDA_ZONE_REGIONS: Record<USDAZone, string> = {
  "3": "far northern interior and colder mountain areas",
  "4": "northern Plains and upper Midwest",
  "5": "Great Lakes and interior Northeast",
  "6": "central Midwest and inland Mid-Atlantic",
  "7": "Mid-South and inland Southeast",
  "8": "Southeast and Pacific Northwest coast",
  "9": "Deep South, southern Texas, and coastal California",
  "10": "South Florida and warmest coastal southern California"
};

export function isUSDAZone(value: string | null): value is USDAZone {
  return USDA_ZONES.includes(value as USDAZone);
}

export function getZoneRange(zone: USDAZone): ZoneRange {
  if (zone === "3" || zone === "4") return "3-4";
  if (zone === "5" || zone === "6") return "5-6";
  if (zone === "7" || zone === "8") return "7-8";
  return "9-10";
}
