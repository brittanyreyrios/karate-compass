import { describe, it, expect } from "vitest";
import { csvCell } from "./csv-safe";
describe("csvCell", () => {
  for (const c of ["=", "+", "-", "@", "\t", "\r"]) {
    it(`prefixes cells starting with ${JSON.stringify(c)}`, () => {
      expect(csvCell(`${c}SUM(A1)`)).toBe(`"'${c}SUM(A1)"`);
    });
  }
  it("leaves normal text alone and escapes quotes", () => {
    expect(csvCell('Khan "family"')).toBe('"Khan ""family"""');
  });
});
