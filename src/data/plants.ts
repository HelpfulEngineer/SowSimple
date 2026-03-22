import rawPlants from "./plants.json";
import type { Plant } from "../types/plant";

export const plants = (rawPlants as Plant[]).sort((left, right) =>
  left.name.localeCompare(right.name)
);

const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

export function getPlantById(id: string) {
  return plantsById.get(id) ?? null;
}
