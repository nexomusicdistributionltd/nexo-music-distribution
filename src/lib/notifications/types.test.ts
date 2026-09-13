import { describe, expect, it } from "vitest";
import type { NotificationRow } from "@/lib/releases/types";

describe("notifications model", () => {
  it("supports read/unread via read_at", () => {
    const unread: NotificationRow = {
      id: "1",
      user_id: "u",
      type: "release_submitted",
      title: "Submitted",
      body: "ok",
      entity_type: "release",
      entity_id: "r",
      read_at: null,
      created_at: new Date().toISOString(),
    };
    expect(unread.read_at).toBeNull();
    const read = { ...unread, read_at: new Date().toISOString() };
    expect(read.read_at).toBeTruthy();
  });
});
