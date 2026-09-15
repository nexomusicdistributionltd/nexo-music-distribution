"use client";

import { NexoMusicPlayer } from "./NexoMusicPlayer";
import type { NexoQueueTrack } from "./types";

export function NexoTrackPlayer({
  track,
  className,
}: {
  track: NexoQueueTrack;
  className?: string;
}) {
  return (
    <NexoMusicPlayer
      tracks={[track]}
      compact
      className={className}
      emptyMessage="No authorized preview for this track."
    />
  );
}
