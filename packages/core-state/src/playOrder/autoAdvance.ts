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

export const ARRIVAL = {
  arriving: 'arriving',
  playing: 'playing',
  gaveUp: 'gaveUp',
} as const;

export type ArrivalEvent =
  | { readonly kind: typeof ARRIVAL.arriving; readonly stemSetId: number }
  | {
      readonly kind: typeof ARRIVAL.playing;
      readonly stemSetId: number;
      readonly place: SetlistPlace | null;
      readonly skipped: Skip | null;
    }
  | { readonly kind: typeof ARRIVAL.gaveUp };

export type Arrival = ArrivalEvent & { readonly serial: number };

export interface ArrivalState {
  readonly arrival: Arrival | null;
}

export const arrivalStore = createStore<ArrivalState>(() => ({
  arrival: null,
}));

export interface AutoAdvanceDeps {
  readonly onSongEnd: (listener: () => void) => () => void;
  readonly advanceTo: (stemSetId: number) => Promise<AdvanceOutcome>;
  readonly peekNext: () => Promise<SkipResult>;
  readonly commitNext: (next: Advance) => Promise<void>;
  readonly placeOf: (advance: Advance) => SetlistPlace | null;
  readonly candidates: () => number;
  readonly stillEnded: () => boolean;
  readonly stopAdvancing: () => void;
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
  peekNext: () => playOrderStore.getState().peekNext(),
  commitNext: (next) => playOrderStore.getState().commitNext(next),
  placeOf: (advance) => {
    if (advance.kind !== ADVANCE.play || advance.setlistItemId === null)
      return null;
    const { stage, cursor } = onStageNow();
    if (cursor === null) return null;
    return { number: cursor.index + 1, of: stage.entries.length };
  },
  candidates: () =>
    playOrderStore.getState().queue.length + onStageNow().stage.entries.length,
  stillEnded: () => stemPlayerStore.getState().songStillEnded(),
  stopAdvancing: () => {
    stemPlayerStore.getState().stopAdvancing();
  },
  arrivals: arrivalStore,
};

export function startAutoAdvance(deps: AutoAdvanceDeps = defaultDeps) {
  let serial = 0;
  const arrive = (arrival: ArrivalEvent) => {
    serial++;
    deps.arrivals.setState({ arrival: { ...arrival, serial } });
  };
  const advance = async () => {
    let skipped: Skip | null = null;
    for (let left = deps.candidates(); left > 0; left--) {
      if (!deps.stillEnded()) return;
      const step = await deps.peekNext();
      if (!deps.stillEnded()) return;
      if (step.skipped) skipped = SKIP.deleted;
      const next = step.advance;
      if (next.kind !== ADVANCE.play) break;
      await deps.commitNext(next);
      const { stemSetId } = next;
      const place = deps.placeOf(next);
      arrive({ kind: ARRIVAL.arriving, stemSetId });
      const outcome = await deps.advanceTo(stemSetId);
      if (outcome === ADVANCE_OUTCOME.displaced) return;
      if (outcome === ADVANCE_OUTCOME.playing) {
        arrive({ kind: ARRIVAL.playing, stemSetId, place, skipped });
        return;
      }
      skipped = SKIP.unopened;
    }
    deps.stopAdvancing();
    if (skipped === SKIP.deleted) arrive({ kind: ARRIVAL.gaveUp });
  };
  return deps.onSongEnd(() => {
    advance().catch((error: unknown) => {
      console.warn('[kitbag] auto-advance failed', error);
    });
  });
}
