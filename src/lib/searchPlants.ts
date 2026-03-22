import type { Plant, PlantCategory } from "../types/plant";

export type PlantCategoryFilter = "all" | PlantCategory;

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
      ...(plant.seasonalityNotes ?? []),
      ...plant.companions.map((companion) => companion.name),
      ...plant.companions.map((companion) => companion.reason)
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
