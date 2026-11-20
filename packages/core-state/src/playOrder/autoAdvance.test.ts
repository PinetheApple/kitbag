import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import {
  SKIP,
  startAutoAdvance,
  type ArrivalState,
  type AutoAdvanceDeps,
} from './autoAdvance.ts';
import { ADVANCE, type Advance } from './order.ts';
import type { SkipResult } from './store.ts';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;
const ITEM = 31;
const PLACE = { number: 3, of: 5 };

const play = (stemSetId: number, setlistItemId: number | null = ITEM) => ({
  advance: { kind: ADVANCE.play, stemSetId, setlistItemId },
  skipped: false,
});
const metronomeNext: SkipResult = {
  advance: { kind: ADVANCE.open, entry: {} as never },
  skipped: false,
};
const end: SkipResult = { advance: { kind: ADVANCE.end }, skipped: false };

function harness(
  steps: readonly SkipResult[],
  outcomes: readonly AdvanceOutcome[] = [],
  candidates = steps.length,
) {
  let ended: () => void = () => undefined;
  const unsubscribe = vi.fn();
  const skipToNext = vi.fn<AutoAdvanceDeps['skipToNext']>();
  for (const step of steps) skipToNext.mockResolvedValueOnce(step);
  skipToNext.mockResolvedValue(end);
  const advanceTo = vi.fn<AutoAdvanceDeps['advanceTo']>();
  for (const outcome of outcomes) advanceTo.mockResolvedValueOnce(outcome);
  advanceTo.mockResolvedValue(ADVANCE_OUTCOME.playing);
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const stop = startAutoAdvance({
    onSongEnd: (listener) => {
      ended = listener;
      return unsubscribe;
    },
    advanceTo,
    skipToNext,
    placeOf: (advance: Advance) =>
      advance.kind === ADVANCE.play && advance.setlistItemId !== null
        ? PLACE
        : null,
    candidates: () => candidates,
    arrivals,
  });
  const songEnds = async () => {
    ended();
    await vi.waitFor(() => {
      expect(skipToNext).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { songEnds, skipToNext, advanceTo, arrivals, stop, unsubscribe };
}

describe('auto-advance at the end of a stem song', () => {
  it('plays the next stem song and says where it sits in the set', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await h.songEnds();
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.arrivals.getState().arrival).toMatchObject({
      stemSetId: NIGHT_BUS,
      place: PLACE,
      skipped: null,
    });
  });

  it('names no place for a queued song', async () => {
    const h = harness([play(NIGHT_BUS, null)]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      stemSetId: NIGHT_BUS,
      place: null,
    });
  });

  it('stays stopped when a metronome song is next', async () => {
    const h = harness([metronomeNext]);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toBeNull();
  });

  it('stops silently after the last song', async () => {
    const h = harness([end]);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toBeNull();
  });

  it('says it skipped a deleted song on the way', async () => {
    const h = harness([{ ...play(NIGHT_BUS), skipped: true }]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      stemSetId: NIGHT_BUS,
      skipped: SKIP.deleted,
    });
  });

  it('tries the next song when one will not open', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF)],
      [ADVANCE_OUTCOME.unplayable],
    );
    await h.songEnds();
    expect(h.advanceTo.mock.calls).toEqual([[NIGHT_BUS], [TIN_ROOF]]);
    expect(h.arrivals.getState().arrival).toMatchObject({
      stemSetId: TIN_ROOF,
      skipped: SKIP.unopened,
    });
  });

  it('says it skipped when nothing after an unopened song plays', async () => {
    const h = harness([play(NIGHT_BUS), end], [ADVANCE_OUTCOME.unplayable]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      stemSetId: null,
      skipped: SKIP.unopened,
    });
  });

  it('gives up once every song it could reach failed', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF), play(NIGHT_BUS)],
      [ADVANCE_OUTCOME.unplayable, ADVANCE_OUTCOME.unplayable],
      2,
    );
    await h.songEnds();
    expect(h.skipToNext).toHaveBeenCalledTimes(2);
  });

  it('leaves the order alone once another song took the player', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF)],
      [ADVANCE_OUTCOME.displaced],
    );
    await h.songEnds();
    expect(h.skipToNext).toHaveBeenCalledTimes(1);
  });

  it('stops listening when stopped', () => {
    const h = harness([]);
    h.stop();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
