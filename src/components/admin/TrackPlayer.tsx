"use client";

export function TrackPlayer({
  title,
  trackNumber,
  signedUrl,
  version,
  isrc,
  explicit,
  language,
  durationMs,
  lyrics,
  contributors,
}: {
  title: string;
  trackNumber: number;
  signedUrl: string | null;
  version?: string | null;
  isrc?: string | null;
  explicit?: boolean;
  language?: string | null;
  durationMs?: number | null;
  lyrics?: string | null;
  contributors?: { name: string; role: string }[];
}) {
  const durationLabel =
    typeof durationMs === "number" && durationMs > 0
      ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}`
      : null;

  return (
    <div className="rounded-[var(--nexo-radius-md)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
      <p className="text-small font-medium text-[var(--nexo-text)]">
        Track {trackNumber}
        {version ? ` · ${version}` : ""} · {title || "Untitled track"}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-caption text-[var(--nexo-text-secondary)]">
        <dt>ISRC</dt>
        <dd>{isrc || "—"}</dd>
        <dt>Explicit</dt>
        <dd>{explicit ? "Yes" : "No"}</dd>
        <dt>Language</dt>
        <dd>{language || "—"}</dd>
        <dt>Duration</dt>
        <dd>{durationLabel || "—"}</dd>
        <dt>Disc / track</dt>
        <dd>1 / {trackNumber}</dd>
      </dl>
      {contributors && contributors.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-caption text-[var(--nexo-text-secondary)]">
          {contributors.map((c, i) => (
            <li key={`${c.name}-${c.role}-${i}`}>
              {c.name} · {c.role.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ) : null}
      {lyrics ? (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[var(--nexo-bg)] p-2 text-caption text-[var(--nexo-text-secondary)]">
          {lyrics}
        </pre>
      ) : null}
      {signedUrl ? (
        <>
          <audio className="mt-2 w-full" controls preload="metadata" src={signedUrl}>
            Your browser does not support audio playback.
          </audio>
          <a
            href={signedUrl}
            className="mt-2 inline-flex text-caption underline-offset-4 hover:underline"
            download
          >
            Download / open uploaded audio
          </a>
        </>
      ) : (
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          No playable audio available for this track.
        </p>
      )}
    </div>
  );
}
