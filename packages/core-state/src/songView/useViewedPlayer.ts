import { useLayoutEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { songShown, stemShown } from '../playOrder/shown.ts';
import { songPlayerStore, type SongPlayerStore } from '../songPlayer/store.ts';
import {
  stemPlayerStore,
  type StemPlayerStatus,
  type StemPlayerStore,
} from '../stemPlayer/store.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import type { PlayerSource, SongSource, StemSource } from './playerSource.ts';
import { songViewStore, type SongViewStore } from './songView.ts';
import { stemViewStore, type StemViewStore } from './stemView.ts';

interface Viewer {
  readonly status: StemPlayerStatus;
  readonly view: (id: number, waveformBars: number) => Promise<void>;
  readonly leave: () => void;
}

interface ViewedKind<S, L extends S, V extends S & Viewer> {
  readonly live: StoreApi<L>;
  readonly view: StoreApi<V>;
  readonly liveHolds: (state: L, id: number) => boolean;
  readonly idOf: (state: V) => number | null;
}

const SONG_KIND: ViewedKind<SongSource, SongPlayerStore, SongViewStore> = {
  live: songPlayerStore,
  view: songViewStore,
  liveHolds: (state, id) => songShown(state) && state.songId === id,
  idOf: (state) => state.songId,
};

const STEM_KIND: ViewedKind<StemSource, StemPlayerStore, StemViewStore> = {
  live: stemPlayerStore,
  view: stemViewStore,
  liveHolds: (state, id) => stemShown(state) && state.setId === id,
  idOf: (state) => state.setId,
};

function viewHolds<V extends Viewer>(
  kind: { readonly idOf: (state: V) => number | null },
  state: V,
  id: number,
) {
  return state.status !== 'idle' && kind.idOf(state) === id;
}

function useViewedPlayer<S, L extends S, V extends S & Viewer>(
  kind: ViewedKind<S, L, V>,
  id: number,
  requested: boolean,
  waveformBars: number,
): PlayerSource<S> {
  const [mode, setMode] = useState({ id, viewing: requested });
  let { viewing } = mode;
  if (mode.id !== id) {
    viewing = requested;
    setMode({ id, viewing });
  }
  const live = useStore(kind.live, (state) => kind.liveHolds(state, id));
  const viewed = useStore(kind.view, (state) => viewHolds(kind, state, id));
  if (viewing && live && !viewed) {
    viewing = false;
    setMode({ id, viewing });
  }
  useLayoutEffect(() => {
    if (!viewing) return undefined;
    if (!viewHolds(kind, kind.view.getState(), id))
      void kind.view.getState().view(id, waveformBars);
    return () => {
      const state = kind.view.getState();
      if (viewHolds(kind, state, id)) state.leave();
    };
  }, [kind, viewing, id, waveformBars]);
  return useMemo(
    () => ({ store: viewing ? kind.view : kind.live, viewing }),
    [kind, viewing],
  );
}

export function useSongSource(
  songId: number,
  requested: boolean,
  waveformBars: number,
): PlayerSource<SongSource> {
  return useViewedPlayer(SONG_KIND, songId, requested, waveformBars);
}

export function useStemSource(
  setId: number,
  requested: boolean,
  waveformBars: number,
): PlayerSource<StemSource> {
  return useViewedPlayer(STEM_KIND, setId, requested, waveformBars);
}

const heldFrame = (state: { startSec: number; engineRate: number }) =>
  secondsToFrames(state.startSec, state.engineRate);

export function useSongHeldFrame(viewing: boolean): number | null {
  const frame = useStore(songViewStore, heldFrame);
  return viewing ? frame : null;
}

export function useStemHeldFrame(viewing: boolean): number | null {
  const frame = useStore(stemViewStore, heldFrame);
  return viewing ? frame : null;
}
