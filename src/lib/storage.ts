import { isUSDAZone, type USDAZone } from "./zones";
import type { PlantCategoryFilter } from "./searchPlants";
import type {
  GardenBed,
  GardenBedShape,
  GardenPoint,
  GardenPlanting,
  GardenTrackerState
} from "../types/garden";

const ZONE_KEY = "harvest-tracker-zone";
const RECENTS_KEY = "harvest-tracker-recents";
const LIBRARY_VIEW_KEY = "sow-simple-library-view";
const HOME_PAGE_STATE_KEY = "sow-simple-home-page-state";
const GARDEN_TRACKER_KEY = "sow-simple-garden-tracker-v1";

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

function isGardenBedShape(value: unknown): value is GardenBedShape {
  return (
    value === "rectangle" ||
    value === "circle" ||
    value === "oval" ||
    value === "triangle" ||
    value === "custom"
  );
}

function clampPercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : fallback;
}

function getCleanId(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function normalizePlanting(
  planting: unknown,
  index: number
): GardenPlanting | null {
  if (!planting || typeof planting !== "object") return null;

  const partial = planting as Partial<GardenPlanting>;
  const plantId =
    typeof partial.plantId === "string" && partial.plantId.trim().length > 0
      ? partial.plantId
      : undefined;
  const customName =
    typeof partial.customName === "string" &&
    partial.customName.trim().length > 0
      ? partial.customName
      : undefined;

  if (!plantId && !customName) return null;

  return {
    id: getCleanId(partial.id, `planting-${index}`),
    plantId,
    customName,
    x: clampPercent(partial.x, 50),
    y: clampPercent(partial.y, 50),
    plantedOn:
      typeof partial.plantedOn === "string" ? partial.plantedOn : undefined
  };
}

function normalizeGardenPoint(point: unknown): GardenPoint | null {
  if (!point || typeof point !== "object") return null;

  const partial = point as Partial<GardenPoint>;

  return {
    x: clampPercent(partial.x, 50),
    y: clampPercent(partial.y, 50)
  };
}

function normalizeGardenBed(bed: unknown, index: number): GardenBed | null {
  if (!bed || typeof bed !== "object") return null;

  const partial = bed as Partial<GardenBed>;
  const shape = isGardenBedShape(partial.shape) ? partial.shape : "rectangle";
  const width = Math.min(92, Math.max(16, clampPercent(partial.width, 30)));
  const height = Math.min(92, Math.max(16, clampPercent(partial.height, 22)));
  const plantings = Array.isArray(partial.plantings)
    ? partial.plantings.flatMap((planting, plantingIndex) => {
        const normalized = normalizePlanting(planting, plantingIndex);
        return normalized ? [normalized] : [];
      })
    : [];
  const customPoints = Array.isArray(partial.customPoints)
    ? partial.customPoints.flatMap((point) => {
        const normalized = normalizeGardenPoint(point);
        return normalized ? [normalized] : [];
      })
    : undefined;

  return {
    id: getCleanId(partial.id, `bed-${index}`),
    nickname:
      typeof partial.nickname === "string" && partial.nickname.trim().length > 0
        ? partial.nickname
        : `Garden Bed ${index + 1}`,
    shape,
    x: Math.min(100 - width, clampPercent(partial.x, 8 + index * 4)),
    y: Math.min(100 - height, clampPercent(partial.y, 8 + index * 4)),
    width,
    height,
    customPoints:
      customPoints && customPoints.length >= 3 ? customPoints : undefined,
    plantings
  };
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

export function getStoredGardenTrackerState(): GardenTrackerState {
  try {
    const raw = localStorage.getItem(GARDEN_TRACKER_KEY);
    if (!raw) return { beds: [], selectedBedId: null };

    const parsed = JSON.parse(raw) as Partial<GardenTrackerState>;
    const beds = Array.isArray(parsed.beds)
      ? parsed.beds.flatMap((bed, index) => {
          const normalized = normalizeGardenBed(bed, index);
          return normalized ? [normalized] : [];
        })
      : [];
    const selectedBedId =
      typeof parsed.selectedBedId === "string" &&
      beds.some((bed) => bed.id === parsed.selectedBedId)
        ? parsed.selectedBedId
        : beds[0]?.id ?? null;

    return { beds, selectedBedId };
  } catch {
    return { beds: [], selectedBedId: null };
  }
}

export function setStoredGardenTrackerState(state: GardenTrackerState): void {
  try {
    localStorage.setItem(GARDEN_TRACKER_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}
