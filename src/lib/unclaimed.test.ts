import { describe, it, expect } from "vitest";
import { isUnclaimedNoPhotos } from "./unclaimed";
describe("unclaimed photo default", () => {
  it("staff-created unclaimed child is NO photos", () => {
    expect(isUnclaimedNoPhotos({ parent_id: null, created_by_staff: true })).toBe(true);
  });
  it("claimed child follows the family's setting", () => {
    expect(isUnclaimedNoPhotos({ parent_id: "abc", created_by_staff: true })).toBe(false);
  });
  it("existing (non-staff-created) students are unchanged", () => {
    expect(isUnclaimedNoPhotos({ parent_id: null, created_by_staff: false })).toBe(false);
  });
});
