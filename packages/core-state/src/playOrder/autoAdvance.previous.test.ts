import type { QueuedSong } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import type { PreviousListener } from '../stemPlayer/cardPresses.ts';
import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import {
  ARRIVAL,
  startAutoAdvance,
  type Arrival,
  type ArrivalState,
  type BackDeps,
} from './autoAdvance.ts';
import { restingPlayer } from './autoAdvance.test-helper.ts';
import type { HeardSong } from './heard.ts';
import { HUM, NIGHT_BUS, plain, TIN_ROOF } from './heard.test-helper.ts';
import { cursorAt, type OnStage, type PlayerKind } from './order.ts';
import {
  BACK,
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  type BackFrom,
} from './previous.ts';

const SETLIST_ID = 5;
const PLACE = { number: 1, of: 2 };
const entry = (kind: string, itemId: number, id: number) =>
  ({
    kind,
    item: { id: itemId },
    stemSetId: id,
    preset: { id },
  }) as unknown as SetlistEntry;
const BALLAD = entry(ENTRY_KIND.preset, 3, 3);
const stageOf = (...entries: SetlistEntry[]): OnStage => ({
  setlistId: SETLIST_ID,
  entries,
  skipped: [],
});
const alone: OnStage = { setlistId: null, entries: [], skipped: [] };
const fromGig = (song: QueuedSong, itemId: number): HeardSong => ({
  song,
  setlistItemId: itemId,
});

const afterHum = (heard: readonly HeardSong[]): BackFrom => ({
  heard,
  current: plain(HUM),
  stage: alone,
  cursor: null,
});
const toNightBus = afterHum([plain(NIGHT_BUS), plain(HUM)]);
const firstInGig = (before: SetlistEntry): BackFrom => {
  const stage = stageOf(before, entry(ENTRY_KIND.stem, 4, NIGHT_BUS.id));
  return {
    heard: [fromGig(NIGHT_BUS, 4)],
    current: fromGig(NIGHT_BUS, 4),
    stage,
    cursor: cursorAt(stage, 4),
  };
};

function harness(
  start: BackFrom | null,
  playedSeconds: number,
  outcomes: readonly AdvanceOutcome[] = [],
) {
  const pressed: Record<PlayerKind, PreviousListener> = {
    stems: () => undefined,
    song: () => undefined,
  };
  const player = (kind: PlayerKind) => {
    const takeOver = vi.fn<(id: number) => Promise<AdvanceOutcome>>();
    for (const outcome of outcomes) takeOver.mockResolvedValueOnce(outcome);
    takeOver.mockResolvedValue(ADVANCE_OUTCOME.playing);
    return {
      ...restingPlayer(),
      takeOver,
      onPrevious: (listener: PreviousListener) => {
        pressed[kind] = listener;
        return () => undefined;
      },
      playedSeconds: () => playedSeconds,
    };
  };
  const stems = player('stems');
  const single = player('song');
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const seen: Arrival[] = [];
  arrivals.subscribe(({ arrival }) => {
    if (arrival !== null) seen.push(arrival);
  });
  const undo = vi.fn(() => Promise.resolve());
  const back = {
    from: vi.fn(() => start),
    open: vi.fn<BackDeps['open']>(() => Promise.resolve(undo)),
    settle: vi.fn<BackDeps['settle']>(() => Promise.resolve()),
    forget: vi.fn<BackDeps['forget']>(),
  };
  const commitOpen = vi.fn(() => Promise.resolve(true));
  startAutoAdvance({
    players: { stems, song: single },
    peekNext: vi.fn(),
    commitNext: vi.fn(),
    placeOf: () => PLACE,
    candidates: () => 0,
    commitOpen,
    arrivals,
    back,
  });
  const press = async (kind: PlayerKind, inApp = true) => {
    pressed[kind](inApp);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { stems, single, seen, back, undo, commitOpen, press };
}

const PAST = PREVIOUS_RESTARTS_AFTER_SECONDS + 0.5;
const WITHIN = PREVIOUS_RESTARTS_AFTER_SECONDS - 0.5;

describe('Previous', () => {
  it('restarts the song once it is past the threshold, whatever came before', async () => {
    const h = harness(toNightBus, PAST);
    await h.press('song');
    expect(h.single.restart).toHaveBeenCalledOnce();
    expect(h.back.open).not.toHaveBeenCalled();
    expect(h.stems.takeOver).not.toHaveBeenCalled();
  });

  it('goes back an entry within the threshold', async () => {
    const h = harness(toNightBus, WITHIN);
    await h.press('song');
    expect(h.single.restart).not.toHaveBeenCalled();
    expect(h.back.open).toHaveBeenCalledOnce();
  });

  it('hands a single song back to the stem song heard before it, settling the history and queue once it plays', async () => {
    const h = harness(toNightBus, WITHIN);
    await h.press('song');
    expect(h.single.handOver).toHaveBeenCalledOnce();
    expect(h.stems.takeOver).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS.id);
    expect(h.back.settle).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: BACK.song, song: NIGHT_BUS }),
      toNightBus,
    );
    expect(h.stems.takeOver.mock.invocationCallOrder[0]).toBeLessThan(
      h.back.settle.mock.invocationCallOrder[0] ?? 0,
    );
    expect(h.seen).toMatchObject([
      { kind: ARRIVAL.arriving, song: NIGHT_BUS },
      { kind: ARRIVAL.playing, song: NIGHT_BUS, place: null, inApp: true },
    ]);
  });

  it('says what plays when the press came from the card', async () => {
    const h = harness(toNightBus, WITHIN);
    await h.press('song', false);
    expect(h.seen.at(-1)).toMatchObject({ inApp: false });
  });

  it('restarts the song when there is nothing to go back to', async () => {
    const h = harness(afterHum([plain(HUM)]), WITHIN);
    await h.press('song');
    expect(h.single.restart).toHaveBeenCalledOnce();
    expect(h.back.open).not.toHaveBeenCalled();
  });

  it('loads a metronome song before it on the Metronome, stopped', async () => {
    const start = firstInGig(BALLAD);
    const h = harness(start, WITHIN);
    await h.press('stems');
    expect(h.commitOpen).toHaveBeenCalledExactlyOnceWith(BALLAD);
    expect(h.stems.handToMetronome).toHaveBeenCalledOnce();
    expect(h.back.settle).toHaveBeenCalledOnce();
    expect(h.seen).toMatchObject([{ kind: ARRIVAL.metronome }]);
  });
});

describe('Previous onto a song that will not play', () => {
  it('forgets the dead song and goes on back to the one before it', async () => {
    const start = afterHum([plain(TIN_ROOF), plain(NIGHT_BUS), plain(HUM)]);
    const h = harness(start, WITHIN, [ADVANCE_OUTCOME.unplayable]);
    await h.press('song');
    expect(h.back.forget).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS);
    expect(h.stems.takeOver.mock.calls).toEqual([
      [NIGHT_BUS.id],
      [TIN_ROOF.id],
    ]);
    expect(h.back.settle).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ song: TIN_ROOF }),
      afterHum([plain(TIN_ROOF), plain(HUM)]),
    );
    expect(h.seen.at(-1)).toMatchObject({
      kind: ARRIVAL.playing,
      song: TIN_ROOF,
    });
  });

  it('gives up with nothing left to try, settling the player and saying so', async () => {
    const h = harness(toNightBus, WITHIN, [ADVANCE_OUTCOME.unplayable]);
    await h.press('song');
    expect(h.back.forget).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS);
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.back.settle).not.toHaveBeenCalled();
    expect(h.stems.stopAdvancing).toHaveBeenCalledOnce();
    expect(h.seen.at(-1)).toMatchObject({
      kind: ARRIVAL.gaveUp,
      skipped: { kind: 'stems' },
    });
  });

  it('undoes the step and leaves history and queue alone when another song displaces it', async () => {
    const h = harness(toNightBus, WITHIN, [ADVANCE_OUTCOME.displaced]);
    await h.press('song');
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.back.settle).not.toHaveBeenCalled();
    expect(h.back.forget).not.toHaveBeenCalled();
    expect(h.stems.stopAdvancing).not.toHaveBeenCalled();
  });

  it('plays nothing when the setlist entry before will not open', async () => {
    const start = firstInGig(entry(ENTRY_KIND.stem, 2, TIN_ROOF.id));
    const h = harness(start, WITHIN);
    h.back.open.mockResolvedValueOnce(null);
    await h.press('stems');
    expect(h.stems.takeOver).not.toHaveBeenCalled();
    expect(h.back.settle).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
  });
});
