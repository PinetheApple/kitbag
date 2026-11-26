import { vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import {
  startAutoAdvance,
  type AdvancingPlayer,
  type Arrival,
  type ArrivalState,
  type AutoAdvanceDeps,
} from './autoAdvance.ts';
import { ADVANCE, type PlayerKind } from './order.ts';
import type { RepeatMode } from './repeat.ts';
import type { SkipResult } from './store.ts';

export function restingPlayer(): AdvancingPlayer {
  return {
    onSongEnd: vi.fn(() => () => undefined),
    onPrevious: vi.fn(() => () => undefined),
    playedSeconds: vi.fn(() => 0),
    restart: vi.fn(),
    replay: vi.fn(),
    loopHeld: vi.fn(() => false),
    takeOver: vi.fn(() => Promise.resolve(ADVANCE_OUTCOME.playing)),
    paused: { takeOver: vi.fn(() => Promise.resolve(ADVANCE_OUTCOME.paused)) },
    handOver: vi.fn(),
    stillEnded: vi.fn(() => true),
    stopAdvancing: vi.fn(),
    handToMetronome: vi.fn(),
  };
}

export const NO_BACK: Pick<AutoAdvanceDeps, 'back'> = {
  back: {
    from: () => null,
    open: () => Promise.resolve(null),
    settle: () => Promise.resolve(),
    forget: () => undefined,
  },
};

export const BALLAD_COUNT = {} as never;
export const metronomeNext: SkipResult = {
  advance: { kind: ADVANCE.open, entry: BALLAD_COUNT },
  skipped: null,
};
export const end: SkipResult = {
  advance: { kind: ADVANCE.end },
  skipped: null,
};

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export interface EndingSetup {
  readonly mode: RepeatMode;
  readonly kind?: PlayerKind;
  readonly steps?: readonly SkipResult[];
  readonly outcomes?: readonly AdvanceOutcome[];
  readonly candidates?: number;
  readonly loopHeld?: boolean;
}

const running: (() => void)[] = [];

export function stopEndingHarnesses(): void {
  running.splice(0).forEach((stop) => {
    stop();
  });
}

export function endingHarness({
  mode,
  kind = 'stems',
  steps = [],
  outcomes = [],
  candidates = Math.max(steps.length, 1),
  loopHeld = false,
}: EndingSetup) {
  let leave: AdvanceListener = () => undefined;
  const peekNext = vi.fn<AutoAdvanceDeps['peekNext']>();
  for (const step of steps) peekNext.mockResolvedValueOnce(step);
  peekNext.mockResolvedValue(end);
  const opens = vi.fn<(id: number) => Promise<AdvanceOutcome>>();
  for (const outcome of outcomes) opens.mockResolvedValueOnce(outcome);
  opens.mockResolvedValue(ADVANCE_OUTCOME.playing);
  const wired = (own: PlayerKind, player: AdvancingPlayer): AdvancingPlayer =>
    own !== kind
      ? player
      : {
          ...player,
          onSongEnd: (listener) => {
            leave = listener;
            return () => undefined;
          },
          loopHeld: () => loopHeld,
        };
  const players = {
    stems: wired('stems', {
      ...restingPlayer(),
      advanceTo: opens,
      takeOver: opens,
    }),
    song: wired('song', { ...restingPlayer(), takeOver: opens }),
  };
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const seen: Arrival[] = [];
  arrivals.subscribe(({ arrival }) => {
    if (arrival !== null) seen.push(arrival);
  });
  const notePlayed = vi.fn();
  running.push(
    startAutoAdvance({
      players,
      peekNext,
      commitNext: () => Promise.resolve(() => Promise.resolve()),
      placeOf: () => null,
      candidates: () => candidates,
      commitOpen: () => Promise.resolve(false),
      arrivals,
      ...NO_BACK,
      repeat: () => mode,
      notePlayed,
    }),
  );
  const happens = async (cause: AdvanceCause) => {
    leave(cause);
    await settle();
  };
  return {
    players,
    ending: players[kind],
    peekNext,
    opens,
    notePlayed,
    seen,
    happens,
  };
}
