import { describe, expect, it } from "vitest";
import {
  createGardenTransferCode,
  createGardenTransferLink,
  getGardenTransferSummary,
  mergeGardenTrackerStates,
  parseGardenTransferInput
} from "../gardenTransfer";
import type { GardenTrackerState } from "../../types/garden";

const exportedAt = "2026-05-26T20:15:00.000Z";

const gardenState: GardenTrackerState = {
  selectedBedId: "bed-main",
  beds: [
    {
      id: "bed-main",
      nickname: "Kitchen Salsa Bed",
      shape: "custom",
      x: 12,
      y: 18,
      width: 42,
      height: 30,
      customPoints: [
        { x: 8, y: 16 },
        { x: 88, y: 12 },
        { x: 94, y: 82 },
        { x: 18, y: 92 }
      ],
      plantings: [
        {
          id: "planting-tomato",
          plantId: "tomato",
          x: 32,
          y: 48,
          plantedOn: "2026-05-10"
        },
        {
          id: "planting-custom",
          customName: "Aji limon pepper",
          x: 72,
          y: 54
        }
      ]
    },
    {
      id: "bed-round",
      nickname: "Herb Spiral 🌿",
      shape: "circle",
      x: 58,
      y: 14,
      width: 24,
      height: 24,
      plantings: [
        {
          id: "planting-basil",
          plantId: "basil",
          x: 50,
          y: 50
        }
      ]
    }
  ]
};

function checksum(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function encodePayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const encoded = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `SOW1:${encoded}.${checksum(encoded)}`;
}

describe("garden transfer", () => {
  it("round trips a garden transfer code with beds, plants, custom shapes, and unicode names", () => {
    const code = createGardenTransferCode(gardenState, exportedAt);
    const parsed = parseGardenTransferInput(code);

    expect(code.startsWith("SOW1:")).toBe(true);
    expect(parsed).toEqual({
      ok: true,
      code,
      state: gardenState,
      summary: {
        bedCount: 2,
        plantingCount: 3,
        bedNames: ["Kitchen Salsa Bed", "Herb Spiral 🌿"],
        exportedAt
      }
    });
  });

  it("extracts a transfer code from a share link or a pasted sentence", () => {
    const code = createGardenTransferCode(gardenState, exportedAt);
    const link = createGardenTransferLink(
      code,
      "https://example.test/",
      "/SowSimple/"
    );

    expect(parseGardenTransferInput(link)).toMatchObject({
      ok: true,
      code
    });
    expect(parseGardenTransferInput(`Here is my garden: ${code}`)).toMatchObject(
      {
        ok: true,
        code
      }
    );
  });

  it("reports helpful failures for empty, missing, malformed, and mistyped codes", () => {
    const code = createGardenTransferCode(gardenState, exportedAt);
    const mistypedCode = code.replace("SOW1:", "SOW1:A");

    expect(parseGardenTransferInput("")).toMatchObject({
      ok: false,
      reason: "empty"
    });
    expect(parseGardenTransferInput("just some garden notes")).toMatchObject({
      ok: false,
      reason: "missing-code"
    });
    expect(parseGardenTransferInput("SOW1:not-a-real-code")).toMatchObject({
      ok: false,
      reason: "missing-code"
    });
    expect(parseGardenTransferInput(mistypedCode)).toMatchObject({
      ok: false,
      reason: "bad-checksum"
    });
  });

  it("rejects validly checksummed payloads from unsupported formats", () => {
    const unsupportedCode = encodePayload({
      app: "SomeOtherApp",
      kind: "garden-tracker",
      version: 1,
      exportedAt,
      state: gardenState
    });

    expect(parseGardenTransferInput(unsupportedCode)).toMatchObject({
      ok: false,
      reason: "unsupported"
    });
  });

  it("normalizes unsafe imported payload data before previewing or applying it", () => {
    const unsafeCode = encodePayload({
      app: "SowSimple",
      kind: "garden-tracker",
      version: 1,
      exportedAt,
      state: {
        selectedBedId: "missing-bed",
        beds: [
          {
            id: "",
            nickname: "",
            shape: "pentagon",
            x: -50,
            y: 140,
            width: 4,
            height: 200,
            customPoints: [{ x: -1, y: 120 }],
            plantings: [
              { id: "", plantId: "tomato", x: 150, y: -10 },
              { id: "invalid-planting", x: 40, y: 40 }
            ]
          }
        ]
      }
    });
    const parsed = parseGardenTransferInput(unsafeCode);

    expect(parsed).toMatchObject({ ok: true });
    if (!parsed.ok) throw new Error(parsed.message);

    expect(parsed.state).toEqual({
      selectedBedId: "bed-0",
      beds: [
        {
          id: "bed-0",
          nickname: "Garden Bed 1",
          shape: "rectangle",
          x: 0,
          y: 8,
          width: 16,
          height: 92,
          customPoints: undefined,
          plantings: [
            {
              id: "planting-0",
              plantId: "tomato",
              customName: undefined,
              x: 100,
              y: 0,
              plantedOn: undefined
            }
          ]
        }
      ]
    });
  });

  it("merges imported gardens by remapping imported bed and planting ids", () => {
    const currentState: GardenTrackerState = {
      selectedBedId: "bed-main",
      beds: [gardenState.beds[0]]
    };
    const importedState: GardenTrackerState = {
      selectedBedId: "bed-main",
      beds: [gardenState.beds[0]]
    };

    const merged = mergeGardenTrackerStates(
      currentState,
      importedState,
      "imported"
    );

    expect(merged.selectedBedId).toBe("bed-main");
    expect(merged.beds).toHaveLength(2);
    expect(merged.beds[1].id).toBe("bed-main-imported-0");
    expect(merged.beds[1].plantings.map((planting) => planting.id)).toEqual([
      "planting-tomato-imported-0-0",
      "planting-custom-imported-0-1"
    ]);
  });

  it("summarizes current gardens for the transfer preview", () => {
    expect(getGardenTransferSummary(gardenState, exportedAt)).toEqual({
      bedCount: 2,
      plantingCount: 3,
      bedNames: ["Kitchen Salsa Bed", "Herb Spiral 🌿"],
      exportedAt
    });
  });
});
