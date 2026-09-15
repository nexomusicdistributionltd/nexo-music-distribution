"use client";

import * as React from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSeconds } from "./format";
import type { NexoQueueTrack } from "./types";

export type NexoMusicPlayerProps = {
  tracks: NexoQueueTrack[];
  initialIndex?: number;
  className?: string;
  compact?: boolean;
  brand?: string;
  emptyMessage?: string;
  onTrackChange?: (track: NexoQueueTrack | null, index: number) => void;
};

export function NexoMusicPlayer({
  tracks,
  initialIndex = 0,
  className,
  compact = false,
  brand = "NEXO MUSIC",
  emptyMessage = "No authorized preview audio is available for this release.",
  onTrackChange,
}: NexoMusicPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = React.useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, tracks.length - 1))
  );
  const [playing, setPlaying] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.9);
  const [muted, setMuted] = React.useState(false);

  const playable = React.useMemo(
    () => tracks.filter((t) => Boolean(t.src)),
    [tracks]
  );
  const track = tracks[index] ?? null;
  const hasAudio = Boolean(track?.src);

  React.useEffect(() => {
    onTrackChange?.(track, index);
  }, [track, index, onTrackChange]);

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = muted ? 0 : volume;
  }, [volume, muted]);

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el || !track?.src) {
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    setError(null);
    setLoading(true);
    el.src = track.src;
    el.load();
    const p = el.play();
    if (p) {
      p.then(() => {
        setPlaying(true);
        setLoading(false);
      }).catch(() => {
        setPlaying(false);
        setLoading(false);
      });
    }
  }, [track?.id, track?.src]);

  const toggle = React.useCallback(() => {
    const el = audioRef.current;
    if (!el || !track?.src) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setError("Playback failed."));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [track?.src]);

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(value)) return;
    el.currentTime = value;
    setCurrentTime(value);
  };

  const go = (delta: number) => {
    if (!tracks.length) return;
    setIndex((i) => (i + delta + tracks.length) % tracks.length);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") {
        seek(Math.min(duration, currentTime + 5));
      } else if (e.key === "ArrowLeft") {
        seek(Math.max(0, currentTime - 5));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setVolume((v) => Math.min(1, v + 0.05));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setVolume((v) => Math.max(0, v - 0.05));
      } else if (e.key === "n") {
        go(1);
      } else if (e.key === "p") {
        go(-1);
      } else if (e.key === "m") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!tracks.length || playable.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5",
          className
        )}
        role="region"
        aria-label="Nexo music player"
      >
        <div className="flex items-center gap-2 text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          <Music2 className="h-3.5 w-3.5" aria-hidden />
          {brand}
        </div>
        <p className="mt-3 text-small text-[var(--nexo-text-muted)]">{emptyMessage}</p>
        <audio ref={audioRef} preload="none" className="hidden" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]",
        className
      )}
      role="region"
      aria-label="Nexo music player"
    >
      <div
        className={cn(
          "flex gap-4 p-4 sm:p-5",
          compact ? "flex-row items-center" : "flex-col sm:flex-row sm:items-stretch"
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)]",
            compact ? "h-14 w-14" : "mx-auto h-40 w-40 sm:mx-0 sm:h-36 sm:w-36"
          )}
        >
          {track?.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.artworkUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--nexo-text-muted)]">
              <Music2 className={compact ? "h-5 w-5" : "h-10 w-10"} aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
                {brand}
              </p>
              <h3 className="mt-1 truncate text-h4 text-[var(--nexo-text)]">
                {track?.title || "Untitled"}
              </h3>
              {track?.artist ? (
                <p className="mt-0.5 truncate text-small text-[var(--nexo-text-secondary)]">
                  {track.artist}
                </p>
              ) : null}
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--nexo-text-muted)]" aria-hidden />
            ) : null}
          </div>

          {error ? (
            <p className="mt-2 text-caption text-red-500" role="alert">
              {error}
            </p>
          ) : null}
          {!hasAudio ? (
            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
              Preview unavailable for this track.
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2 text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-elevated)]"
              aria-label="Previous track"
              onClick={() => go(-1)}
              disabled={tracks.length < 2}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--nexo-text)] text-[var(--nexo-bg)] disabled:opacity-40"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
              disabled={!hasAudio}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-elevated)]"
              aria-label="Next track"
              onClick={() => go(1)}
              disabled={tracks.length < 2}
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="rounded-full p-2 text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-elevated)]"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => setMuted((m) => !m)}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label="Volume"
                className="hidden w-24 accent-[var(--nexo-text)] sm:block"
                onChange={(e) => {
                  setMuted(false);
                  setVolume(Number(e.target.value));
                }}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="w-10 text-caption tabular-nums text-[var(--nexo-text-muted)]">
              {formatSeconds(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              aria-label="Seek"
              className="h-1.5 flex-1 accent-[var(--nexo-text)]"
              disabled={!hasAudio}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <span className="w-10 text-right text-caption tabular-nums text-[var(--nexo-text-muted)]">
              {formatSeconds(duration || (track?.durationMs ? track.durationMs / 1000 : 0))}
            </span>
          </div>
        </div>
      </div>

      {tracks.length > 1 && !compact ? (
        <ol className="max-h-56 divide-y divide-[var(--nexo-border)] overflow-y-auto border-t border-[var(--nexo-border)]">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-small transition hover:bg-[var(--nexo-elevated)]",
                  i === index && "bg-[var(--nexo-elevated)]"
                )}
                onClick={() => setIndex(i)}
                aria-current={i === index ? "true" : undefined}
              >
                <span className="w-6 tabular-nums text-caption text-[var(--nexo-text-muted)]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {!t.src ? (
                  <span className="text-caption text-[var(--nexo-text-muted)]">Unavailable</span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => go(1)}
        onError={() => {
          setError("Unable to load authorized audio.");
          setLoading(false);
          setPlaying(false);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
