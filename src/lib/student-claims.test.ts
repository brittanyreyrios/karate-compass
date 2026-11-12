import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { claimSucceeded, normalizeClaimCode } from "./student-claims";

describe("student claim results", () => {
  it("normalizes surrounding spaces and lowercase claim codes", () => {
    expect(normalizeClaimCode("  abcdefgh  ")).toBe("ABCDEFGH");
  });
  it("accepts only a successful result with a returned student ID", () => {
    expect(claimSucceeded({ success: true, student_id: "child-id" })).toBe(true);
    expect(claimSucceeded({ success: false, student_id: "child-id" })).toBe(false);
    expect(claimSucceeded({ success: true })).toBe(false);
    expect(claimSucceeded(null)).toBe(false);
  });
});