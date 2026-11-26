import { describe, it, expect } from "vitest";
import { classRate, parseClassDays, weekStart } from "./trends";

describe("trends helpers", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });
  it("Mon/Wed means Monday and Wednesday", () => {
    expect([...parseClassDays("Mon/Wed")]).toEqual([0, 2]);
    expect([...parseClassDays("Tue/Thu")]).toEqual([1, 3]);
  });
  it("class rate counts held days minus holidays and one check-in per kid per day", () => {
    // Mon 11-16 .. Sun 11-22: Mon+Wed held = 2, minus holiday Wed = 1
    const r = classRate({
      days: "Mon/Wed", kids: ["a", "b"], holidays: new Set(["2026-11-18"]),
      windowStart: "2026-11-16", windowEnd: "2026-11-22",
      checkins: new Set(["a|2026-11-16", "a|2026-11-18", "b|2026-11-17"]),
    });
    expect(r).toEqual({ held: 1, checkins: 1, rate: 0.5 });
  });
});
