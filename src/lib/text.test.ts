import { describe, expect, it } from "vitest";
import { norm, studentMatchesSearch } from "./text";

describe("norm", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(norm("  Mat   Lock ")).toBe("mat lock");
  });
});

describe("studentMatchesSearch", () => {
  const guardians = new Map([["p1", "Khan Family"]]);

  it("matches partial last name case-insensitively", () => {
    expect(
      studentMatchesSearch({ first_name: "Ava", last_name: "Matlock", parent_id: null }, "mat", guardians),
    ).toBe(true);
  });

  it("matches full name and guardian name", () => {
    const s = { first_name: "Ava", last_name: "Matlock", parent_id: "p1" };
    expect(studentMatchesSearch(s, "ava matlock", guardians)).toBe(true);
    expect(studentMatchesSearch(s, "khan", guardians)).toBe(true);
  });

  it("never throws and never matches the literal 'null' when names are null", () => {
    const s = { first_name: "Ava", last_name: null, parent_id: null };
    expect(() => studentMatchesSearch(s, "ava", guardians)).not.toThrow();
    expect(studentMatchesSearch(s, "ava", guardians)).toBe(true);
    expect(studentMatchesSearch(s, "null", guardians)).toBe(false);
    expect(
      studentMatchesSearch({ first_name: null, last_name: null, parent_id: "p1" }, "khan", guardians),
    ).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(
      studentMatchesSearch({ first_name: "Ava", last_name: "Matlock", parent_id: null }, "zzz", guardians),
    ).toBe(false);
  });
});
