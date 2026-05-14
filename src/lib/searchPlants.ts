import type { Plant, PlantCategory } from "../types/plant";

export type PlantCategoryFilter = "all" | PlantCategory;

const searchAliasesByPlantId: Record<string, string[]> = {
  "walla-walla-onion": [
    "walla walla sweet onion",
    "wala wala onion",
    "sweet onion"
  ],
  "green-onion": [
    "bunching onion",
    "scallion",
    "scallions",
    "spring onion",
    "spring onions"
  ],
  "green-beans": [
    "snap beans",
    "string beans",
    "bush beans",
    "pole beans"
  ],
  peas: ["easy peas", "garden peas", "shelling peas", "english peas"],
  "sugar-snap-peas": ["snap peas", "sugar snaps", "edible pod peas"],
  radish: ["radishes"],
  onion: ["bulb onion", "storage onion", "yellow onion"],
  pepper: ["sweet pepper", "bell pepper"],
  "orange-bell-pepper": ["orange pepper", "sweet pepper", "bell pepper"],
  "jalapeno-pepper": ["jalapeno", "hot pepper", "chile pepper"],
  "hot-banana-pepper": ["banana pepper", "hot pepper", "wax pepper"],
  tomato: ["garden tomato"],
  "cherry-tomato": ["grape tomato", "small tomato"],
  "heirloom-tomato": ["heirloom"],
  "slicer-tomato": ["slicing tomato", "fresh tomato"],
  lettuce: ["leaf lettuce", "garden lettuce"],
  "butter-lettuce": ["butterhead lettuce", "bibb lettuce", "boston lettuce"],
  "brussels-sprouts": ["brussel sprouts", "brussels sprout"],
  zucchini: ["courgette"],
  "summer-squash": ["yellow squash", "crookneck squash"],
  "spaghetti-squash": ["winter squash", "vegetable spaghetti"]
};

export function searchPlants(
  plants: Plant[],
  query: string,
  category: PlantCategoryFilter = "all"
) {
  const normalizedQuery = query.trim().toLowerCase();

  return plants.filter((plant) => {
    if (category !== "all" && plant.category !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      plant.name,
      plant.id.replace(/-/g, " "),
      plant.summary,
      plant.pruning.shortGuide,
      ...(searchAliasesByPlantId[plant.id] ?? []),
      ...(plant.seasonalityNotes ?? []),
      ...plant.companions.map((companion) => companion.name),
      ...plant.companions.map((companion) => companion.reason)
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
