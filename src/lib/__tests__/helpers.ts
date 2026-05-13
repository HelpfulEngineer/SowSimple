import type { HarvestInfo, Plant } from "../../types/plant";

type TestPlantOverrides = Partial<Plant> & Pick<Plant, "id">;

export function createTestPlant(overrides: TestPlantOverrides): Plant {
  const spacing = {
    minInches: 6,
    maxInches: 12,
    ...(overrides.spacing ?? {})
  };

  const pruning = {
    shortGuide: "No pruning needed.",
    ...(overrides.pruning ?? {})
  };

  const harvest: HarvestInfo = {
    daysToFirstHarvestMin: 50,
    daysToFirstHarvestMax: 60,
    windowLengthDaysMin: 14,
    windowLengthDaysMax: 21,
    ...(overrides.harvest ?? {})
  };

  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    category: overrides.category ?? "vegetable",
    summary: overrides.summary ?? "Test plant summary.",
    spacing,
    pruning,
    plantingWindows: overrides.plantingWindows ?? [],
    companions: overrides.companions ?? [],
    harvest,
    seasonalityNotes: overrides.seasonalityNotes ?? []
  };
}

export function dateParts(date: Date) {
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}
