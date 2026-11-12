import { describe, expect, it } from "vitest";
import { conversionCounts } from "./audit-conversion";

describe("audit conversion outcomes", () => {
  it("counts no-class children as converted, not failed", () => {
    expect(conversionCounts([{ import_id: "1", status: "converted", in_no_class: true }])).toEqual({ converted: 1, noClass: 1, skipped: 0, failed: 0 });
  });
  it("reports likely duplicates separately from successful conversion", () => {
    expect(conversionCounts([{ import_id: "2", status: "duplicate" }])).toEqual({ converted: 0, noClass: 0, skipped: 1, failed: 0 });
  });
});