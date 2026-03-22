import { isUSDAZone, type USDAZone } from "./zones";

const ZONE_KEY = "harvest-tracker-zone";
const RECENTS_KEY = "harvest-tracker-recents";

export function getStoredZone(): USDAZone | null {
  try {
    const value = localStorage.getItem(ZONE_KEY);
    return isUSDAZone(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredZone(zone: USDAZone): void {
  try {
    localStorage.setItem(ZONE_KEY, zone);
  } catch {
    // ignore storage errors
  }
}

export function getRecentPlantIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentPlantId(plantId: string): void {
  try {
    const existing = getRecentPlantIds().filter((id) => id !== plantId);
    const next = [plantId, ...existing].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}
