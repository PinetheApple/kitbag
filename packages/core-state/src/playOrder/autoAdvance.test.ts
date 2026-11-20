import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import {
  ARRIVAL,
  startAutoAdvance,
  type Arrival,
  type ArrivalState,
  type AutoAdvanceDeps,
} from './autoAdvance.ts';
import { restingPlayer } from './autoAdvance.test-helper.ts';
import { ADVANCE, type Advance } from './order.ts';
import { SKIP } from './queuedSongText.ts';
import type { SkipResult, Undo } from './store.ts';

const NIGHT_BUS = 21;
const TIN_ROOF = 22;
const HUM = 41;
const ITEM = 31;
const PLACE = { number: 3, of: 5 };

const play = (
  stemSetId: number,
  setlistItemId: number | null = ITEM,
): SkipResult => ({
  advance: { kind: ADVANCE.stems, stemSetId, setlistItemId },
  skipped: null,
});
const single = (songId: number): SkipResult => ({
  advance: { kind: ADVANCE.song, songId },
  skipped: null,
});
const BALLAD_COUNT = {} as never;
const metronomeNext: SkipResult = {
  advance: { kind: ADVANCE.open, entry: BALLAD_COUNT },
  skipped: null,
};
const end: SkipResult = { advance: { kind: ADVANCE.end }, skipped: null };

function harness(
  steps: readonly SkipResult[],
  outcomes: readonly AdvanceOutcome[] = [],
  candidates = steps.length,
  stillEnded: () => boolean = () => true,
) {
  let leave: AdvanceListener = () => undefined;
  const unsubscribe = vi.fn();
  const peekNext = vi.fn<AutoAdvanceDeps['peekNext']>();
  for (const step of steps) peekNext.mockResolvedValueOnce(step);
  peekNext.mockResolvedValue(end);
  const undo = vi.fn(() => Promise.resolve());
  const commitNext = vi.fn<AutoAdvanceDeps['commitNext']>(() =>
    Promise.resolve(undo),
  );
  const advanceTo = vi.fn<(id: number) => Promise<AdvanceOutcome>>();
  for (const outcome of outcomes) advanceTo.mockResolvedValueOnce(outcome);
  advanceTo.mockResolvedValue(ADVANCE_OUTCOME.playing);
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const seen: Arrival[] = [];
  arrivals.subscribe(({ arrival }) => {
    if (arrival !== null) seen.push(arrival);
  });
  const stopAdvancing = vi.fn();
  const commitOpen = vi.fn<AutoAdvanceDeps['commitOpen']>(() =>
    Promise.resolve(true),
  );
  const handToMetronome = vi.fn();
  const stems = {
    ...restingPlayer(),
    onSongEnd: (listener: AdvanceListener) => {
      leave = listener;
      return unsubscribe;
    },
    advanceTo,
    stillEnded,
    stopAdvancing,
    handToMetronome,
  };
  const single = restingPlayer();
  const stop = startAutoAdvance({
    players: { stems, song: single },
    peekNext,
    commitNext,
    placeOf: (advance: Advance) =>
      advance.kind === ADVANCE.stems && advance.setlistItemId !== null
        ? PLACE
        : null,
    candidates: () => candidates,
    commitOpen,
    arrivals,
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const songEnds = async () => {
    leave(ADVANCE_CAUSE.ended);
    await settle();
  };
  const pressNext = async () => {
    leave(ADVANCE_CAUSE.next);
    await settle();
  };
  return {
    stems,
    single,
    songEnds,
    peekNext,
    commitNext,
    undo,
    advanceTo,
    arrivals,
    seen,
    stop,
    unsubscribe,
    stopAdvancing,
    commitOpen,
    handToMetronome,
    leave: (cause: AdvanceCause) => {
      leave(cause);
    },
    settle,
    pressNext,
  };
}

describe('auto-advance at the end of a stem song', () => {
  it('plays the next stem song and says where it sits in the set', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await h.songEnds();
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      song: { kind: 'stems', id: NIGHT_BUS },
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
    expect(h.seen[0]).toMatchObject({ song: { kind: 'stems', id: NIGHT_BUS } });
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
    h.commitNext.mockResolvedValueOnce(null);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.stopAdvancing).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
  });

  it('keeps the committed step and tries no other when the next song opens stopped', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF)],
      [ADVANCE_OUTCOME.stopped],
    );
    await h.songEnds();
    expect(h.commitNext).toHaveBeenCalledTimes(1);
    expect(h.advanceTo).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS);
    expect(h.stopAdvancing).not.toHaveBeenCalled();
    expect(h.seen.map((arrival) => arrival.kind)).toEqual([ARRIVAL.arriving]);
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
      song: { kind: 'stems', id: NIGHT_BUS },
      place: null,
    });
  });

  it('stays stopped when a metronome song is next', async () => {
    const h = harness([metronomeNext]);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.commitNext).not.toHaveBeenCalled();
    expect(h.commitOpen).not.toHaveBeenCalled();
    expect(h.handToMetronome).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toBeNull();
  });

  it('stops silently after the last song', async () => {
    const h = harness([end]);
    await h.songEnds();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toBeNull();
  });

  it('says it skipped a deleted song on the way', async () => {
    const h = harness([{ ...play(NIGHT_BUS), skipped: 'stems' }]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      song: { kind: 'stems', id: NIGHT_BUS },
      skipped: { reason: SKIP.deleted, kind: 'stems' },
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
      song: { kind: 'stems', id: TIN_ROOF },
      skipped: { reason: SKIP.unopened, kind: 'stems' },
    });
  });

  it('says nothing when it gives up after a song that would not open', async () => {
    const h = harness(
      [play(NIGHT_BUS), metronomeNext],
      [ADVANCE_OUTCOME.unplayable],
    );
    await h.songEnds();
    expect(h.seen).toEqual([
      expect.objectContaining({
        kind: ARRIVAL.arriving,
        song: { kind: 'stems', id: NIGHT_BUS },
      }),
    ]);
    expect(h.stopAdvancing).toHaveBeenCalledTimes(1);
  });

  it('says it skipped a deleted song when nothing after it plays', async () => {
    const h = harness([{ ...end, skipped: 'song' }]);
    await h.songEnds();
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.gaveUp,
      skipped: { reason: SKIP.deleted, kind: 'song' },
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

  it('undoes the commit once another song took the player', async () => {
    const h = harness([play(NIGHT_BUS)], [ADVANCE_OUTCOME.displaced]);
    await h.songEnds();
    expect(h.undo).toHaveBeenCalledTimes(1);
  });

  it('keeps the commit of a song that played or would not open', async () => {
    const h = harness(
      [play(NIGHT_BUS), play(TIN_ROOF)],
      [ADVANCE_OUTCOME.unplayable],
    );
    await h.songEnds();
    expect(h.undo).not.toHaveBeenCalled();
  });

  it('stops listening when stopped', () => {
    const h = harness([]);
    h.stop();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('Next from the song card', () => {
  it('takes the same look, commit and load as the end of a song', async () => {
    const stillEnded = vi.fn(() => true);
    const h = harness([play(NIGHT_BUS)], [], 1, stillEnded);
    await h.pressNext();
    expect(h.commitNext).toHaveBeenCalledWith(
      play(NIGHT_BUS).advance,
      stillEnded,
    );
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.peekNext.mock.invocationCallOrder[0]).toBeLessThan(
      h.commitNext.mock.invocationCallOrder[0] ?? 0,
    );
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      song: { kind: 'stems', id: NIGHT_BUS },
      place: PLACE,
    });
  });

  it('commits the metronome song it looked at, then hands the card over', async () => {
    const stillEnded = vi.fn(() => true);
    const h = harness([metronomeNext], [], 1, stillEnded);
    await h.pressNext();
    expect(h.commitOpen).toHaveBeenCalledWith(BALLAD_COUNT);
    expect(h.peekNext.mock.invocationCallOrder[0]).toBeLessThan(
      h.commitOpen.mock.invocationCallOrder[0] ?? 0,
    );
    expect(h.handToMetronome).toHaveBeenCalledTimes(1);
    expect(h.handToMetronome.mock.invocationCallOrder[0]).toBeGreaterThan(
      h.commitOpen.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(h.commitNext).not.toHaveBeenCalled();
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.stopAdvancing).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.metronome,
    });
  });

  it('keeps the stem song when the metronome song does not load', async () => {
    const h = harness([metronomeNext]);
    h.commitOpen.mockResolvedValueOnce(false);
    await h.pressNext();
    expect(h.handToMetronome).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toBeNull();
  });

  it('opens nothing when a press lands during the look-ahead', async () => {
    const stillEnded = vi.fn(() => false).mockReturnValueOnce(true);
    const h = harness([metronomeNext], [], 1, stillEnded);
    await h.pressNext();
    expect(h.commitOpen).not.toHaveBeenCalled();
    expect(h.handToMetronome).not.toHaveBeenCalled();
  });

  it('ignores a second Next while the first is still committing', async () => {
    const h = harness([play(NIGHT_BUS), play(TIN_ROOF)]);
    let release: (undo: Undo | null) => void = () => undefined;
    h.commitNext.mockImplementationOnce(
      () =>
        new Promise<Undo | null>((resolve) => {
          release = resolve;
        }),
    );
    h.leave(ADVANCE_CAUSE.next);
    await h.settle();
    await h.pressNext();
    expect(h.peekNext).toHaveBeenCalledTimes(1);
    release(h.undo);
    await h.settle();
    expect(h.advanceTo.mock.calls).toEqual([[NIGHT_BUS]]);
  });

  it('ignores the end of the song while a Next is still committing', async () => {
    const h = harness([play(NIGHT_BUS), play(TIN_ROOF)]);
    let release: (undo: Undo | null) => void = () => undefined;
    h.commitNext.mockImplementationOnce(
      () =>
        new Promise<Undo | null>((resolve) => {
          release = resolve;
        }),
    );
    await h.pressNext();
    await h.songEnds();
    release(h.undo);
    await h.settle();
    expect(h.peekNext).toHaveBeenCalledTimes(1);
    expect(h.advanceTo.mock.calls).toEqual([[NIGHT_BUS]]);
  });

  it('takes a later Next once the first has landed', async () => {
    const h = harness([play(NIGHT_BUS), play(TIN_ROOF)]);
    await h.pressNext();
    await h.pressNext();
    expect(h.advanceTo.mock.calls).toEqual([[NIGHT_BUS], [TIN_ROOF]]);
  });
});

describe('Next from the player', () => {
  const pressInApp = async (h: ReturnType<typeof harness>) => {
    h.leave(ADVANCE_CAUSE.nextInApp);
    await h.settle();
  };

  it('plays the next song like the card, marked as pressed in the app', async () => {
    const h = harness([play(NIGHT_BUS)]);
    await pressInApp(h);
    expect(h.advanceTo).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      inApp: true,
    });
  });

  it('leaves the arrival of the card and of a song end unmarked', async () => {
    const card = harness([play(NIGHT_BUS)]);
    await card.pressNext();
    expect(card.arrivals.getState().arrival).toMatchObject({ inApp: false });
    const ended = harness([play(NIGHT_BUS)]);
    await ended.songEnds();
    expect(ended.arrivals.getState().arrival).toMatchObject({ inApp: false });
  });

  it('opens a metronome song stopped, as the card does', async () => {
    const h = harness([metronomeNext]);
    await pressInApp(h);
    expect(h.commitOpen).toHaveBeenCalledOnce();
    expect(h.handToMetronome).toHaveBeenCalledOnce();
  });

  it('drops a second press while the first is still committing', async () => {
    const h = harness([play(NIGHT_BUS), play(TIN_ROOF)]);
    let release: (undo: Undo | null) => void = () => undefined;
    h.commitNext.mockImplementationOnce(
      () =>
        new Promise<Undo | null>((resolve) => {
          release = resolve;
        }),
    );
    await pressInApp(h);
    await pressInApp(h);
    expect(h.peekNext).toHaveBeenCalledTimes(1);
    release(h.undo);
    await h.settle();
    expect(h.advanceTo.mock.calls).toEqual([[NIGHT_BUS]]);
  });
});

describe('a queue that mixes single songs and stem songs', () => {
  const fromSingle = async (
    h: ReturnType<typeof harness>,
    cause: AdvanceCause,
  ) => {
    const [listener] = vi.mocked(h.single.onSongEnd).mock.calls[0] ?? [];
    listener?.(cause);
    await h.settle();
  };
  const singleEnds = (h: ReturnType<typeof harness>) =>
    fromSingle(h, ADVANCE_CAUSE.ended);
  const singleNext = (h: ReturnType<typeof harness>) =>
    fromSingle(h, ADVANCE_CAUSE.next);

  it('hands a stem song over to a single song, then back to a stem song', async () => {
    const h = harness([single(HUM), play(TIN_ROOF, null)]);
    await h.songEnds();
    expect(h.stems.handOver).toHaveBeenCalledTimes(1);
    expect(h.single.takeOver).toHaveBeenCalledExactlyOnceWith(HUM);
    expect(
      vi.mocked(h.stems.handOver).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(h.single.takeOver).mock.invocationCallOrder[0] ?? 0,
    );
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      song: { kind: 'song', id: HUM },
    });
    await singleEnds(h);
    expect(h.commitNext).toHaveBeenLastCalledWith(
      play(TIN_ROOF, null).advance,
      h.single.stillEnded,
    );
    expect(h.single.handOver).toHaveBeenCalledTimes(1);
    expect(h.stems.takeOver).toHaveBeenCalledExactlyOnceWith(TIN_ROOF);
    expect(h.advanceTo).not.toHaveBeenCalled();
    expect(h.arrivals.getState().arrival).toMatchObject({
      kind: ARRIVAL.playing,
      song: { kind: 'stems', id: TIN_ROOF },
    });
  });

  it('hands nothing over once the stem song no longer stands', async () => {
    const stillEnded = vi
      .fn(() => false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const h = harness([single(HUM)], [], 1, stillEnded);
    await h.songEnds();
    expect(h.stems.handOver).not.toHaveBeenCalled();
    expect(h.single.takeOver).not.toHaveBeenCalled();
    expect(h.undo).toHaveBeenCalledTimes(1);
  });

  it('goes on from the single song player when the single song will not open', async () => {
    const h = harness([single(HUM), play(NIGHT_BUS, null)]);
    vi.mocked(h.single.takeOver).mockResolvedValueOnce(
      ADVANCE_OUTCOME.unplayable,
    );
    await h.songEnds();
    expect(h.single.handOver).toHaveBeenCalledTimes(1);
    expect(h.stems.takeOver).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS);
    expect(h.arrivals.getState().arrival).toMatchObject({
      song: { kind: 'stems', id: NIGHT_BUS },
      skipped: { reason: SKIP.unopened, kind: 'song' },
    });
  });

  it('lets the single song player give up when nothing after it opens', async () => {
    const h = harness([single(HUM)]);
    vi.mocked(h.single.takeOver).mockResolvedValueOnce(
      ADVANCE_OUTCOME.unplayable,
    );
    await h.songEnds();
    expect(h.single.stopAdvancing).toHaveBeenCalledTimes(1);
    expect(h.stopAdvancing).not.toHaveBeenCalled();
  });

  it('ignores a stale card press while the other player is still loading', async () => {
    const h = harness([single(HUM), play(TIN_ROOF, null)]);
    const loading = Promise.withResolvers<AdvanceOutcome>();
    vi.mocked(h.single.takeOver).mockReturnValueOnce(loading.promise);
    h.leave(ADVANCE_CAUSE.ended);
    await h.settle();
    h.leave(ADVANCE_CAUSE.next);
    await singleNext(h);
    loading.resolve(ADVANCE_OUTCOME.playing);
    await h.settle();
    expect(h.peekNext).toHaveBeenCalledOnce();
    expect(h.single.takeOver).toHaveBeenCalledOnce();
    expect(h.stems.takeOver).not.toHaveBeenCalled();
  });
});
