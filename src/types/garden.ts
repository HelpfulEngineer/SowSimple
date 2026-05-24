export type GardenBedShape =
  | "rectangle"
  | "circle"
  | "oval"
  | "triangle"
  | "custom";

export type GardenPoint = {
  x: number;
  y: number;
};

export type GardenPlanting = {
  id: string;
  plantId?: string;
  customName?: string;
  x: number;
  y: number;
  plantedOn?: string;
};

export type GardenBed = {
  id: string;
  nickname: string;
  shape: GardenBedShape;
  x: number;
  y: number;
  width: number;
  height: number;
  customPoints?: GardenPoint[];
  plantings: GardenPlanting[];
};

export type GardenTrackerState = {
  beds: GardenBed[];
  selectedBedId: string | null;
};
