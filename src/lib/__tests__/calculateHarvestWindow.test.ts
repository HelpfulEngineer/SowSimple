import { describe, expect, it } from "vitest";
import { calculateHarvestWindow } from "../calculateHarvestWindow";
import { dateParts } from "./helpers";

describe("calculateHarvestWindow", () => {
  it("calculates harvest start and end ranges from the planting date", () => {
    const result = calculateHarvestWindow(
      new Date(2026, 4, 1, 12),
      {
        daysToFirstHarvestMin: 60,
        daysToFirstHarvestMax: 75,
        windowLengthDaysMin: 14,
        windowLengthDaysMax: 28
      }
    );

    expect(dateParts(result.harvestStartMin)).toEqual([2026, 5, 30]);
    expect(dateParts(result.harvestStartMax)).toEqual([2026, 6, 15]);
    expect(dateParts(result.harvestEndMin)).toEqual([2026, 6, 14]);
    expect(dateParts(result.harvestEndMax)).toEqual([2026, 7, 12]);
  });
});
