"use client";

export function TrackPlayer({
  title,
  trackNumber,
  signedUrl,
}: {
  title: string;
  trackNumber: number;
  signedUrl: string | null;
}) {
  return (
    <div className="rounded-[var(--nexo-radius-md)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
      <p className="text-small font-medium text-[var(--nexo-text)]">
        {trackNumber}. {title || "Untitled track"}
      </p>
      {signedUrl ? (
        <audio className="mt-2 w-full" controls preload="none" src={signedUrl}>
          Your browser does not support audio playback.
        </audio>
      ) : (
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          No playable audio available for this track.
        </p>
      )}
    </div>
  );
}
