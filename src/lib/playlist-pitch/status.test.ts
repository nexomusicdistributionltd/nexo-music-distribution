import { describe, expect, it } from "vitest";
import {
  canOwnerTransitionPitch,
  canStaffTransitionPitch,
  isPlaylistPitchStatus,
} from "./status";

describe("playlist pitch status machine", () => {
  it("lets owners submit drafts and restaff review", () => {
    expect(isPlaylistPitchStatus("draft")).toBe(true);
    expect(canOwnerTransitionPitch("draft", "submitted")).toBe(true);
    expect(canOwnerTransitionPitch("submitted", "accepted")).toBe(false);
    expect(canStaffTransitionPitch("submitted", "reviewing")).toBe(true);
    expect(canStaffTransitionPitch("reviewing", "accepted")).toBe(true);
    expect(canStaffTransitionPitch("reviewing", "rejected")).toBe(true);
    expect(canOwnerTransitionPitch("accepted", "rejected")).toBe(false);
    expect(canOwnerTransitionPitch("rejected", "submitted")).toBe(true);
  });
});
