import { describe, expect, it } from "vitest";
import {
  getLastFrostAnchor,
  getWindowStatus,
  resolvePlantingMethodWindow
} from "../resolvePlantingWindow";
import { dateParts } from "./helpers";

describe("resolvePlantingWindow", () => {
  it("builds the last-frost anchor from the zone lookup", () => {
    expect(dateParts(getLastFrostAnchor("5-6", 2026))).toEqual([2026, 3, 22]);
  });

  it("resolves windows before last frost", () => {
    const anchor = new Date(2026, 3, 22, 12);
    const result = resolvePlantingMethodWindow(anchor, {
      startWeeksBeforeLastFrost: 6,
      endWeeksBeforeLastFrost: 4
    });

    expect(result).not.toBeNull();
    expect(dateParts(result!.start)).toEqual([2026, 2, 11]);
    expect(dateParts(result!.end)).toEqual([2026, 2, 25]);
  });

  it("sorts reversed windows into chronological order", () => {
    const anchor = new Date(2026, 3, 22, 12);
    const result = resolvePlantingMethodWindow(anchor, {
      startWeeksAfterLastFrost: 3,
      endWeeksAfterLastFrost: 1
    });

    expect(result).not.toBeNull();
    expect(dateParts(result!.start)).toEqual([2026, 3, 29]);
    expect(dateParts(result!.end)).toEqual([2026, 4, 13]);
  });

  it("returns null when the method window has no usable bounds", () => {
    expect(resolvePlantingMethodWindow(new Date(2026, 3, 22, 12), {})).toBeNull();
  });

  it("reports upcoming, open, and closed states", () => {
    const start = new Date(2026, 3, 22, 12);
    const end = new Date(2026, 3, 29, 12);

    expect(getWindowStatus(new Date(2026, 3, 21, 12), start, end)).toBe(
      "Upcoming"
    );
    expect(getWindowStatus(new Date(2026, 3, 22, 12), start, end)).toBe(
      "Open now"
    );
    expect(getWindowStatus(new Date(2026, 3, 30, 12), start, end)).toBe(
      "Closed"
    );
  });
});
