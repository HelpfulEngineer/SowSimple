import { isUSDAZone, type USDAZone } from "./zones";
import type { PlantCategoryFilter } from "./searchPlants";

const ZONE_KEY = "harvest-tracker-zone";
const RECENTS_KEY = "harvest-tracker-recents";
const LIBRARY_VIEW_KEY = "sow-simple-library-view";
const HOME_PAGE_STATE_KEY = "sow-simple-home-page-state";

export type LibraryView = "cards" | "list";

export type HomePageState = {
  query: string;
  category: PlantCategoryFilter;
  libraryView: LibraryView;
  isPlantingNowCollapsed: boolean;
  isRecentCollapsed: boolean;
  scrollY: number;
};

function isLibraryView(value: string | null): value is LibraryView {
  return value === "cards" || value === "list";
}

function isPlantCategoryFilter(value: unknown): value is PlantCategoryFilter {
  return (
    value === "all" ||
    value === "vegetable" ||
    value === "herb" ||
    value === "flower"
  );
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

export function getStoredHomePageState(): HomePageState | null {
  try {
    const raw = sessionStorage.getItem(HOME_PAGE_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HomePageState>;
    const parsedLibraryView = parsed.libraryView ?? null;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      category: isPlantCategoryFilter(parsed.category)
        ? parsed.category
        : "all",
      libraryView: isLibraryView(parsedLibraryView)
        ? parsedLibraryView
        : getStoredLibraryView(),
      isPlantingNowCollapsed:
        typeof parsed.isPlantingNowCollapsed === "boolean"
          ? parsed.isPlantingNowCollapsed
          : true,
      isRecentCollapsed:
        typeof parsed.isRecentCollapsed === "boolean"
          ? parsed.isRecentCollapsed
          : true,
      scrollY:
        typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY)
          ? Math.max(0, parsed.scrollY)
          : 0
    };
  } catch {
    return null;
  }
}

export function setStoredHomePageState(state: HomePageState): void {
  try {
    sessionStorage.setItem(HOME_PAGE_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}
