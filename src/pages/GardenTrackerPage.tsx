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

type BedResizeHandle = "width" | "height" | "both";

type BedResizeDragState = {
  kind: "bed-resize";
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originWidth: number;
  originHeight: number;
  x: number;
  y: number;
  handle: BedResizeHandle;
};

type BoardPanState = {
  kind: "board-pan";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  point: { x: number; y: number };
  canAddBed: boolean;
  moved: boolean;
};

type DragState =
  | BedDragState
  | PlantingDragState
  | CustomPointDragState
  | BedResizeDragState
  | BoardPanState;

type PlantingSelection = {
  bedId: string;
  plantingId: string;
};

type MapPan = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPointDistance(
  first: { x: number; y: number },
  second: { x: number; y: number }
) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    target.isContentEditable
  );
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
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const activeEditorPointersRef = useRef(
    new Map<number, { x: number; y: number }>()
  );
  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const [gardenState, setGardenState] = useState<GardenTrackerState>(() =>
    getStoredGardenTrackerState()
  );
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<GardenMode>("beds");
  const [selectedShape, setSelectedShape] =
    useState<GardenBedShape>("rectangle");
  const [plantQuery, setPlantQuery] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    plants[0]?.id ?? CUSTOM_PLANT_VALUE
  );
  const [customPlantName, setCustomPlantName] = useState("Custom plant");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 });
  const [selectedPlantingTarget, setSelectedPlantingTarget] =
    useState<PlantingSelection | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const selectedBed =
    gardenState.beds.find((bed) => bed.id === gardenState.selectedBedId) ??
    null;
  const selectedPlantingBed = selectedPlantingTarget
    ? gardenState.beds.find((bed) => bed.id === selectedPlantingTarget.bedId) ??
      null
    : null;
  const selectedPlanting =
    selectedPlantingBed && selectedPlantingTarget
      ? selectedPlantingBed.plantings.find(
          (planting) => planting.id === selectedPlantingTarget.plantingId
        ) ?? null
      : null;
  const selectedPlantingLabel = selectedPlanting
    ? getPlantingLabel(selectedPlanting)
    : "";
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
    transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0) scale(${mapZoom})`
  } as CSSProperties;

  function getClampedMapPan(pan: MapPan, zoom: number): MapPan {
    const viewport = boardViewportRef.current;
    const board = boardRef.current;
    if (!viewport || !board) return pan;

    const viewportRect = viewport.getBoundingClientRect();
    const minX = Math.min(0, viewportRect.width - board.offsetWidth * zoom);
    const minY = Math.min(0, viewportRect.height - board.offsetHeight * zoom);

    return {
      x: clamp(pan.x, minX, 0),
      y: clamp(pan.y, minY, 0)
    };
  }

  function getViewportPoint(clientX: number, clientY: number): MapPan {
    const viewportRect = boardViewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return { x: 0, y: 0 };

    return {
      x: clientX - viewportRect.left,
      y: clientY - viewportRect.top
    };
  }

  function getViewportCenterPoint(): MapPan {
    const viewportRect = boardViewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return { x: 0, y: 0 };

    return {
      x: viewportRect.width / 2,
      y: viewportRect.height / 2
    };
  }

  useEffect(() => {
    setStoredGardenTrackerState(gardenState);
  }, [gardenState]);

  useEffect(() => {
    if (!selectedPlantingTarget) return;

    const bed = gardenState.beds.find(
      (gardenBed) => gardenBed.id === selectedPlantingTarget.bedId
    );
    const hasPlanting = bed?.plantings.some(
      (planting) => planting.id === selectedPlantingTarget.plantingId
    );

    if (!hasPlanting) {
      setSelectedPlantingTarget(null);
    }
  }, [gardenState, selectedPlantingTarget]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isEditorOpen]);

  useEffect(() => {
    setMapPan((currentPan) => getClampedMapPan(currentPan, mapZoom));

    function handleResize() {
      setMapPan((currentPan) => getClampedMapPan(currentPan, mapZoom));
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [mapZoom]);

  useEffect(() => {
    const deleteTargetBedId = selectedBed?.id;
    const deleteTargetPlanting = selectedPlantingTarget;
    if (!isEditorOpen || (!deleteTargetBedId && !deleteTargetPlanting)) return;
    const bedId = deleteTargetBedId;

    function handleDeleteKey(event: KeyboardEvent) {
      if (event.key !== "Delete") return;
      if (isTextEditingTarget(event.target)) return;

      event.preventDefault();
      if (deleteTargetPlanting) {
        removePlanting(
          deleteTargetPlanting.bedId,
          deleteTargetPlanting.plantingId
        );
        return;
      }

      if (bedId) {
        deleteBedById(bedId);
      }
    }

    window.addEventListener("keydown", handleDeleteKey);

    return () => {
      window.removeEventListener("keydown", handleDeleteKey);
    };
  }, [
    isEditorOpen,
    selectedBed?.id,
    selectedPlantingTarget?.bedId,
    selectedPlantingTarget?.plantingId
  ]);

  function isPinchZooming() {
    return pinchStateRef.current !== null;
  }

  function openEditor() {
    setEditorOpen(true);
  }

  function closeEditor() {
    activeEditorPointersRef.current.clear();
    pinchStateRef.current = null;
    setDragState(null);
    setSelectedPlantingTarget(null);
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
    setEditorOpen(false);
  }

  function setSelectedBedId(
    bedId: string | null,
    options: { preservePlantingSelection?: boolean } = {}
  ) {
    const bed = gardenState.beds.find((gardenBed) => gardenBed.id === bedId);
    if (bed) {
      setSelectedShape(bed.shape);
    }

    if (!options.preservePlantingSelection) {
      setSelectedPlantingTarget(null);
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
    if (activeEditorPointersRef.current.size >= 2 || isPinchZooming()) return;
    if (isEditorOpen && event.target !== event.currentTarget) return;

    const point = getPointerPercent(event, event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "board-pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: mapPan.x,
      startPanY: mapPan.y,
      point,
      canAddBed: isEditorOpen && mode === "beds",
      moved: false
    });
  }

  function handleBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (
      dragState?.kind !== "board-pan" ||
      dragState.pointerId !== event.pointerId ||
      isPinchZooming()
    ) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    const moved =
      dragState.moved || Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6;

    if (moved) {
      setMapPan(
        getClampedMapPan(
          {
            x: dragState.startPanX + deltaX,
            y: dragState.startPanY + deltaY
          },
          mapZoom
        )
      );
    }

    setDragState({ ...dragState, moved });
  }

  function handleBoardPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (
      dragState?.kind !== "board-pan" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!dragState.moved && dragState.canAddBed) {
      const size = DEFAULT_BED_SIZES[selectedShape];
      addBedAt(
        dragState.point.x - size.width / 2,
        dragState.point.y - size.height / 2
      );
    }

    setDragState(null);
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

  function deleteBedById(bedId: string) {
    setGardenState((state) => {
      const beds = state.beds.filter((bed) => bed.id !== bedId);
      const selectedBedId =
        state.selectedBedId === bedId
          ? beds[0]?.id ?? null
          : beds.some((bed) => bed.id === state.selectedBedId)
            ? state.selectedBedId
            : beds[0]?.id ?? null;

      return {
        beds,
        selectedBedId
      };
    });
    if (selectedPlantingTarget?.bedId === bedId) {
      setSelectedPlantingTarget(null);
    }
    setDragState(null);
  }

  function deleteSelectedBed() {
    if (!selectedBed) return;

    deleteBedById(selectedBed.id);
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
    setSelectedPlantingTarget({ bedId, plantingId: planting.id });
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

  function clearPlantSearch() {
    setPlantQuery("");
  }

  function updateMapZoom(value: number, focalPoint = getViewportCenterPoint()) {
    setMapZoom((currentZoom) => {
      const nextZoom = clamp(value, MIN_MAP_ZOOM, MAX_MAP_ZOOM);

      setMapPan((currentPan) => {
        const worldX = (focalPoint.x - currentPan.x) / currentZoom;
        const worldY = (focalPoint.y - currentPan.y) / currentZoom;

        return getClampedMapPan(
          {
            x: focalPoint.x - worldX * nextZoom,
            y: focalPoint.y - worldY * nextZoom
          },
          nextZoom
        );
      });

      return nextZoom;
    });
  }

  function nudgeMapZoom(delta: number) {
    updateMapZoom(Number((mapZoom + delta).toFixed(2)));
  }

  function handleEditorPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (!isEditorOpen || event.pointerType === "mouse") return;

    activeEditorPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (activeEditorPointersRef.current.size === 2) {
      const [first, second] = Array.from(
        activeEditorPointersRef.current.values()
      );
      const startDistance = getPointDistance(first, second);
      pinchStateRef.current = {
        startDistance,
        startZoom: mapZoom
      };
      setDragState(null);
    }
  }

  function handleEditorPointerMoveCapture(event: PointerEvent<HTMLDivElement>) {
    if (
      !isEditorOpen ||
      event.pointerType === "mouse" ||
      !activeEditorPointersRef.current.has(event.pointerId)
    ) {
      return;
    }

    activeEditorPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (pinchStateRef.current && activeEditorPointersRef.current.size >= 2) {
      event.preventDefault();
      const [first, second] = Array.from(
        activeEditorPointersRef.current.values()
      );
      const nextDistance = getPointDistance(first, second);
      const focalPoint = getViewportPoint(
        (first.x + second.x) / 2,
        (first.y + second.y) / 2
      );

      if (pinchStateRef.current.startDistance > 0) {
        updateMapZoom(
          (pinchStateRef.current.startZoom * nextDistance) /
            pinchStateRef.current.startDistance,
          focalPoint
        );
      }
    }
  }

  function handleEditorPointerEndCapture(event: PointerEvent<HTMLDivElement>) {
    if (!isEditorOpen || event.pointerType === "mouse") return;

    activeEditorPointersRef.current.delete(event.pointerId);

    if (activeEditorPointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
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
    if (
      selectedPlantingTarget?.bedId === bedId &&
      selectedPlantingTarget.plantingId === plantingId
    ) {
      setSelectedPlantingTarget(null);
    }
  }

  function handleBedPointerDown(
    event: PointerEvent<HTMLDivElement>,
    bed: GardenBed
  ) {
    if (!isEditorOpen) {
      return;
    }

    event.stopPropagation();
    if (activeEditorPointersRef.current.size >= 2 || isPinchZooming()) return;
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
      !boardRef.current ||
      isPinchZooming()
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

  function handleBedResizePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    bed: GardenBed,
    handle: BedResizeHandle
  ) {
    event.stopPropagation();
    if (activeEditorPointersRef.current.size >= 2 || isPinchZooming()) return;

    setSelectedBedId(bed.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      kind: "bed-resize",
      id: bed.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originWidth: bed.width,
      originHeight: bed.height,
      x: bed.x,
      y: bed.y,
      handle
    });
  }

  function handleBedResizePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "bed-resize" ||
      dragState.pointerId !== event.pointerId ||
      !boardRef.current ||
      isPinchZooming()
    ) {
      return;
    }

    event.stopPropagation();
    const boardRect = boardRef.current.getBoundingClientRect();
    const deltaX =
      ((event.clientX - dragState.startClientX) / boardRect.width) * 100;
    const deltaY =
      ((event.clientY - dragState.startClientY) / boardRect.height) * 100;

    setGardenState((state) =>
      updateBedInState(state, dragState.id, (bed) => {
        const nextWidth =
          dragState.handle === "width" || dragState.handle === "both"
            ? dragState.originWidth + deltaX
            : dragState.originWidth;
        const nextHeight =
          dragState.handle === "height" || dragState.handle === "both"
            ? dragState.originHeight + deltaY
            : dragState.originHeight;

        if (bed.shape === "circle") {
          const diameter = clamp(
            Math.max(nextWidth, nextHeight),
            16,
            Math.min(60, 100 - dragState.x, 100 - dragState.y)
          );

          return {
            ...bed,
            width: diameter,
            height: diameter
          };
        }

        return {
          ...bed,
          width: clamp(nextWidth, 16, 100 - dragState.x),
          height: clamp(nextHeight, 16, 100 - dragState.y)
        };
      })
    );
  }

  function handleBedResizePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (
      dragState?.kind !== "bed-resize" ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  }

  function handleCustomPointPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    bedId: string,
    pointIndex: number
  ) {
    event.stopPropagation();
    if (activeEditorPointersRef.current.size >= 2 || isPinchZooming()) return;
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
      dragState.pointerId !== event.pointerId ||
      isPinchZooming()
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
    if (!isEditorOpen) {
      if (planting.plantId) {
        navigate(`/plant/${planting.plantId}`);
      }
      return;
    }

    if (activeEditorPointersRef.current.size >= 2 || isPinchZooming()) return;
    setSelectedBedId(bed.id, { preservePlantingSelection: true });
    setSelectedPlantingTarget({ bedId: bed.id, plantingId: planting.id });
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
      dragState.pointerId !== event.pointerId ||
      isPinchZooming()
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

    if (!dragState.moved && isEditorOpen) {
      setSelectedBedId(dragState.bedId, { preservePlantingSelection: true });
      setSelectedPlantingTarget({
        bedId: dragState.bedId,
        plantingId: dragState.plantingId
      });
    } else if (!dragState.moved && dragState.plantId) {
      navigate(`/plant/${dragState.plantId}`);
    }

    setDragState(null);
  }

  const mapShellClass = isEditorOpen
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-cream"
    : "surface-card overflow-hidden";
  const mapHeaderClass = isEditorOpen
    ? "shrink-0 border-b border-slate-200/80 bg-white/95 px-3 py-3 shadow-sm sm:px-5"
    : "border-b border-slate-200/80 px-5 py-4 sm:px-6";
  const mapViewportClass = isEditorOpen
    ? "garden-board-viewport garden-editor-viewport relative flex-1 bg-cream"
    : "garden-board-viewport relative bg-cream";

  return (
    <div className="space-y-7 pb-6">
      <section className="surface-card px-5 py-6 sm:px-7 sm:py-7">
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
      </section>

      <div className="grid gap-6">
        <section className={mapShellClass}>
          <div className={mapHeaderClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {isEditorOpen ? "Edit Beds" : "Garden Map"}
                </p>
                {isEditorOpen && selectedBed ? (
                  <input
                    type="text"
                    value={selectedBed.nickname}
                    onChange={(event) =>
                      updateSelectedBed((bed) => ({
                        ...bed,
                        nickname: event.target.value
                      }))
                    }
                    className="mt-1 w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 font-display text-2xl text-slate-900 shadow-sm outline-none transition focus:border-moss/70 focus:ring-4 focus:ring-moss/15 sm:min-w-80"
                    aria-label="Bed nickname"
                    placeholder="Garden bed name"
                  />
                ) : (
                  <h3 className="mt-1 font-display text-2xl text-slate-900">
                    Your garden beds
                  </h3>
                )}
                {isEditorOpen ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {mode === "beds" ? "Draw beds" : "Place plants"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isEditorOpen ? (
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
                ) : null}
                <button
                  type="button"
                  onClick={isEditorOpen ? () => addBedAt() : openEditor}
                  className="action-button-secondary self-start"
                >
                  {isEditorOpen ? "Add Bed" : "Edit Beds"}
                </button>
                {isEditorOpen ? (
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="action-button-primary self-start"
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div
            ref={boardViewportRef}
            className={mapViewportClass}
            onPointerDownCapture={handleEditorPointerDownCapture}
            onPointerMoveCapture={handleEditorPointerMoveCapture}
            onPointerUpCapture={handleEditorPointerEndCapture}
            onPointerCancelCapture={handleEditorPointerEndCapture}
          >
            <div
              ref={boardRef}
              className="garden-board relative overflow-hidden bg-cream"
              style={boardStyle}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerCancel={handleBoardPointerUp}
              aria-label="Garden bed map"
            >
              <div className="pointer-events-none absolute inset-0 garden-grid" />

              {gardenState.beds.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-6 top-6 rounded-[1.5rem] border border-dashed border-moss/40 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
                  {isEditorOpen
                    ? "Select a shape and add your first bed."
                    : "Use Edit Beds to add your first bed."}
                </div>
              ) : null}

              {gardenState.beds.map((bed, bedIndex) => {
                const isSelected =
                  isEditorOpen && bed.id === gardenState.selectedBedId;
                const customPoints = getCustomPoints(bed);
                const showCustomHandles =
                  isEditorOpen &&
                  mode === "beds" &&
                  isSelected &&
                  bed.shape === "custom";
                const showResizeHandles =
                  isEditorOpen && mode === "beds" && isSelected;
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
                    role={isEditorOpen ? "button" : undefined}
                    tabIndex={isEditorOpen ? 0 : undefined}
                    className={
                      isSelected
                        ? "garden-bed garden-bed-editable absolute z-10 outline outline-4 outline-pine/35"
                        : `garden-bed ${
                            isEditorOpen
                              ? "garden-bed-editable"
                              : "garden-bed-readonly"
                          } absolute z-10 outline outline-1 outline-slate-700/15`
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

                  {showResizeHandles ? (
                    <>
                      <button
                        type="button"
                        className="garden-resize-handle garden-resize-handle-right"
                        aria-label="Resize bed width"
                        title="Resize width"
                        onPointerDown={(event) =>
                          handleBedResizePointerDown(event, bed, "width")
                        }
                        onPointerMove={handleBedResizePointerMove}
                        onPointerUp={handleBedResizePointerUp}
                        onPointerCancel={handleBedResizePointerUp}
                      />
                      <button
                        type="button"
                        className="garden-resize-handle garden-resize-handle-bottom"
                        aria-label="Resize bed depth"
                        title="Resize depth"
                        onPointerDown={(event) =>
                          handleBedResizePointerDown(event, bed, "height")
                        }
                        onPointerMove={handleBedResizePointerMove}
                        onPointerUp={handleBedResizePointerUp}
                        onPointerCancel={handleBedResizePointerUp}
                      />
                      <button
                        type="button"
                        className="garden-resize-handle garden-resize-handle-corner"
                        aria-label="Resize bed width and depth"
                        title="Resize width and depth"
                        onPointerDown={(event) =>
                          handleBedResizePointerDown(event, bed, "both")
                        }
                        onPointerMove={handleBedResizePointerMove}
                        onPointerUp={handleBedResizePointerUp}
                        onPointerCancel={handleBedResizePointerUp}
                      />
                    </>
                  ) : null}

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
                    const isSelectedPlanting =
                      isEditorOpen &&
                      selectedPlantingTarget?.bedId === bed.id &&
                      selectedPlantingTarget.plantingId === planting.id;

                    return (
                      <button
                        key={planting.id}
                        type="button"
                        className={`garden-planting-marker absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black shadow-lg ring-4 ${markerClass} ${
                          isSelectedPlanting
                            ? "outline outline-4 outline-clay/70"
                            : ""
                        }`}
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

            <div className="absolute right-3 top-3 z-40 flex flex-col items-center gap-2 rounded-full border border-slate-200 bg-white/95 p-2 shadow-soft">
              <button
                type="button"
                onClick={() => nudgeMapZoom(MAP_ZOOM_STEP)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-pine text-2xl font-semibold text-white hover:bg-pine/90 focus:outline-none focus:ring-2 focus:ring-pine/35"
                aria-label="Zoom in"
                title="Zoom in"
              >
                +
              </button>
              <span className="px-1 text-xs font-semibold text-slate-700">
                {mapZoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => nudgeMapZoom(-MAP_ZOOM_STEP)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-800 hover:border-moss/40 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pine/35"
                aria-label="Zoom out"
                title="Zoom out"
              >
                -
              </button>
            </div>
          </div>

          {isEditorOpen ? (
            <div className="garden-editor-panel shrink-0 border-t border-slate-200/80 bg-white/95 p-3 shadow-soft">
              {mode === "beds" ? (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {SHAPE_OPTIONS.map((shape) => (
                      <button
                        key={`editor-${shape.value}`}
                        type="button"
                        onClick={() => handleSelectedShapeChange(shape.value)}
                        className={
                          (selectedBed?.shape ?? selectedShape) === shape.value
                            ? "min-w-24 rounded-2xl border border-pine bg-pine px-3 py-3 text-sm font-semibold text-white"
                            : "min-w-24 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 hover:border-moss/40"
                        }
                      >
                        {shape.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addBedAt()}
                      className="min-w-24 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 hover:border-moss/40"
                    >
                      Add Bed
                    </button>
                  </div>

                  {selectedBed ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedBed.shape === "circle" ? (
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                            className="mt-3 w-full accent-pine"
                          />
                        </label>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                              className="mt-3 w-full accent-pine"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                              className="mt-3 w-full accent-pine"
                            />
                          </label>
                        </div>
                      )}

                      {selectedBed.shape === "custom" ? (
                        <div className="flex gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={addCustomPoint}
                            className="flex-1 rounded-2xl bg-pine px-3 py-2 text-sm font-semibold text-white hover:bg-pine/90 focus:outline-none focus:ring-2 focus:ring-pine/35"
                          >
                            Add Point
                          </button>
                          <button
                            type="button"
                            onClick={removeCustomPoint}
                            className="flex-1 rounded-2xl bg-clay px-3 py-2 text-sm font-semibold text-white hover:bg-clay/90 focus:outline-none focus:ring-2 focus:ring-clay/35"
                          >
                            Delete Point
                          </button>
                          <button
                            type="button"
                            onClick={resetCustomPoints}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-moss/40"
                          >
                            Reset
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={deleteSelectedBed}
                        className="rounded-2xl border border-clay/30 bg-white px-3 py-3 text-sm font-semibold text-clay hover:bg-clay/5 sm:col-span-2"
                      >
                        Delete Bed
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Search database
                      </span>
                      <div className="relative">
                        <input
                          type="search"
                          value={plantQuery}
                          onChange={(event) =>
                            setPlantQuery(event.target.value)
                          }
                          className="field-shell min-h-11 rounded-2xl py-2 pr-12 text-sm"
                          placeholder="Tomato, basil, marigold..."
                        />
                        {plantQuery ? (
                          <button
                            type="button"
                            onClick={clearPlantSearch}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-pine/35"
                            aria-label="Clear plant search"
                            title="Clear search"
                          >
                            x
                          </button>
                        ) : null}
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedPlantId(CUSTOM_PLANT_VALUE)}
                      className={
                        selectedPlantId === CUSTOM_PLANT_VALUE
                          ? "action-button-primary self-end"
                          : "action-button-secondary self-end"
                      }
                    >
                      Custom
                    </button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {matchingPlants.map((plant) => (
                      <button
                        key={`editor-plant-${plant.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedPlantId(plant.id);
                          setPlantQuery(plant.name);
                        }}
                        className={
                          selectedPlantId === plant.id
                            ? "min-w-36 rounded-2xl border border-pine bg-pine px-4 py-3 text-left text-sm font-semibold text-white"
                            : "min-w-36 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:border-moss/40"
                        }
                      >
                        <span className="block truncate">{plant.name}</span>
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

                  {selectedPlantId === CUSTOM_PLANT_VALUE ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Custom name
                      </span>
                      <input
                        type="text"
                        value={customPlantName}
                        onChange={(event) =>
                          setCustomPlantName(event.target.value)
                        }
                        className="field-shell min-h-11 rounded-2xl py-2 text-sm"
                        placeholder="Mystery pepper"
                      />
                    </label>
                  ) : null}

                  {selectedPlanting && selectedPlantingBed ? (
                    <div className="flex flex-col gap-2 rounded-[1.25rem] border border-clay/25 bg-clay/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Selected: {selectedPlantingLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          In {selectedPlantingBed.nickname}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removePlanting(
                            selectedPlantingBed.id,
                            selectedPlanting.id
                          )
                        }
                        className="rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-white hover:bg-clay/90 focus:outline-none focus:ring-2 focus:ring-clay/35"
                      >
                        Delete Plant
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
