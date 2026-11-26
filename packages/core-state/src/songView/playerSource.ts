import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { songPlayerStore, type SongPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore, type StemPlayerStore } from '../stemPlayer/store.ts';
import type { SongViewStore } from './songView.ts';
import type { StemViewStore } from './stemView.ts';

export type SongSource = Pick<
  SongPlayerStore,
  keyof SongPlayerStore & keyof SongViewStore
>;
export type StemSource = Pick<
  StemPlayerStore,
  keyof StemPlayerStore & keyof StemViewStore
>;

export interface PlayerSource<S> {
  readonly store: Pick<
    StoreApi<S>,
    'getState' | 'getInitialState' | 'subscribe'
  >;
  readonly viewing: boolean;
}

export const SongSourceContext = createContext<PlayerSource<SongSource>>({
  store: songPlayerStore,
  viewing: false,
});

export const StemSourceContext = createContext<PlayerSource<StemSource>>({
  store: stemPlayerStore,
  viewing: false,
});

export function useSongViewing(): boolean {
  return useContext(SongSourceContext).viewing;
}

export function useStemViewing(): boolean {
  return useContext(StemSourceContext).viewing;
}

export function useSongPlayer<T>(selector: (state: SongSource) => T): T {
  return useStore(useContext(SongSourceContext).store, selector);
}

export function useStemPlayer<T>(selector: (state: StemSource) => T): T {
  return useStore(useContext(StemSourceContext).store, selector);
}
