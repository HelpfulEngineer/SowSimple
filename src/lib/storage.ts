import { isUSDAZone, type USDAZone } from "./zones";

const ZONE_KEY = "harvest-tracker-zone";
const RECENTS_KEY = "harvest-tracker-recents";
const LIBRARY_VIEW_KEY = "sow-simple-library-view";

export type LibraryView = "cards" | "list";

function isLibraryView(value: string | null): value is LibraryView {
  return value === "cards" || value === "list";
}

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

export function getStoredLibraryView(): LibraryView {
  try {
    const value = localStorage.getItem(LIBRARY_VIEW_KEY);
    return isLibraryView(value) ? value : "cards";
  } catch {
    return "cards";
  }
}

export function setStoredLibraryView(view: LibraryView): void {
  try {
    localStorage.setItem(LIBRARY_VIEW_KEY, view);
  } catch {
    // ignore storage errors
  }
}
