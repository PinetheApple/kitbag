import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import type { PresetSetlistEntry } from '../library/snapshot.ts';
import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { ADVANCE, cursorOf, onStageOf, type Advance } from './order.ts';
import { playOrderStore, type SkipResult, type Undo } from './store.ts';

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
  metronome: 'metronome',
} as const;

export type ArrivalEvent =
  | { readonly kind: typeof ARRIVAL.arriving; readonly stemSetId: number }
  | {
      readonly kind: typeof ARRIVAL.playing;
      readonly stemSetId: number;
      readonly place: SetlistPlace | null;
      readonly skipped: Skip | null;
    }
  | { readonly kind: typeof ARRIVAL.gaveUp }
  | { readonly kind: typeof ARRIVAL.metronome };

export type Arrival = ArrivalEvent & { readonly serial: number };

export interface ArrivalState {
  readonly arrival: Arrival | null;
}

export const arrivalStore = createStore<ArrivalState>(() => ({
  arrival: null,
}));

export interface AutoAdvanceDeps {
  readonly onSongEnd: (listener: AdvanceListener) => () => void;
  readonly advanceTo: (stemSetId: number) => Promise<AdvanceOutcome>;
  readonly peekNext: () => Promise<SkipResult>;
  readonly commitNext: (
    next: Advance,
    stands: () => boolean,
  ) => Promise<Undo | null>;
  readonly placeOf: (advance: Advance) => SetlistPlace | null;
  readonly candidates: () => number;
  readonly stillEnded: () => boolean;
  readonly stopAdvancing: () => void;
  readonly commitOpen: (
    entry: PresetSetlistEntry,
    stands: () => boolean,
  ) => Promise<boolean>;
  readonly handToMetronome: () => void;
  readonly arrivals: StoreApi<ArrivalState>;
}

type PlayAdvance = Extract<Advance, { readonly kind: typeof ADVANCE.play }>;

function onStageNow() {
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return { stage, cursor: cursorOf(stage, library.loaded) };
}

const defaultDeps: AutoAdvanceDeps = {
  onSongEnd: (listener) => stemPlayerStore.getState().onSongEnd(listener),
  advanceTo: (stemSetId) => stemPlayerStore.getState().advanceTo(stemSetId),
  peekNext: () => playOrderStore.getState().peekNext(),
  commitNext: (next, stands) =>
    playOrderStore.getState().commitNext(next, stands),
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
  commitOpen: (entry, stands) =>
    playOrderStore.getState().commitOpen(entry, stands),
  handToMetronome: () => {
    stemPlayerStore.getState().handToMetronome();
  },
  arrivals: arrivalStore,
};

type Arrive = (arrival: ArrivalEvent) => void;

const PLAYED = { settled: 'settled', tryNext: 'tryNext' } as const;

type Played = (typeof PLAYED)[keyof typeof PLAYED];

async function openMetronome(
  deps: AutoAdvanceDeps,
  arrive: Arrive,
  entry: PresetSetlistEntry,
) {
  if (!(await deps.commitOpen(entry, deps.stillEnded))) return;
  deps.handToMetronome();
  arrive({ kind: ARRIVAL.metronome });
}

async function play(
  deps: AutoAdvanceDeps,
  arrive: Arrive,
  next: PlayAdvance,
  skipped: Skip | null,
): Promise<Played> {
  const undo = await deps.commitNext(next, deps.stillEnded);
  if (undo === null) return PLAYED.settled;
  const { stemSetId } = next;
  const place = deps.placeOf(next);
  arrive({ kind: ARRIVAL.arriving, stemSetId });
  const outcome = await deps.advanceTo(stemSetId);
  if (outcome === ADVANCE_OUTCOME.displaced) await undo();
  if (outcome === ADVANCE_OUTCOME.playing)
    arrive({ kind: ARRIVAL.playing, stemSetId, place, skipped });
  return outcome === ADVANCE_OUTCOME.unplayable
    ? PLAYED.tryNext
    : PLAYED.settled;
}

async function advance(
  deps: AutoAdvanceDeps,
  arrive: Arrive,
  cause: AdvanceCause,
) {
  let skipped: Skip | null = null;
  for (let left = deps.candidates(); left > 0; left--) {
    if (!deps.stillEnded()) return;
    const step = await deps.peekNext();
    if (!deps.stillEnded()) return;
    if (step.skipped) skipped = SKIP.deleted;
    const next = step.advance;
    if (next.kind === ADVANCE.open && cause === ADVANCE_CAUSE.next) {
      await openMetronome(deps, arrive, next.entry);
      return;
    }
    if (next.kind !== ADVANCE.play) break;
    if ((await play(deps, arrive, next, skipped)) === PLAYED.settled) return;
    skipped = SKIP.unopened;
  }
  deps.stopAdvancing();
  if (skipped === SKIP.deleted) arrive({ kind: ARRIVAL.gaveUp });
}

export function startAutoAdvance(deps: AutoAdvanceDeps = defaultDeps) {
  let serial = 0;
  let stepping = false;
  const arrive: Arrive = (arrival) => {
    serial++;
    deps.arrivals.setState({ arrival: { ...arrival, serial } });
  };
  return deps.onSongEnd((cause) => {
    if (stepping) return;
    stepping = true;
    advance(deps, arrive, cause)
      .catch((error: unknown) => {
        console.warn('[kitbag] auto-advance failed', error);
      })
      .finally(() => {
        stepping = false;
      });
  });
}
