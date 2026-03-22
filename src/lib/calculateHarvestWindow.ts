import { addDays } from "./date";
import type { HarvestInfo } from "../types/plant";

export type HarvestWindowResult = {
  harvestStartMin: Date;
  harvestStartMax: Date;
  harvestEndMin: Date;
  harvestEndMax: Date;
};

export function calculateHarvestWindow(
  plantingDate: Date,
  harvest: HarvestInfo
): HarvestWindowResult {
  const harvestStartMin = addDays(plantingDate, harvest.daysToFirstHarvestMin);
  const harvestStartMax = addDays(plantingDate, harvest.daysToFirstHarvestMax);
  const harvestEndMin = addDays(harvestStartMin, harvest.windowLengthDaysMin);
  const harvestEndMax = addDays(harvestStartMax, harvest.windowLengthDaysMax);

  return {
    harvestStartMin,
    harvestStartMax,
    harvestEndMin,
    harvestEndMax
  };
}
