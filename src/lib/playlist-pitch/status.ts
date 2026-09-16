export const PLAYLIST_PITCH_STATUSES = [
  "draft",
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
] as const;

export type PlaylistPitchStatus = (typeof PLAYLIST_PITCH_STATUSES)[number];

const OWNER_TRANSITIONS: Record<PlaylistPitchStatus, PlaylistPitchStatus[]> = {
  draft: ["draft", "submitted"],
  submitted: [],
  reviewing: [],
  accepted: [],
  rejected: ["draft", "submitted"],
};

const STAFF_TRANSITIONS: Record<PlaylistPitchStatus, PlaylistPitchStatus[]> = {
  draft: ["submitted", "reviewing", "rejected"],
  submitted: ["reviewing", "accepted", "rejected"],
  reviewing: ["accepted", "rejected", "submitted"],
  accepted: [],
  rejected: ["reviewing"],
};

export function isPlaylistPitchStatus(value: string): value is PlaylistPitchStatus {
  return (PLAYLIST_PITCH_STATUSES as readonly string[]).includes(value);
}

export function canOwnerTransitionPitch(
  from: PlaylistPitchStatus,
  to: PlaylistPitchStatus
): boolean {
  return OWNER_TRANSITIONS[from].includes(to);
}

export function canStaffTransitionPitch(
  from: PlaylistPitchStatus,
  to: PlaylistPitchStatus
): boolean {
  return STAFF_TRANSITIONS[from].includes(to);
}
