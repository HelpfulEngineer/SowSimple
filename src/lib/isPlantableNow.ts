import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { normalizeCalendarDate } from "./date";
import { resolvePlantingMethodWindow } from "./resolvePlantingWindow";
import type { Plant, PlantingWindow, ZoneRange } from "../types/plant";

export type PlantableNowMatch = {
  plant: Plant;
  label: "Start indoors now" | "Direct sow now" | "Transplant now";
  season: string;
};

function isTodayInMethodWindow(
  today: Date,
  plantingWindow: PlantingWindow,
  key: "startIndoors" | "directSow" | "transplantOutdoors",
  anchor: Date
): boolean {
  const method = plantingWindow[key];
  if (!method) return false;
  const bounds = resolvePlantingMethodWindow(anchor, method);
  if (!bounds) return false;

  return today >= bounds.start && today <= bounds.end;
}

export function getPlantsPlantableNow(
  plants: Plant[],
  zone: ZoneRange,
  today = new Date()
): PlantableNowMatch[] {
  const currentDate = normalizeCalendarDate(today);
  const frost = LAST_FROST_BY_ZONE[zone];
  const anchor = new Date(currentDate.getFullYear(), frost.month - 1, frost.day, 12);

  const results: PlantableNowMatch[] = [];

  for (const plant of plants) {
    const relevantWindows = plant.plantingWindows.filter((w) => w.zoneRange === zone);

    for (const window of relevantWindows) {
      if (isTodayInMethodWindow(currentDate, window, "directSow", anchor)) {
        results.push({ plant, label: "Direct sow now", season: window.season });
        break;
      }
      if (isTodayInMethodWindow(currentDate, window, "transplantOutdoors", anchor)) {
        results.push({ plant, label: "Transplant now", season: window.season });
        break;
      }
      if (isTodayInMethodWindow(currentDate, window, "startIndoors", anchor)) {
        results.push({ plant, label: "Start indoors now", season: window.season });
        break;
      }
    }
  }

  return results;
}
