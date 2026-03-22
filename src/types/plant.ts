export type PlantCategory = "vegetable" | "herb" | "flower";
export type CompanionConfidence = "practical" | "traditional";
export type Season = "spring" | "summer" | "fall";
export type ZoneRange = "3-4" | "5-6" | "7-8" | "9-10";

export type PlantingMethodWindow = {
  startWeeksBeforeLastFrost?: number;
  endWeeksBeforeLastFrost?: number;
  startWeeksAfterLastFrost?: number;
  endWeeksAfterLastFrost?: number;
};

export type PlantingWindow = {
  zoneRange: ZoneRange;
  season: Season;
  startIndoors?: PlantingMethodWindow | null;
  transplantOutdoors?: PlantingMethodWindow | null;
  directSow?: PlantingMethodWindow | null;
  notes?: string;
};

export type CompanionPlant = {
  plantId: string;
  name: string;
  reason: string;
  confidence: CompanionConfidence;
};

export type HarvestInfo = {
  daysToFirstHarvestMin: number;
  daysToFirstHarvestMax: number;
  windowLengthDaysMin: number;
  windowLengthDaysMax: number;
  notes?: string;
};

export type Plant = {
  id: string;
  name: string;
  category: PlantCategory;
  summary: string;
  spacing: {
    minInches: number;
    maxInches: number;
  };
  pruning: {
    shortGuide: string;
  };
  plantingWindows: PlantingWindow[];
  companions: CompanionPlant[];
  harvest: HarvestInfo;
  seasonalityNotes?: string[];
};