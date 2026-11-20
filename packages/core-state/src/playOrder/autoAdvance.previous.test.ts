import type { QueuedSong } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import type { PreviousListener } from '../stemPlayer/previousPresses.ts';
import {
  ARRIVAL,
  startAutoAdvance,
  type Arrival,
  type ArrivalState,
  type AutoAdvanceDeps,
} from './autoAdvance.ts';
import { restingPlayer } from './autoAdvance.test-helper.ts';
import type { PlayerKind } from './order.ts';
import {
  BACK,
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  type Back,
} from './previous.ts';

const NIGHT_BUS: QueuedSong = { kind: 'stems', id: 21 };
const HUM: QueuedSong = { kind: 'song', id: 41 };
const BALLAD = {
  kind: ENTRY_KIND.preset,
  item: { id: 3 },
  preset: { id: 3 },
} as unknown as SetlistEntry;
const PLACE = { number: 1, of: 3 };

const toNightBus: Back = {
  kind: BACK.song,
  song: NIGHT_BUS,
  left: HUM,
  requeue: HUM,
};
const toBallad: Back = {
  kind: BACK.setlist,
  entry: BALLAD,
  left: NIGHT_BUS,
  requeue: null,
};

function harness(back: Back | null, playedSeconds: number) {
  const pressed: Record<PlayerKind, PreviousListener> = {
    stems: () => undefined,
    song: () => undefined,
  };
  const player = (kind: PlayerKind) => ({
    ...restingPlayer(),
    onPrevious: (listener: PreviousListener) => {
      pressed[kind] = listener;
      return () => undefined;
    },
    playedSeconds: () => playedSeconds,
  });
  const stems = player('stems');
  const single = player('song');
  const arrivals = createStore<ArrivalState>(() => ({ arrival: null }));
  const seen: Arrival[] = [];
  arrivals.subscribe(({ arrival }) => {
    if (arrival !== null) seen.push(arrival);
  });
  const backOf = vi.fn<AutoAdvanceDeps['backOf']>(() => back);
  const commitBack = vi.fn<AutoAdvanceDeps['commitBack']>(() =>
    Promise.resolve(),
  );
  const commitOpen = vi.fn<AutoAdvanceDeps['commitOpen']>(() =>
    Promise.resolve(true),
  );
  startAutoAdvance({
    players: { stems, song: single },
    peekNext: vi.fn(),
    commitNext: vi.fn(),
    placeOf: () => PLACE,
    candidates: () => 0,
    commitOpen,
    arrivals,
    backOf,
    commitBack,
  });
  const press = async (kind: PlayerKind, inApp = true) => {
    pressed[kind](inApp);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { stems, single, seen, backOf, commitBack, commitOpen, press };
}

const PAST = PREVIOUS_RESTARTS_AFTER_SECONDS + 0.5;
const WITHIN = PREVIOUS_RESTARTS_AFTER_SECONDS - 0.5;

describe('Previous', () => {
  it('restarts the song once it is past the threshold, whatever came before', async () => {
    const h = harness(toNightBus, PAST);
    await h.press('song');
    expect(h.single.restart).toHaveBeenCalledOnce();
    expect(h.commitBack).not.toHaveBeenCalled();
    expect(h.stems.takeOver).not.toHaveBeenCalled();
  });

  it('goes back an entry within the threshold', async () => {
    const h = harness(toNightBus, WITHIN);
    await h.press('song');
    expect(h.single.restart).not.toHaveBeenCalled();
    expect(h.commitBack).toHaveBeenCalledExactlyOnceWith(toNightBus);
  });

  it('hands a single song back to the stem song heard before it', async () => {
    const h = harness(toNightBus, WITHIN);
    await h.press('song');
    expect(h.single.handOver).toHaveBeenCalledOnce();
    expect(h.stems.takeOver).toHaveBeenCalledExactlyOnceWith(NIGHT_BUS.id);
    expect(h.commitBack.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(h.single.handOver).mock.invocationCallOrder[0] ?? 0,
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
    const h = harness(null, WITHIN);
    await h.press('stems');
    expect(h.stems.restart).toHaveBeenCalledOnce();
    expect(h.commitBack).not.toHaveBeenCalled();
  });

  it('loads a metronome song before it on the Metronome, stopped', async () => {
    const h = harness(toBallad, WITHIN);
    await h.press('stems');
    expect(h.commitOpen).toHaveBeenCalledOnce();
    expect(h.commitOpen.mock.calls[0]?.[0]).toBe(BALLAD);
    expect(h.stems.handToMetronome).toHaveBeenCalledOnce();
    expect(h.seen).toMatchObject([{ kind: ARRIVAL.metronome }]);
  });
});
