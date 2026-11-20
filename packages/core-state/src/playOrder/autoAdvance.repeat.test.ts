import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import { startAutoAdvance, type ArrivalState } from './autoAdvance.ts';
import { NO_BACK, restingPlayer } from './autoAdvance.test-helper.ts';
import { ADVANCE } from './order.ts';
import { REPEAT, type RepeatMode } from './repeat.ts';
import type { SkipResult } from './store.ts';

const NIGHT_BUS = 21;

const nextSong: SkipResult = {
  advance: { kind: ADVANCE.stems, stemSetId: NIGHT_BUS, setlistItemId: null },
  skipped: null,
};

const stops: (() => void)[] = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => {
    stop();
  });
});

function harness(mode: RepeatMode, loopHeld = false) {
  let leave: AdvanceListener = () => undefined;
  const advanceTo = vi.fn<(id: number) => Promise<AdvanceOutcome>>(() =>
    Promise.resolve(ADVANCE_OUTCOME.playing),
  );
  const stems = {
    ...restingPlayer(),
    onSongEnd: (listener: AdvanceListener) => {
      leave = listener;
      return () => undefined;
    },
    loopHeld: vi.fn(() => loopHeld),
    advanceTo,
  };
  const peekNext = vi.fn(() => Promise.resolve(nextSong));
  stops.push(
    startAutoAdvance({
      players: { stems, song: restingPlayer() },
      peekNext,
      commitNext: () => Promise.resolve(() => Promise.resolve()),
      placeOf: () => null,
      candidates: () => 1,
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
  return { stems, peekNext, advanceTo, happens };
}

describe('Repeat one at the end of a song', () => {
  it('plays the same song again from the start', async () => {
    const h = harness(REPEAT.one);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.stems.replay).toHaveBeenCalledTimes(1);
    expect(h.peekNext).not.toHaveBeenCalled();
    expect(h.advanceTo).not.toHaveBeenCalled();
  });

  it('lets an A-B loop win: nothing restarts and nothing advances', async () => {
    const h = harness(REPEAT.one, true);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.stems.replay).not.toHaveBeenCalled();
    expect(h.peekNext).not.toHaveBeenCalled();
    expect(h.advanceTo).not.toHaveBeenCalled();
  });

  it('still moves to the next entry on a Next press', async () => {
    const h = harness(REPEAT.one);
    await h.happens(ADVANCE_CAUSE.nextInApp);
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.stems.replay).not.toHaveBeenCalled();
  });
});

describe('Repeat off and Repeat all at the end of a song', () => {
  it.each([REPEAT.off, REPEAT.all])(
    'with %s, plays what is up next rather than the same song',
    async (mode) => {
      const h = harness(mode);
      await h.happens(ADVANCE_CAUSE.ended);
      expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
      expect(h.stems.replay).not.toHaveBeenCalled();
    },
  );
});
