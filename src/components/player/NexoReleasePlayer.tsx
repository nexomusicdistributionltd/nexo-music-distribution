"use client";

import { NexoMusicPlayer } from "./NexoMusicPlayer";
import type { NexoQueueTrack } from "./types";

export type NexoReleasePlayerProps = {
  title: string;
  artistName: string;
  artworkUrl?: string | null;
  tracks: Array<{
    id: string;
    title: string;
    version?: string | null;
    durationMs?: number | null;
    signedUrl?: string | null;
  }>;
  eligible: boolean;
  className?: string;
};

export function NexoReleasePlayer({
  title: _title,
  artistName,
  artworkUrl,
  tracks,
  eligible,
  className,
}: NexoReleasePlayerProps) {
  void _title;
  const queue: NexoQueueTrack[] = eligible
    ? tracks.map((t) => ({
        id: t.id,
        title: t.version ? `${t.title} (${t.version})` : t.title,
        artist: artistName,
        artworkUrl: artworkUrl ?? null,
        durationMs: t.durationMs ?? null,
        src: t.signedUrl ?? null,
      }))
    : [];

  return (
    <NexoMusicPlayer
      tracks={queue}
      className={className}
      emptyMessage={
        eligible
          ? "Authorized audio is not available for preview yet."
          : "Preview playback is not enabled for this release."
      }
    />
  );
}
