export type NexoQueueTrack = {
  id: string;
  title: string;
  artist?: string | null;
  artworkUrl?: string | null;
  durationMs?: number | null;
  /** Short-lived signed URL — may be null when unavailable. */
  src: string | null;
};

export type NexoPlayerLabels = {
  brand?: string;
  emptyMessage?: string;
};
