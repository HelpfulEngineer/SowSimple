import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";
import { useNavigate } from "react-router-dom";
import { plants, getPlantById } from "../data/plants";
import {
  getStoredGardenTrackerState,
  setStoredGardenTrackerState
} from "../lib/storage";
import type {
  GardenBed,
  GardenBedShape,
  GardenPoint,
  GardenPlanting,
  GardenTrackerState
} from "../types/garden";
import type { Plant } from "../types/plant";

const CUSTOM_PLANT_VALUE = "__custom__";

const SHAPE_OPTIONS: Array<{ value: GardenBedShape; label: string }> = [
  { value: "rectangle", label: "Rectangle" },
  { value: "circle", label: "Round" },
  { value: "oval", label: "Oval" },
  { value: "triangle", label: "Triangle" },
  { value: "custom", label: "Custom" }
];

const DEFAULT_BED_SIZES: Record<
  GardenBedShape,
  { width: number; height: number }
> = {
  rectangle: { width: 34, height: 24 },
  circle: { width: 26, height: 26 },
  oval: { width: 38, height: 22 },
  triangle: { width: 34, height: 30 },
  custom: { width: 38, height: 30 }
};

const DEFAULT_CUSTOM_POINTS: GardenPoint[] = [
  { x: 12, y: 26 },
  { x: 40, y: 8 },
  { x: 80, y: 16 },
  { x: 92, y: 58 },
  { x: 66, y: 92 },
  { x: 18, y: 82 }
];

const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 2.5;
const MAP_ZOOM_STEP = 0.25;

const categoryMarkerClasses = {
  vegetable: "bg-pine text-white ring-pine/25",
  herb: "bg-clay text-white ring-clay/25",
  flower: "bg-amber-400 text-slate-950 ring-amber-300/50"
} as const;

type GardenMode = "beds" | "plants";

type BedDragState = {
  kind: "bed";
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type PlantingDragState = {
  kind: "planting";
  bedId: string;
  plantingId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  bedWidthPx: number;
  bedHeightPx: number;
  moved: boolean;
  plantId?: string;
};

type CustomPointDragState = {
  kind: "custom-point";
  bedId: string;
  pointIndex: number;
  pointerId: number;
};

type DragState = BedDragState | PlantingDragState | CustomPointDragState;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPointerPercent(
  event: PointerEvent,
  element: HTMLElement
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
  };
}

function getCustomPoints(bed: GardenBed): GardenPoint[] {
  return bed.customPoints && bed.customPoints.length >= 3
    ? bed.customPoints
    : DEFAULT_CUSTOM_POINTS;
}

function getCustomClipPath(points: GardenPoint[]) {
  return `polygon(${points
    .map((point) => `${point.x}% ${point.y}%`)
    .join(", ")})`;
}

function getShapeLayerStyle(
  shape: GardenBedShape,
  customPoints?: GardenPoint[]
): CSSProperties {
  if (shape === "custom") {
    return {
      clipPath: getCustomClipPath(customPoints ?? DEFAULT_CUSTOM_POINTS),
      borderRadius: "0.45rem"
    };
  }

  if (shape === "triangle") {
    return {
      clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
      borderRadius: "0.35rem"
    };
  }

  if (shape === "rectangle") {
    return { borderRadius: "1rem" };
  }

  return { borderRadius: "9999px" };
}

function getPlantingLabel(planting: GardenPlanting) {
  if (planting.plantId) {
    return getPlantById(planting.plantId)?.name ?? "Saved plant";
  }

  return planting.customName ?? "Custom plant";
}

function getPlantingPlant(planting: GardenPlanting): Plant | null {
  return planting.plantId ? getPlantById(planting.plantId) : null;
}

function createGardenBed(
  shape: GardenBedShape,
  index: number,
  x?: number,
  y?: number
): GardenBed {
  const size = DEFAULT_BED_SIZES[shape];
  const fallbackOffset = (index * 7) % 34;
  const nextX = x ?? 10 + fallbackOffset;
  const nextY = y ?? 12 + fallbackOffset;

  return {
    id: makeId("bed"),
    nickname: `Garden Bed ${index + 1}`,
    shape,
    x: clamp(nextX, 0, 100 - size.width),
    y: clamp(nextY, 0, 100 - size.height),
    width: size.width,
    height: size.height,
    customPoints: shape === "custom" ? DEFAULT_CUSTOM_POINTS : undefined,
    plantings: []
  };
}

function updateBedInState(
  state: GardenTrackerState,
  bedId: string,
  updater: (bed: GardenBed) => GardenBed
): GardenTrackerState {
  return {
    ...state,
    beds: state.beds.map((bed) => (bed.id === bedId ? updater(bed) : bed))
  };
}

function updatePlantingInState(
  state: GardenTrackerState,
  bedId: string,
  plantingId: string,
  updater: (planting: GardenPlanting) => GardenPlanting
): GardenTrackerState {
  return updateBedInState(state, bedId, (bed) => ({
    ...bed,
    plantings: bed.plantings.map((planting) =>
      planting.id === plantingId ? updater(planting) : planting
    )
  }));
}

export function GardenTrackerPage() {
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [gardenState, setGardenState] = useState<GardenTrackerState>(() =>
    getStoredGardenTrackerState()
  );
  const [mode, setMode] = useState<GardenMode>("beds");
  const [selectedShape, setSelectedShape] =
    useState<GardenBedShape>("rectangle");
  const [plantQuery, setPlantQuery] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    plants[0]?.id ?? CUSTOM_PLANT_VALUE
  );
  const [customPlantName, setCustomPlantName] = useState("Custom plant");
  const [mapZoom, setMapZoom] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const selectedBed =
    gardenState.beds.find((bed) => bed.id === gardenState.selectedBedId) ??
    null;
  const selectedPlant =
    selectedPlantId === CUSTOM_PLANT_VALUE
      ? null
      : getPlantById(selectedPlantId);
  const normalizedPlantQuery = plantQuery.trim().toLocaleLowerCase();
  const matchingPlants = useMemo(() => {
    const matches = normalizedPlantQuery
      ? plants.filter((plant) => {
          const searchable = `${plant.name} ${plant.category} ${plant.summary}`
            .toLocaleLowerCase();
          return searchable.includes(normalizedPlantQuery);
        })
      : plants;

    return matches.slice(0, 9);
  }, [normalizedPlantQuery]);
  const plantedCount = gardenState.beds.reduce(
    (total, bed) => total + bed.plantings.length,
    0
  );
  const mapZoomPercent = Math.round(mapZoom * 100);
  const boardStyle = {
    "--garden-zoom": String(mapZoom)
  } as CSSProperties;

  useEffect(() => {
    setStoredGardenTrackerState(gardenState);
  }, [gardenState]);

  function setSelectedBedId(bedId: string | null) {
    const bed = gardenState.beds.find((gardenBed) => gardenBed.id === bedId);
    if (bed) {
      setSelectedShape(bed.shape);
    }

    setGardenState((state) => ({ ...state, selectedBedId: bedId }));
  }

  function addBedAt(x?: number, y?: number) {
    setGardenState((state) => {
      const nextBed = createGardenBed(selectedShape, state.beds.length, x, y);

      return {
        beds: [...state.beds, nextBed],
        selectedBedId: nextBed.id
      };
    });
  }

  function handleBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (mode !== "beds") return;
    if (event.target !== event.currentTarget) return;

    const size = DEFAULT_BED_SIZES[selectedShape];
    const point = getPointerPercent(event, event.currentTarget);
    addBedAt(point.x - size.width / 2, point.y - size.height / 2);
  }

  function updateSelectedBed(updater: (bed: GardenBed) => GardenBed) {
    if (!selectedBed) return;

    setGardenState((state) =>
      updateBedInState(state, selectedBed.id, updater)
    );
  }

  function handleSelectedShapeChange(shape: GardenBedShape) {
    setSelectedShape(shape);

    if (!selectedBed) return;

    updateSelectedBed((bed) => {
      if (shape === "circle") {
        const diameter = Math.min(bed.width, bed.height);
        return {
          ...bed,
          shape,
          width: diameter,
          height: diameter,
          x: clamp(bed.x, 0, 100 - diameter),
          y: clamp(bed.y, 0, 100 - diameter)
        };
      }

      if (shape === "custom") {
        return {
          ...bed,
          shape,
          customPoints: getCustomPoints(bed)
        };
      }

      return { ...bed, shape };
    });
  }

  function updateSelectedBedSize(axis: "width" | "height", value: number) {
    if (!selectedBed) return;

    updateSelectedBed((bed) => {
      if (bed.shape === "circle") {
        const diameter = clamp(value, 16, 60);
        return {
          ...bed,
          width: diameter,
          height: diameter,
          x: clamp(bed.x, 0, 100 - diameter),
          y: clamp(bed.y, 0, 100 - diameter)
        };
      }

      const nextWidth = axis === "width" ? value : bed.width;
      const nextHeight = axis === "height" ? value : bed.height;

      return {
        ...bed,
        width: nextWidth,
        height: nextHeight,
        x: clamp(bed.x, 0, 100 - nextWidth),
        y: clamp(bed.y, 0, 100 - nextHeight)
      };
    });
  }

  function deleteSelectedBed() {
    if (!selectedBed) return;

    setGardenState((state) => {
      const beds = state.beds.filter((bed) => bed.id !== selectedBed.id);

      return {
        beds,
        selectedBedId: beds[0]?.id ?? null
      };
    });
  }

  function addPlantingToBed(
    bedId: string,
    point: { x: number; y: number }
  ) {
    const plant = selectedPlantId === CUSTOM_PLANT_VALUE
      ? null
      : getPlantById(selectedPlantId);
    const customName = customPlantName.trim() || "Custom plant";
    const planting: GardenPlanting = {
      id: makeId("planting"),
      x: clamp(point.x, 4, 96),
      y: clamp(point.y, 4, 96),
      ...(plant ? { plantId: plant.id } : { customName })
    };

    setGardenState((state) =>
      updateBedInState(
        {
          ...state,
          selectedBedId: bedId
        },
        bedId,
        (bed) => ({
          ...bed,
          plantings: [...bed.plantings, planting]
        })
      )
    );
  }

  function updateSelectedCustomPoints(
    updater: (points: GardenPoint[]) => GardenPoint[]
  ) {
    if (!selectedBed) return;

    updateSelectedBed((bed) => ({
      ...bed,
      shape: "custom",
      customPoints: updater(getCustomPoints(bed))
    }));
  }

  function addCustomPoint() {
    updateSelectedCustomPoints((points) => {
      if (points.length >= 10) return points;

      const previous = points[points.length - 1] ?? { x: 72, y: 72 };

      return [
        ...points,
        {
          x: clamp(previous.x - 12, 8, 92),
          y: clamp(previous.y + 6, 8, 92)
        }
      ];
    });
  }

  function removeCustomPoint() {
    updateSelectedCustomPoints((points) =>
      points.length > 3 ? points.slice(0, -1) : points
    );
  }

  function resetCustomPoints() {
    updateSelectedCustomPoints(() => DEFAULT_CUSTOM_POINTS);
  }

  function updateMapZoom(value: number) {
    setMapZoom(clamp(value, MIN_MAP_ZOOM, MAX_MAP_ZOOM));
  }

  function nudgeMapZoom(delta: number) {
    setMapZoom((currentZoom) =>
      clamp(
        Number((currentZoom + delta).toFixed(2)),
        MIN_MAP_ZOOM,
        MAX_MAP_ZOOM
      )
    );
  }

  function removePlanting(bedId: string, plantingId: string) {
    setGardenState((state) =>
      updateBedInState(state, bedId, (bed) => ({
        ...bed,
        plantings: bed.plantings.filter(
          (planting) => planting.id !== plantingId
        )
      }))
    );
  }

  function handleBedPointerDown(
    event: PointerEvent<HTMLDivElement>,
    bed: GardenBed
  ) {
    event.stopPropagation();
    setSelectedBedId(bed.id);

    if (mode === "plants") {
      addPlantingToBed(bed.id, getPointerPercent(event, event.currentTarget));
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "bed",
      id: bed.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: bed.x,
      originY: bed.y,
      width: bed.width,
      height: bed.height
    });
  }

  function handleBedPointerMove(
    event: PointerEvent<HTMLDivElement>,
    bed: GardenBed
  ) {
    if (
      dragState?.kind !== "bed" ||
      dragState.id !== bed.id ||
      dragState.pointerId !== event.pointerId ||
      !boardRef.current
    ) {
      return;
    }

    const boardRect = boardRef.current.getBoundingClientRect();
    const deltaX =
      ((event.clientX - dragState.startClientX) / boardRect.width) * 100;
    const deltaY =
      ((event.clientY - dragState.startClientY) / boardRect.height) * 100;

    setGardenState((state) =>
      updateBedInState(state, bed.id, (currentBed) => ({
        ...currentBed,
        x: clamp(dragState.originX + deltaX, 0, 100 - dragState.width),
        y: clamp(dragState.originY + deltaY, 0, 100 - dragState.height)
      }))
    );
  }

  function handleBedPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.kind !== "bed" || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  }

  function handleCustomPointPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    bedId: string,
    pointIndex: number
  ) {
    event.stopPropagation();
    setSelectedBedId(bedId);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "custom-point",
      bedId,
      pointIndex,
      pointerId: event.pointerId
    });
  }

  function handleCustomPointPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "custom-point" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.stopPropagation();
    const bedElement = event.currentTarget.closest<HTMLElement>("[data-bed-id]");
    if (!bedElement) return;

    const point = getPointerPercent(event, bedElement);

    setGardenState((state) =>
      updateBedInState(state, dragState.bedId, (bed) => {
        const points = getCustomPoints(bed);

        return {
          ...bed,
          shape: "custom",
          customPoints: points.map((currentPoint, index) =>
            index === dragState.pointIndex
              ? {
                  x: clamp(point.x, 4, 96),
                  y: clamp(point.y, 4, 96)
                }
              : currentPoint
          )
        };
      })
    );
  }

  function handleCustomPointPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "custom-point" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  }

  function handlePlantingPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    bed: GardenBed,
    planting: GardenPlanting
  ) {
    event.stopPropagation();
    const bedElement = event.currentTarget.closest<HTMLElement>("[data-bed-id]");
    if (!bedElement) return;

    const bedRect = bedElement.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "planting",
      bedId: bed.id,
      plantingId: planting.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: planting.x,
      originY: planting.y,
      bedWidthPx: bedRect.width,
      bedHeightPx: bedRect.height,
      moved: false,
      plantId: planting.plantId
    });
  }

  function handlePlantingPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "planting" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const movedNow =
      Math.abs(event.clientX - dragState.startClientX) > 4 ||
      Math.abs(event.clientY - dragState.startClientY) > 4;
    const deltaX =
      ((event.clientX - dragState.startClientX) / dragState.bedWidthPx) * 100;
    const deltaY =
      ((event.clientY - dragState.startClientY) / dragState.bedHeightPx) * 100;

    setGardenState((state) =>
      updatePlantingInState(
        state,
        dragState.bedId,
        dragState.plantingId,
        (planting) => ({
          ...planting,
          x: clamp(dragState.originX + deltaX, 4, 96),
          y: clamp(dragState.originY + deltaY, 4, 96)
        })
      )
    );
    setDragState({ ...dragState, moved: dragState.moved || movedNow });
  }

  function handlePlantingPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "planting" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!dragState.moved && dragState.plantId) {
      navigate(`/plant/${dragState.plantId}`);
    }

    setDragState(null);
  }

  return (
    <div className="space-y-7 pb-6">
      <section className="surface-card px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <span className="label-chip bg-pine text-white">
              Garden Tracker
            </span>
            <h2 className="font-display text-3xl text-slate-900 sm:text-4xl">
              Map each bed, nickname it, and place what you planted.
            </h2>
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="label-chip bg-slate-900/6 text-slate-700">
                Beds: {gardenState.beds.length}
              </span>
              <span className="label-chip bg-slate-900/6 text-slate-700">
                Plantings: {plantedCount}
              </span>
              {selectedBed ? (
                <span className="label-chip bg-clay/10 text-clay">
                  Active: {selectedBed.nickname}
                </span>
              ) : null}
            </div>
          </div>

          <div className="inline-flex rounded-full border border-slate-200 bg-white/90 p-1">
            <button
              type="button"
              onClick={() => setMode("beds")}
              className={
                mode === "beds"
                  ? "action-button bg-pine px-4 py-2 text-white hover:bg-pine/90"
                  : "action-button bg-transparent px-4 py-2 text-slate-700 hover:bg-slate-100"
              }
              aria-pressed={mode === "beds"}
            >
              Beds
            </button>
            <button
              type="button"
              onClick={() => setMode("plants")}
              className={
                mode === "plants"
                  ? "action-button bg-pine px-4 py-2 text-white hover:bg-pine/90"
                  : "action-button bg-transparent px-4 py-2 text-slate-700 hover:bg-slate-100"
              }
              aria-pressed={mode === "plants"}
            >
              Plants
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Garden Map
                </p>
                <h3 className="mt-1 font-display text-2xl text-slate-900">
                  {mode === "beds" ? "Draw beds" : "Place plants"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => addBedAt()}
                className="action-button-secondary self-start"
              >
                Add Bed
              </button>
            </div>
          </div>

          <div className="garden-board-viewport bg-cream">
            <div
              ref={boardRef}
              className="garden-board relative overflow-hidden bg-cream"
              style={boardStyle}
              onPointerDown={handleBoardPointerDown}
              aria-label="Garden bed map"
            >
              <div className="pointer-events-none absolute inset-0 garden-grid" />

              {gardenState.beds.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-6 top-6 rounded-[1.5rem] border border-dashed border-moss/40 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
                  Select a shape and add your first bed.
                </div>
              ) : null}

              {gardenState.beds.map((bed, bedIndex) => {
              const isSelected = bed.id === gardenState.selectedBedId;
              const customPoints = getCustomPoints(bed);
              const showCustomHandles =
                mode === "beds" && isSelected && bed.shape === "custom";
              const bedStyle: CSSProperties = {
                left: `${bed.x}%`,
                top: `${bed.y}%`,
                width: `${bed.width}%`,
                height: `${bed.height}%`
              };

              return (
                <div
                  key={bed.id}
                  data-bed-id={bed.id}
                  role="button"
                  tabIndex={0}
                  className={
                    isSelected
                      ? "garden-bed absolute z-10 outline outline-4 outline-pine/35"
                      : "garden-bed absolute z-10 outline outline-1 outline-slate-700/15"
                  }
                  style={bedStyle}
                  onPointerDown={(event) => handleBedPointerDown(event, bed)}
                  onPointerMove={(event) => handleBedPointerMove(event, bed)}
                  onPointerUp={handleBedPointerUp}
                  onPointerCancel={handleBedPointerUp}
                >
                  <div
                    className="absolute inset-0 border border-white/70 bg-moss/65 shadow-soft"
                    style={getShapeLayerStyle(bed.shape, customPoints)}
                  />

                  {showCustomHandles
                    ? customPoints.map((point, pointIndex) => (
                        <button
                          key={`${bed.id}-point-${pointIndex}`}
                          type="button"
                          className="garden-custom-point absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-clay shadow-lg ring-4 ring-clay/25"
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`
                          }}
                          aria-label={`Move custom shape point ${
                            pointIndex + 1
                          }`}
                          onPointerDown={(event) =>
                            handleCustomPointPointerDown(
                              event,
                              bed.id,
                              pointIndex
                            )
                          }
                          onPointerMove={handleCustomPointPointerMove}
                          onPointerUp={handleCustomPointPointerUp}
                          onPointerCancel={handleCustomPointPointerUp}
                        />
                      ))
                    : null}

                  <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-2 text-center">
                    <p className="max-w-full truncate rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                      {bed.nickname}
                    </p>
                    <p className="mt-1 rounded-full bg-slate-950/55 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                      {bed.plantings.length}
                    </p>
                  </div>

                  {bed.plantings.map((planting) => {
                    const plant = getPlantingPlant(planting);
                    const label = getPlantingLabel(planting);
                    const markerClass = plant
                      ? categoryMarkerClasses[plant.category]
                      : "bg-white text-slate-950 ring-slate-300";

                    return (
                      <button
                        key={planting.id}
                        type="button"
                        className={`garden-planting-marker absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black shadow-lg ring-4 ${markerClass}`}
                        style={{
                          left: `${planting.x}%`,
                          top: `${planting.y}%`
                        }}
                        title={plant ? `Open ${plant.name}` : label}
                        aria-label={plant ? `Open ${plant.name}` : label}
                        onPointerDown={(event) =>
                          handlePlantingPointerDown(event, bed, planting)
                        }
                        onPointerMove={handlePlantingPointerMove}
                        onPointerUp={handlePlantingPointerUp}
                        onPointerCancel={handlePlantingPointerUp}
                      >
                        {label.slice(0, 1).toUpperCase()}
                      </button>
                    );
                  })}

                  <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-white/85 px-2 py-1 text-[0.65rem] font-semibold text-slate-700">
                    {bedIndex + 1}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="surface-card px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Beds
                </p>
                <h3 className="mt-1 font-display text-2xl text-slate-900">
                  Bed setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => addBedAt()}
                className="action-button-secondary min-h-11 px-4 py-2"
              >
                Add
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {gardenState.beds.map((bed) => (
                <button
                  key={bed.id}
                  type="button"
                  onClick={() => setSelectedBedId(bed.id)}
                  className={
                    bed.id === gardenState.selectedBedId
                      ? "rounded-2xl border border-pine bg-pine px-4 py-3 text-left text-sm font-semibold text-white"
                      : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:border-moss/40"
                  }
                >
                  <span className="block truncate">{bed.nickname}</span>
                  <span
                    className={
                      bed.id === gardenState.selectedBedId
                        ? "mt-1 block text-xs text-white/75"
                        : "mt-1 block text-xs text-slate-500"
                    }
                  >
                    {bed.shape}, {bed.plantings.length} planted
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white/75 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">
                  Map Zoom
                </p>
                <span className="rounded-full bg-slate-900/6 px-3 py-1 text-xs font-semibold text-slate-700">
                  {mapZoomPercent}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2">
                <button
                  type="button"
                  onClick={() => nudgeMapZoom(-MAP_ZOOM_STEP)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-800 hover:border-moss/40 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pine/35"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  -
                </button>
                <input
                  type="range"
                  min={MIN_MAP_ZOOM * 100}
                  max={MAX_MAP_ZOOM * 100}
                  step={MAP_ZOOM_STEP * 100}
                  value={mapZoomPercent}
                  onChange={(event) =>
                    updateMapZoom(Number(event.target.value) / 100)
                  }
                  className="w-full accent-pine"
                  aria-label="Map zoom"
                />
                <button
                  type="button"
                  onClick={() => nudgeMapZoom(MAP_ZOOM_STEP)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-800 hover:border-moss/40 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pine/35"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => updateMapZoom(1)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-moss/40"
              >
                100%
              </button>
            </div>

            <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Shape
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SHAPE_OPTIONS.map((shape) => (
                    <button
                      key={shape.value}
                      type="button"
                      onClick={() => handleSelectedShapeChange(shape.value)}
                      className={
                        (selectedBed?.shape ?? selectedShape) === shape.value
                          ? "rounded-2xl border border-pine bg-pine px-3 py-3 text-sm font-semibold text-white"
                          : "rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 hover:border-moss/40"
                      }
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Nickname
                </span>
                <input
                  type="text"
                  value={selectedBed?.nickname ?? ""}
                  disabled={!selectedBed}
                  onChange={(event) =>
                    updateSelectedBed((bed) => ({
                      ...bed,
                      nickname: event.target.value
                    }))
                  }
                  className="field-shell min-h-12 rounded-2xl"
                  placeholder="Patio tomatoes"
                />
              </label>

              {selectedBed ? (
                <div className="space-y-4">
                  {selectedBed.shape === "circle" ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-800">
                        Diameter
                      </span>
                      <input
                        type="range"
                        min="16"
                        max="60"
                        value={selectedBed.width}
                        onChange={(event) =>
                          updateSelectedBedSize(
                            "width",
                            Number(event.target.value)
                          )
                        }
                        className="w-full accent-pine"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-800">
                          Width
                        </span>
                        <input
                          type="range"
                          min="16"
                          max="92"
                          value={selectedBed.width}
                          onChange={(event) =>
                            updateSelectedBedSize(
                              "width",
                              Number(event.target.value)
                            )
                          }
                          className="w-full accent-pine"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-800">
                          Depth
                        </span>
                        <input
                          type="range"
                          min="16"
                          max="78"
                          value={selectedBed.height}
                          onChange={(event) =>
                            updateSelectedBedSize(
                              "height",
                              Number(event.target.value)
                            )
                          }
                          className="w-full accent-pine"
                        />
                      </label>
                    </>
                  )}

                  {selectedBed.shape === "custom" ? (
                    <div className="rounded-[1.25rem] border border-slate-200 bg-white/75 p-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Outline
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={addCustomPoint}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-moss/40"
                        >
                          Add Point
                        </button>
                        <button
                          type="button"
                          onClick={removeCustomPoint}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-moss/40"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={resetCustomPoints}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-moss/40"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={deleteSelectedBed}
                    className="action-button-secondary w-full border-clay/30 text-clay hover:bg-clay/5"
                  >
                    Delete Bed
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="surface-card px-5 py-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Plants
              </p>
              <h3 className="mt-1 font-display text-2xl text-slate-900">
                Plant picker
              </h3>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Search database
                </span>
                <input
                  type="search"
                  value={plantQuery}
                  onChange={(event) => setPlantQuery(event.target.value)}
                  className="field-shell min-h-12 rounded-2xl"
                  placeholder="Tomato, basil, marigold..."
                />
              </label>

              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                {matchingPlants.map((plant) => (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlantId(plant.id);
                      setPlantQuery(plant.name);
                      setMode("plants");
                    }}
                    className={
                      selectedPlantId === plant.id
                        ? "rounded-2xl border border-pine bg-pine px-4 py-3 text-left text-sm font-semibold text-white"
                        : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:border-moss/40"
                    }
                  >
                    <span className="block">{plant.name}</span>
                    <span
                      className={
                        selectedPlantId === plant.id
                          ? "mt-1 block text-xs capitalize text-white/75"
                          : "mt-1 block text-xs capitalize text-slate-500"
                      }
                    >
                      {plant.category}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedPlantId(CUSTOM_PLANT_VALUE);
                  setMode("plants");
                }}
                className={
                  selectedPlantId === CUSTOM_PLANT_VALUE
                    ? "action-button-primary w-full"
                    : "action-button-secondary w-full"
                }
              >
                Custom
              </button>

              {selectedPlantId === CUSTOM_PLANT_VALUE ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Custom name
                  </span>
                  <input
                    type="text"
                    value={customPlantName}
                    onChange={(event) => setCustomPlantName(event.target.value)}
                    className="field-shell min-h-12 rounded-2xl"
                    placeholder="Mystery pepper"
                  />
                </label>
              ) : null}

              <div className="rounded-[1.25rem] border border-slate-200 bg-white/75 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  Selected:{" "}
                  {selectedPlant?.name ??
                    (customPlantName.trim() || "Custom plant")}
                </p>
                <p className="mt-1">
                  Bed: {selectedBed?.nickname ?? "No bed selected"}
                </p>
              </div>
            </div>
          </section>

          {selectedBed && selectedBed.plantings.length > 0 ? (
            <section className="surface-card px-5 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                In This Bed
              </p>
              <div className="mt-4 divide-y divide-slate-200">
                {selectedBed.plantings.map((planting) => {
                  const plant = getPlantingPlant(planting);
                  const label = getPlantingLabel(planting);

                  return (
                    <div
                      key={planting.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {plant ? "Database plant" : "Custom plant"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {plant ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/plant/${plant.id}`)}
                            className="text-sm font-semibold text-pine"
                          >
                            Details
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            removePlanting(selectedBed.id, planting.id)
                          }
                          className="text-sm font-semibold text-clay"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
