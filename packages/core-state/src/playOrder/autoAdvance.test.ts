import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import {
  ARRIVAL,
  SKIP,
  startAutoAdvance,
  type Arrival,
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
  stillEnded: () => boolean = () => true,
) {
  let ended: () => void = () => undefined;
  const unsubscribe = vi.fn();
  const peekNext = vi.fn<AutoAdvanceDeps['peekNext']>();
  for (const step of steps) peekNext.mockResolvedValueOnce(step);
  peekNext.mockResolvedValue(end);
  const commitNext = vi.fn<AutoAdvanceDeps['commitNext']>(() =>
    Promise.resolve(true),
  );
  const advanceTo = vi.fn<AutoAdvanceDeps['advanceTo']>();
  for (const outcome of outcomes) advanceTo.mockResolvedValueOnce(outcome);
  advanceTo.mockResolvedValue(ADVANCE_OUTCOME.playing);
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const seen: Arrival[] = [];
  arrivals.subscribe(({ arrival }) => {
    if (arrival !== null) seen.push(arrival);
  });
  const stopAdvancing = vi.fn();
  const stop = startAutoAdvance({
    onSongEnd: (listener) => {
      ended = listener;
      return unsubscribe;
    },
    advanceTo,
    peekNext,
    commitNext,
    placeOf: (advance: Advance) =>
      advance.kind === ADVANCE.play && advance.setlistItemId !== null
        ? PLACE
        : null,
    candidates: () => candidates,
    stillEnded,
    stopAdvancing,
    arrivals,
  });
  const songEnds = async () => {
    ended();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return {
    songEnds,
    peekNext,
    commitNext,
    advanceTo,
    arrivals,
    seen,
    stop,
    unsubscribe,
    stopAdvancing,
  };
}

describe('auto-advance at the end of a stem song', () => {
  it('plays the next stem song and says where it sits in the set', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await h.songEnds();
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      stemSetId: NIGHT_BUS,
      place: PLACE,
      skipped: null,
    });
    expect(h.stopAdvancing).not.toHaveBeenCalled();
  });

  it('names the song to follow before it plays', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await h.songEnds();
    expect(h.seen.map((arrival) => arrival.kind)).toEqual([
      ARRIVAL.arriving,
      ARRIVAL.playing,
    ]);
    expect(h.seen[0]).toMatchObject({ stemSetId: NIGHT_BUS });
  });

  it('commits the step it looked at before following it', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await h.songEnds();
    expect(h.commitNext).toHaveBeenCalledWith(
      play(NIGHT_BUS).advance,
      expect.any(Function),
    );
    expect(h.commitNext.mock.invocationCallOrder[0]).toBeLessThan(
      h.advanceTo.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves the order and the route alone when a press lands during the look-ahead', async () => {
    const stillEnded = vi.fn(() => false).mockReturnValueOnce(true);
    const h = harness([play(NIGHT_BUS)], [], 1, stillEnded);
    await h.songEnds();
    expect(h.peekNext).toHaveBeenCalledTimes(1);
    expect(h.commitNext).not.toHaveBeenCalled();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
  });

  it('commits only while the end still stands', async () => {
    const stillEnded = vi.fn(() => true);
    const h = harness([play(NIGHT_BUS)], [], 1, stillEnded);
    await h.songEnds();
    expect(h.commitNext).toHaveBeenCalledWith(
      play(NIGHT_BUS).advance,
      stillEnded,
    );
  });

  it('follows nothing once a press during the commit undid it', async () => {
    const h = harness([play(NIGHT_BUS)]);
    h.commitNext.mockResolvedValueOnce(false);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.stopAdvancing).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
  });

  it('touches neither the queue nor the setlist once the end no longer stands', async () => {
    const h = harness([play(NIGHT_BUS)], [], 1, () => false);
    await h.songEnds();
    expect(h.peekNext).not.toHaveBeenCalled();
    expect(h.commitNext).not.toHaveBeenCalled();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
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
    expect(h.commitNext).not.toHaveBeenCalled();
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

  it('says nothing when it gives up after a song that would not open', async () => {
    const h = harness(
      [play(NIGHT_BUS), metronomeNext],
      [ADVANCE_OUTCOME.unplayable],
    );
    await h.songEnds();
    expect(h.seen).toEqual([
      expect.objectContaining({ kind: ARRIVAL.arriving, stemSetId: NIGHT_BUS }),
    ]);
    expect(h.stopAdvancing).toHaveBeenCalledTimes(1);
  });

  it('says it skipped a deleted song when nothing after it plays', async () => {
    const h = harness([{ ...end, skipped: true }]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.gaveUp,
    });
  });

  it('gives up once every song it could reach failed', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF), play(NIGHT_BUS)],
      [ADVANCE_OUTCOME.unplayable, ADVANCE_OUTCOME.unplayable],
      2,
    );
    await h.songEnds();
    expect(h.peekNext).toHaveBeenCalledTimes(2);
  });

  it('takes no further step once another song took the player', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF)],
      [ADVANCE_OUTCOME.displaced],
    );
    await h.songEnds();
    expect(h.peekNext).toHaveBeenCalledTimes(1);
    expect(h.advanceTo).toHaveBeenCalledTimes(1);
    expect(h.stopAdvancing).not.toHaveBeenCalled();
  });

  it('stops listening when stopped', () => {
    const h = harness([]);
    h.stop();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
