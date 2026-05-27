import type {
  GardenBed,
  GardenPlanting,
  GardenTrackerState
} from "../types/garden";
import { normalizeGardenTrackerState } from "./storage";

const TRANSFER_PREFIX = "SOW1:";
const TRANSFER_APP = "SowSimple";
const TRANSFER_KIND = "garden-tracker";
const TRANSFER_VERSION = 1;

type GardenTransferPayload = {
  app: typeof TRANSFER_APP;
  kind: typeof TRANSFER_KIND;
  version: typeof TRANSFER_VERSION;
  exportedAt: string;
  state: GardenTrackerState;
};

export type GardenTransferSummary = {
  bedCount: number;
  plantingCount: number;
  bedNames: string[];
  exportedAt: string;
};

export type ParsedGardenTransfer =
  | {
      ok: true;
      code: string;
      state: GardenTrackerState;
      summary: GardenTransferSummary;
    }
  | {
      ok: false;
      reason:
        | "empty"
        | "missing-code"
        | "bad-format"
        | "bad-checksum"
        | "bad-payload"
        | "unsupported";
      message: string;
    };

function getChecksum(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlEncode(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );

  return new TextDecoder().decode(base64ToBytes(padded));
}

function getPlantingCount(state: GardenTrackerState): number {
  return state.beds.reduce((total, bed) => total + bed.plantings.length, 0);
}

export function getGardenTransferSummary(
  state: GardenTrackerState,
  exportedAt = ""
): GardenTransferSummary {
  return {
    bedCount: state.beds.length,
    plantingCount: getPlantingCount(state),
    bedNames: state.beds.map((bed) => bed.nickname),
    exportedAt
  };
}

function getPayloadSummary(
  payload: GardenTransferPayload,
  state: GardenTrackerState
): GardenTransferSummary {
  return getGardenTransferSummary(state, payload.exportedAt);
}

function getGardenTransferPayload(
  state: GardenTrackerState,
  exportedAt: string
): GardenTransferPayload {
  return {
    app: TRANSFER_APP,
    kind: TRANSFER_KIND,
    version: TRANSFER_VERSION,
    exportedAt,
    state: normalizeGardenTrackerState(state)
  };
}

function extractTransferCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/[?&]garden=([^&#\s]+)/i);
  if (urlMatch?.[1]) {
    return decodeURIComponent(urlMatch[1]);
  }

  const codeMatch = trimmed.match(/SOW1:[A-Za-z0-9_-]+\.[A-Za-z0-9]+/);
  return codeMatch?.[0] ?? null;
}

function isGardenTransferPayload(value: unknown): value is GardenTransferPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<GardenTransferPayload>;
  return (
    payload.app === TRANSFER_APP &&
    payload.kind === TRANSFER_KIND &&
    payload.version === TRANSFER_VERSION &&
    typeof payload.exportedAt === "string" &&
    typeof payload.state === "object" &&
    payload.state !== null
  );
}

export function createGardenTransferCode(
  state: GardenTrackerState,
  exportedAt = new Date().toISOString()
): string {
  const payload = getGardenTransferPayload(state, exportedAt);
  const encoded = base64UrlEncode(JSON.stringify(payload));

  return `${TRANSFER_PREFIX}${encoded}.${getChecksum(encoded)}`;
}

export function parseGardenTransferInput(input: string): ParsedGardenTransfer {
  if (!input.trim()) {
    return {
      ok: false,
      reason: "empty",
      message: "Paste a garden transfer code or link first."
    };
  }

  let code: string | null;
  try {
    code = extractTransferCode(input);
  } catch {
    return {
      ok: false,
      reason: "bad-format",
      message: "That transfer link is not readable."
    };
  }

  if (!code) {
    return {
      ok: false,
      reason: "missing-code",
      message: "No Sow Simple garden transfer code was found."
    };
  }

  const body = code.slice(TRANSFER_PREFIX.length);
  const [encoded, checksum, extra] = body.split(".");

  if (!encoded || !checksum || extra !== undefined) {
    return {
      ok: false,
      reason: "bad-format",
      message: "That garden transfer code is not in the expected format."
    };
  }

  if (getChecksum(encoded) !== checksum) {
    return {
      ok: false,
      reason: "bad-checksum",
      message: "That garden transfer code looks incomplete or mistyped."
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return {
      ok: false,
      reason: "bad-payload",
      message: "That garden transfer code could not be unpacked."
    };
  }

  if (!isGardenTransferPayload(parsed)) {
    return {
      ok: false,
      reason: "unsupported",
      message: "That transfer code is for an unsupported garden format."
    };
  }

  const state = normalizeGardenTrackerState(parsed.state);

  return {
    ok: true,
    code,
    state,
    summary: getPayloadSummary(parsed, state)
  };
}

function renamePlanting(
  planting: GardenPlanting,
  bedIndex: number,
  plantingIndex: number,
  importId: string
): GardenPlanting {
  return {
    ...planting,
    id: `${planting.id}-${importId}-${bedIndex}-${plantingIndex}`
  };
}

function renameBed(bed: GardenBed, bedIndex: number, importId: string): GardenBed {
  return {
    ...bed,
    id: `${bed.id}-${importId}-${bedIndex}`,
    plantings: bed.plantings.map((planting, plantingIndex) =>
      renamePlanting(planting, bedIndex, plantingIndex, importId)
    )
  };
}

export function mergeGardenTrackerStates(
  currentState: GardenTrackerState,
  importedState: GardenTrackerState,
  importId = Date.now().toString(36)
): GardenTrackerState {
  const current = normalizeGardenTrackerState(currentState);
  const imported = normalizeGardenTrackerState(importedState);
  const importedBeds = imported.beds.map((bed, bedIndex) =>
    renameBed(bed, bedIndex, importId)
  );

  return {
    beds: [...current.beds, ...importedBeds],
    selectedBedId:
      current.selectedBedId ?? importedBeds[0]?.id ?? current.beds[0]?.id ?? null
  };
}

export function createGardenTransferLink(
  code: string,
  origin: string,
  path = ""
): string {
  const normalizedOrigin = origin.replace(/\/$/g, "");
  const normalizedPath = path.replace(/\/$/g, "");

  return `${normalizedOrigin}${normalizedPath}/#/gardens?garden=${encodeURIComponent(
    code
  )}`;
}
