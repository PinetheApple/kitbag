import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  ADVANCE_CAUSE,
  type AdvanceCause,
  type AdvanceListener,
} from '../stemPlayer/songEnd.ts';
import { startAutoAdvance, type ArrivalState } from './autoAdvance.ts';
import { NO_BACK, restingPlayer } from './autoAdvance.test-helper.ts';
import { ADVANCE, type PlayerKind } from './order.ts';
import { REPEAT, type RepeatMode } from './repeat.ts';
import type { PresetSetlistEntry } from '../library/snapshot.ts';
import type { SkipResult } from './store.ts';

const TIN_ROOF = 22;
const ENDS_IN_A_ROW = 3;
const KINDS: readonly PlayerKind[] = ['stems', 'song'];

const nothingNext: SkipResult = {
  advance: { kind: ADVANCE.end },
  skipped: null,
};
const metronomeNext: SkipResult = {
  advance: {
    kind: ADVANCE.open,
    entry: { item: { id: 3 } } as unknown as PresetSetlistEntry,
  },
  skipped: null,
};
const queuedNext = (kind: PlayerKind): SkipResult => ({
  advance:
    kind === 'song'
      ? { kind: ADVANCE.song, songId: TIN_ROOF }
      : { kind: ADVANCE.stems, stemSetId: TIN_ROOF, setlistItemId: null },
  skipped: null,
});

const stops: (() => void)[] = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => {
    stop();
  });
});

interface Setup {
  readonly kind: PlayerKind;
  readonly mode: RepeatMode;
  readonly next?: SkipResult;
  readonly candidates?: number;
  readonly loopHeld?: boolean;
}

function harness({
  kind,
  mode,
  next = nothingNext,
  candidates = 1,
  loopHeld = false,
}: Setup) {
  let leave: AdvanceListener = () => undefined;
  const ending = {
    ...restingPlayer(),
    onSongEnd: (listener: AdvanceListener) => {
      leave = listener;
      return () => undefined;
    },
    loopHeld: vi.fn(() => loopHeld),
  };
  const players =
    kind === 'stems'
      ? { stems: ending, song: restingPlayer() }
      : { stems: restingPlayer(), song: ending };
  stops.push(
    startAutoAdvance({
      players,
      peekNext: () => Promise.resolve(next),
      commitNext: () => Promise.resolve(() => Promise.resolve()),
      placeOf: () => null,
      candidates: () => candidates,
      commitOpen: () => Promise.resolve(false),
      arrivals: createStore<ArrivalState>(() => ({ arrival: null })),
      ...NO_BACK,
      repeat: () => mode,
    }),
  );
  const happens = async (cause: AdvanceCause) => {
    leave(cause);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { ending, players, happens };
}

describe.each(KINDS)('Repeat all with nothing up next, %s player', (kind) => {
  it('plays the song again when it ends', async () => {
    const h = harness({ kind, mode: REPEAT.all });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('plays it again with no queue, setlist or played songs at all', async () => {
    const h = harness({ kind, mode: REPEAT.all, candidates: 0 });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('keeps playing it again at every end', async () => {
    const h = harness({ kind, mode: REPEAT.all, candidates: 0 });
    for (let end = 0; end < ENDS_IN_A_ROW; end++)
      await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(ENDS_IN_A_ROW);
  });

  it('lets an A-B loop win', async () => {
    const h = harness({ kind, mode: REPEAT.all, loopHeld: true });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
  });

  it('still plays a queued song next rather than this one', async () => {
    const h = harness({ kind, mode: REPEAT.all, next: queuedNext(kind) });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('stops before a metronome song up next', async () => {
    const h = harness({ kind, mode: REPEAT.all, next: metronomeNext });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).toHaveBeenCalledTimes(1);
  });

  it('does not restart the song on a Next press', async () => {
    const h = harness({ kind, mode: REPEAT.all });
    await h.happens(ADVANCE_CAUSE.next);
    expect(h.ending.replay).not.toHaveBeenCalled();
  });

  it('stops with Repeat off', async () => {
    const h = harness({ kind, mode: REPEAT.off });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).toHaveBeenCalledTimes(1);
  });
});
