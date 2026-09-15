"use client";

import * as React from "react";
import type { NexoQueueTrack } from "./types";

type MiniPlayerState = {
  queue: NexoQueueTrack[];
  index: number;
  playing: boolean;
};

type MiniPlayerContextValue = {
  state: MiniPlayerState;
  setQueue: (tracks: NexoQueueTrack[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
};

const MiniPlayerContext = React.createContext<MiniPlayerContextValue | null>(null);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<MiniPlayerState>({
    queue: [],
    index: 0,
    playing: false,
  });

  const value = React.useMemo<MiniPlayerContextValue>(
    () => ({
      state,
      setQueue: (tracks, startIndex = 0) =>
        setState({ queue: tracks, index: startIndex, playing: true }),
      play: () => setState((s) => ({ ...s, playing: true })),
      pause: () => setState((s) => ({ ...s, playing: false })),
      next: () =>
        setState((s) => ({
          ...s,
          index: s.queue.length ? (s.index + 1) % s.queue.length : 0,
          playing: true,
        })),
      prev: () =>
        setState((s) => ({
          ...s,
          index: s.queue.length
            ? (s.index - 1 + s.queue.length) % s.queue.length
            : 0,
          playing: true,
        })),
      setIndex: (i) => setState((s) => ({ ...s, index: i, playing: true })),
    }),
    [state]
  );

  return (
    <MiniPlayerContext.Provider value={value}>{children}</MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  return React.useContext(MiniPlayerContext);
}
