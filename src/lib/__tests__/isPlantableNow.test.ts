import { describe, expect, it } from "vitest";
import { getPlantsPlantableNow } from "../isPlantableNow";
import { createTestPlant } from "./helpers";

describe("getPlantsPlantableNow", () => {
  it("returns only plants that are in a live window for the selected zone", () => {
    const directSowWins = createTestPlant({
      id: "beans",
      name: "Beans",
      plantingWindows: [
        {
          zoneRange: "5-6",
          season: "spring",
          directSow: {
            startWeeksAfterLastFrost: 0,
            endWeeksAfterLastFrost: 2
          },
          transplantOutdoors: {
            startWeeksAfterLastFrost: 0,
            endWeeksAfterLastFrost: 1
          },
          startIndoors: {
            startWeeksBeforeLastFrost: 2,
            endWeeksAfterLastFrost: 0
          }
        }
      ]
    });

    const startIndoorsOnly = createTestPlant({
      id: "broccoli",
      name: "Broccoli",
      plantingWindows: [
        {
          zoneRange: "5-6",
          season: "spring",
          startIndoors: {
            startWeeksBeforeLastFrost: 1,
            endWeeksAfterLastFrost: 0
          }
        }
      ]
    });

    const wrongZone = createTestPlant({
      id: "pepper",
      name: "Pepper",
      plantingWindows: [
        {
          zoneRange: "7-8",
          season: "spring",
          transplantOutdoors: {
            startWeeksAfterLastFrost: 0,
            endWeeksAfterLastFrost: 2
          }
        }
      ]
    });

    const closedWindow = createTestPlant({
      id: "garlic",
      name: "Garlic",
      plantingWindows: [
        {
          zoneRange: "5-6",
          season: "fall",
          directSow: {
            startWeeksAfterLastFrost: 20,
            endWeeksAfterLastFrost: 24
          }
        }
      ]
    });

    const results = getPlantsPlantableNow(
      [directSowWins, startIndoorsOnly, wrongZone, closedWindow],
      "5-6",
      new Date(2026, 3, 22, 12)
    );

    expect(results).toEqual([
      {
        plant: directSowWins,
        label: "Direct sow now",
        season: "spring"
      },
      {
        plant: startIndoorsOnly,
        label: "Start indoors now",
        season: "spring"
      }
    ]);
  });
});
