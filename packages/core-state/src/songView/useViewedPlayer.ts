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
import type { HeldSlice } from './heldTransport.ts';
import type { PlayerSource, SongSource, StemSource } from './playerSource.ts';
import { songViewStore, type SongViewStore } from './songView.ts';
import { stemViewStore, type StemViewStore } from './stemView.ts';

interface Viewer {
  readonly status: StemPlayerStatus;
  readonly view: (id: number, waveformBars: number) => Promise<void>;
  readonly leave: () => void;
}

export interface ViewedKind<S, L extends S, V extends S & Viewer> {
  readonly live: StoreApi<L>;
  readonly view: StoreApi<V>;
  readonly liveHoldsId: (state: L, id: number) => boolean;
  readonly idOf: (state: V) => number | null;
}

export const SONG_KIND: ViewedKind<SongSource, SongPlayerStore, SongViewStore> =
  {
    live: songPlayerStore,
    view: songViewStore,
    liveHoldsId: (state, id) => songShown(state) && state.songId === id,
    idOf: (state) => state.songId,
  };

const STEM_KIND: ViewedKind<StemSource, StemPlayerStore, StemViewStore> = {
  live: stemPlayerStore,
  view: stemViewStore,
  liveHoldsId: (state, id) => stemShown(state) && state.setId === id,
  idOf: (state) => state.setId,
};

function viewHoldsId<V extends Viewer>(
  kind: { readonly idOf: (state: V) => number | null },
  state: V,
  id: number,
) {
  return state.status !== 'idle' && kind.idOf(state) === id;
}

export function useViewingMode<S, L extends S, V extends S & Viewer>(
  kind: ViewedKind<S, L, V>,
  id: number,
  requested: boolean,
): boolean {
  const [firstId] = useState(id);
  const [wentLive, setWentLive] = useState(!requested);
  const playsHere = useStore(kind.live, (state) => kind.liveHoldsId(state, id));
  const goesLive = !wentLive && (id !== firstId || playsHere);
  if (goesLive) setWentLive(true);
  return !wentLive && !goesLive;
}

export function useViewedSource<S, L extends S, V extends S & Viewer>(
  kind: ViewedKind<S, L, V>,
  id: number,
  requested: boolean,
  waveformBars: number,
): PlayerSource<S> {
  const viewing = useViewingMode(kind, id, requested);
  useLayoutEffect(() => {
    if (!viewing) return undefined;
    if (!viewHoldsId(kind, kind.view.getState(), id))
      void kind.view.getState().view(id, waveformBars);
    return () => {
      const state = kind.view.getState();
      if (viewHoldsId(kind, state, id)) state.leave();
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
  return useViewedSource(SONG_KIND, songId, requested, waveformBars);
}

export function useStemSource(
  setId: number,
  requested: boolean,
  waveformBars: number,
): PlayerSource<StemSource> {
  return useViewedSource(STEM_KIND, setId, requested, waveformBars);
}

const heldFrameOf = (state: HeldSlice) =>
  secondsToFrames(state.startSec, state.engineRate);

export function useHeldFrame(
  view: StoreApi<HeldSlice>,
  viewing: boolean,
): number | null {
  const frame = useStore(view, heldFrameOf);
  return viewing ? frame : null;
}

export function useSongHeldFrame(viewing: boolean): number | null {
  return useHeldFrame(songViewStore, viewing);
}

export function useStemHeldFrame(viewing: boolean): number | null {
  return useHeldFrame(stemViewStore, viewing);
}
