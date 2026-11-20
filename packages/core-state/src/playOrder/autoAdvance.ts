import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { ADVANCE, cursorOf, onStageOf, type Advance } from './order.ts';
import { playOrderStore, type SkipResult } from './store.ts';

export const SKIP = { deleted: 'deleted', unopened: 'unopened' } as const;

export type Skip = (typeof SKIP)[keyof typeof SKIP];

export interface SetlistPlace {
  readonly number: number;
  readonly of: number;
}

export interface Arrival {
  readonly serial: number;
  readonly stemSetId: number | null;
  readonly place: SetlistPlace | null;
  readonly skipped: Skip | null;
}

export interface ArrivalState {
  readonly arrival: Arrival | null;
}

export const arrivalStore = createStore<ArrivalState>(() => ({
  arrival: null,
}));

export interface AutoAdvanceDeps {
  readonly onSongEnd: (listener: () => void) => () => void;
  readonly advanceTo: (stemSetId: number) => Promise<AdvanceOutcome>;
  readonly skipToNext: () => Promise<SkipResult>;
  readonly placeOf: (advance: Advance) => SetlistPlace | null;
  readonly candidates: () => number;
  readonly arrivals: StoreApi<ArrivalState>;
}

function onStageNow() {
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return { stage, cursor: cursorOf(stage, library.loaded) };
}

const defaultDeps: AutoAdvanceDeps = {
  onSongEnd: (listener) => stemPlayerStore.getState().onSongEnd(listener),
  advanceTo: (stemSetId) => stemPlayerStore.getState().advanceTo(stemSetId),
  skipToNext: () => playOrderStore.getState().skipToNext(),
  placeOf: (advance) => {
    if (advance.kind !== ADVANCE.play || advance.setlistItemId === null)
      return null;
    const { stage, cursor } = onStageNow();
    if (cursor === null) return null;
    return { number: cursor.index + 1, of: stage.entries.length };
  },
  candidates: () =>
    playOrderStore.getState().queue.length + onStageNow().stage.entries.length,
  arrivals: arrivalStore,
};

export function startAutoAdvance(deps: AutoAdvanceDeps = defaultDeps) {
  let serial = 0;
  const arrive = (arrival: Omit<Arrival, 'serial'>) => {
    serial++;
    deps.arrivals.setState({ arrival: { ...arrival, serial } });
  };
  const advance = async () => {
    let skipped: Skip | null = null;
    for (let left = deps.candidates(); left > 0; left--) {
      const step = await deps.skipToNext();
      if (step.skipped) skipped = SKIP.deleted;
      const next = step.advance;
      if (next.kind !== ADVANCE.play) break;
      const place = deps.placeOf(next);
      arrive({ stemSetId: next.stemSetId, place, skipped });
      const outcome = await deps.advanceTo(next.stemSetId);
      if (outcome !== ADVANCE_OUTCOME.unplayable) return;
      skipped = SKIP.unopened;
    }
    if (skipped !== null) arrive({ stemSetId: null, place: null, skipped });
  };
  return deps.onSongEnd(() => {
    advance().catch((error: unknown) => {
      console.warn('[kitbag] auto-advance failed', error);
    });
  });
}
