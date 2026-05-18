import { describe, it, expect } from "vitest";
import { addDays, dayNumber, totalDays, lossPercent } from "./seasons";

describe("seasons utils", () => {
  it("addDays adds days correctly across months", () => {
    expect(addDays("2026-05-30", 3)).toBe("2026-06-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", 12)).toBe("2026-01-13");
  });

  it("totalDays inclusive 13", () => {
    expect(totalDays("2026-05-01", "2026-05-13")).toBe(13);
  });

  it("dayNumber returns 1..N inside window, null outside", () => {
    expect(dayNumber("2026-05-01", "2026-05-13", "2026-05-01")).toBe(1);
    expect(dayNumber("2026-05-01", "2026-05-13", "2026-05-13")).toBe(13);
    expect(dayNumber("2026-05-01", "2026-05-13", "2026-05-07")).toBe(7);
    expect(dayNumber("2026-05-01", "2026-05-13", "2026-04-30")).toBeNull();
    expect(dayNumber("2026-05-01", "2026-05-13", "2026-05-14")).toBeNull();
  });

  it("lossPercent computes positive for weight loss", () => {
    expect(lossPercent(60, 57)).toBeCloseTo(5, 5);
    expect(lossPercent(60, 60)).toBe(0);
    expect(lossPercent(60, 63)).toBeCloseTo(-5, 5);
  });

  it("lossPercent guards against missing baseline", () => {
    expect(lossPercent(null, 60)).toBe(0);
    expect(lossPercent(60, null)).toBe(0);
    expect(lossPercent(0, 60)).toBe(0);
  });
});
