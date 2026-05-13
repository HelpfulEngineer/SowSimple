import { describe, expect, it } from "vitest";
import { searchPlants } from "../searchPlants";
import { createTestPlant } from "./helpers";

describe("searchPlants", () => {
  const tomato = createTestPlant({
    id: "tomato",
    name: "Tomato",
    category: "vegetable",
    summary: "A warm-season favorite for sunny beds.",
    companions: [
      {
        plantId: "basil",
        name: "Basil",
        reason: "A classic kitchen-garden pairing.",
        confidence: "traditional"
      }
    ]
  });

  const dill = createTestPlant({
    id: "dill",
    name: "Dill",
    category: "herb",
    summary: "Feathery herb for leaves and seed.",
    seasonalityNotes: ["Cool-season herb"]
  });

  it("returns all plants when the query is empty", () => {
    expect(searchPlants([tomato, dill], "   ")).toEqual([tomato, dill]);
  });

  it("filters by category before matching", () => {
    expect(searchPlants([tomato, dill], "", "herb")).toEqual([dill]);
  });

  it("matches companion names and reasons case-insensitively", () => {
    expect(searchPlants([tomato, dill], "kitchen-garden")).toEqual([tomato]);
    expect(searchPlants([tomato, dill], "BASIL")).toEqual([tomato]);
  });
});
