import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateICSFile } from "../generateICS";

describe("generateICSFile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 1, 0, 0, 0)));
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates an all-day calendar file with escaped values", async () => {
    const blob = generateICSFile("ignored", [
      {
        title: "Plant, carrots; now",
        description: "Line 1\nLine 2; check",
        startDate: new Date(2026, 4, 2, 12)
      }
    ]);

    expect(blob.type).toBe("text/calendar;charset=utf-8");

    const text = await blob.text();

    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("PRODID:-//Sow Simple//EN");
    expect(text).toContain(
      "UID:00000000-0000-4000-8000-000000000000@sow-simple"
    );
    expect(text).toContain("DTSTAMP:20260401T000000Z");
    expect(text).toContain("DTSTART;VALUE=DATE:20260502");
    expect(text).toContain("SUMMARY:Plant\\, carrots\\; now");
    expect(text).toContain("DESCRIPTION:Line 1\\nLine 2\\; check");
  });
});
