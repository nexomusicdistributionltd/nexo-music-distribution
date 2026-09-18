import { describe, expect, it } from "vitest";
import {
  actorKind,
  allowedTransitions,
  canRequestTakedown,
  canSubmit,
  canTransition,
  isEditableStatus,
} from "./status";

describe("actorKind", () => {
  it("maps staff and owner roles", () => {
    expect(actorKind(["admin"])).toBe("staff");
    expect(actorKind(["support"])).toBe("staff");
    expect(actorKind(["artist"])).toBe("owner");
    expect(actorKind(["label"])).toBe("owner");
    expect(actorKind(["public_user"])).toBe(null);
  });
});

describe("canTransition — no self-approve", () => {
  it("blocks owner approving their own release", () => {
    const res = canTransition({
      from: "submitted",
      to: "approved",
      actor: "owner",
      providerConnected: false,
      isOwner: true,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/cannot set QC/i);
  });

  it("blocks owner setting delivered/live", () => {
    for (const to of ["delivered", "live", "delivering"] as const) {
      const res = canTransition({
        from: "approved",
        to,
        actor: "owner",
        providerConnected: true,
        isOwner: true,
      });
      expect(res.ok).toBe(false);
    }
  });

  it("allows owner draft → submitted", () => {
    const res = canTransition({
      from: "draft",
      to: "submitted",
      actor: "owner",
      providerConnected: false,
      isOwner: true,
    });
    expect(res.ok).toBe(true);
  });

  it("allows staff QC approve", () => {
    const res = canTransition({
      from: "in_qc",
      to: "approved",
      actor: "staff",
      providerConnected: false,
      isOwner: false,
    });
    expect(res.ok).toBe(true);
  });

  it("blocks provider-gated statuses when not connected", () => {
    const allowed = allowedTransitions("scheduled", "staff", false);
    expect(allowed).not.toContain("delivering");
    const res = canTransition({
      from: "scheduled",
      to: "delivering",
      actor: "staff",
      providerConnected: false,
      isOwner: false,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not connected/i);
  });

  it("APPROVED is not delivery", () => {
    expect(canSubmit("approved")).toBe(false);
    expect(isEditableStatus("approved")).toBe(false);
    expect(canRequestTakedown("approved")).toBe(true);
  });

  it("allows staff to return approved releases for changes", () => {
    const res = canTransition({
      from: "approved",
      to: "changes_requested",
      actor: "staff",
      providerConnected: true,
      isOwner: false,
    });
    expect(res.ok).toBe(true);
  });

  it("makes changes_requested editable and resubmittable by the owner", () => {
    expect(isEditableStatus("changes_requested")).toBe(true);
    expect(canSubmit("changes_requested")).toBe(true);
    const res = canTransition({
      from: "changes_requested",
      to: "submitted",
      actor: "owner",
      providerConnected: true,
      isOwner: true,
    });
    expect(res.ok).toBe(true);
  });
});

  it("blocks owner forging scheduled from draft", () => {
    const res = canTransition({
      from: "draft",
      to: "scheduled",
      actor: "owner",
      providerConnected: true,
      isOwner: true,
    });
    expect(res.ok).toBe(false);
  });
