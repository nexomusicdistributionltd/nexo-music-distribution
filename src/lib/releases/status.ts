import type { AppRole } from "@/lib/auth/types";
import {
  EDITABLE_STATUSES,
  PROVIDER_GATED_STATUSES,
  type ReleaseStatus,
} from "./types";

export type TransitionActor = "owner" | "staff";

const OWNER_TRANSITIONS: Partial<Record<ReleaseStatus, ReleaseStatus[]>> = {
  draft: ["submitted"],
  changes_requested: ["submitted"],
  approved: ["takedown_requested"],
  scheduled: ["takedown_requested"],
  delivered: ["takedown_requested"],
  live: ["takedown_requested"],
};

const STAFF_TRANSITIONS: Partial<Record<ReleaseStatus, ReleaseStatus[]>> = {
  submitted: ["in_qc", "changes_requested", "rejected", "approved"],
  in_qc: ["changes_requested", "rejected", "approved"],
  approved: ["scheduled", "rejected", "changes_requested"],
  scheduled: ["delivering", "changes_requested", "failed"],
  delivering: ["delivered", "live", "rejected", "failed"],
  delivered: ["live", "failed"],
  failed: ["scheduled", "approved", "changes_requested"],
  takedown_requested: ["taken_down", "live", "delivered"],
  live: ["takedown_requested"],
  rejected: ["draft", "changes_requested"],
};

export function actorKind(roles: AppRole[]): TransitionActor | null {
  if (roles.some((r) => r === "admin" || r === "super_admin" || r === "support")) {
    return "staff";
  }
  if (roles.some((r) => r === "artist" || r === "label")) {
    return "owner";
  }
  return null;
}

export function allowedTransitions(
  from: ReleaseStatus,
  actor: TransitionActor,
  providerConnected: boolean
): ReleaseStatus[] {
  const map = actor === "staff" ? STAFF_TRANSITIONS : OWNER_TRANSITIONS;
  const next = map[from] ?? [];
  return next.filter((s) => {
    if (PROVIDER_GATED_STATUSES.includes(s) && !providerConnected) return false;
    return true;
  });
}

export function canTransition(options: {
  from: ReleaseStatus;
  to: ReleaseStatus;
  actor: TransitionActor;
  providerConnected: boolean;
  isOwner: boolean;
}): { ok: boolean; reason?: string } {
  const { from, to, actor, providerConnected, isOwner } = options;

  if (from === to) {
    return { ok: false, reason: "Status is unchanged." };
  }

  if (actor === "owner" && !isOwner) {
    return { ok: false, reason: "Only the release owner can perform this action." };
  }

  // Users cannot self-approve or set provider/delivery statuses
  if (actor === "owner") {
    const forbidden: ReleaseStatus[] = [
      "approved",
      "in_qc",
      "rejected",
      "scheduled",
      "delivering",
      "delivered",
      "live",
      "failed",
      "taken_down",
    ];
    if (forbidden.includes(to)) {
      return {
        ok: false,
        reason: "Owners cannot set QC or delivery statuses.",
      };
    }
  }

  const allowed = allowedTransitions(from, actor, providerConnected);
  if (!allowed.includes(to)) {
    if (PROVIDER_GATED_STATUSES.includes(to) && !providerConnected) {
      return {
        ok: false,
        reason: "Distribution provider is not connected.",
      };
    }
    return {
      ok: false,
      reason: `Transition from ${from} to ${to} is not allowed.`,
    };
  }

  return { ok: true };
}

export function isEditableStatus(status: ReleaseStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canDuplicate(status: ReleaseStatus): boolean {
  // Safe to duplicate metadata from any status into a new draft
  void status;
  return true;
}

export function canRequestTakedown(status: ReleaseStatus): boolean {
  return ["approved", "scheduled", "delivered", "live"].includes(status);
}

export function canSubmit(status: ReleaseStatus): boolean {
  return status === "draft" || status === "changes_requested";
}
