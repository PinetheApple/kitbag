import type { PlayQueueEntry, QueuedSong } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LoadedSong } from '../library/store.ts';
import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import {
  ADVANCE,
  advanceOf,
  cursorAt,
  entriesAfter,
  UP_NEXT_SOURCE,
  upNext,
  type OnStage,
  type PlayOrder,
} from './order.ts';
import { REPEAT, repeatStore, restartedAt, type RepeatMode } from './repeat.ts';
import { startRepeatWrap } from './repeatWrap.ts';

const SETLIST_ID = 5;
const QUEUED_A = 41;
const QUEUED_B = 42;

const stem = (itemId: number) =>
  ({
    kind: ENTRY_KIND.stem,
    item: { id: itemId },
    stemSetId: itemId,
  }) as unknown as SetlistEntry;
const metronome = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
    preset: { id: itemId },
  }) as unknown as SetlistEntry;
const stems = (id: number): QueuedSong => ({ kind: 'stems', id });
const queueOf = (songs: readonly QueuedSong[]) =>
  songs.map((song, position): PlayQueueEntry => ({
    id: position + 1,
    stemSetId: song.id,
    songId: null,
    position,
  }));

const allStems: OnStage = {
  setlistId: SETLIST_ID,
  entries: [stem(1), stem(2), stem(3)],
  skipped: [],
};
const endsOnMetronome: OnStage = {
  setlistId: SETLIST_ID,
  entries: [stem(1), stem(2), metronome(3)],
  skipped: [],
};
const noSetlist: OnStage = { setlistId: null, entries: [], skipped: [] };
const LOADED: LoadedSong = {
  presetId: null,
  stemSetId: 3,
  itemId: 3,
  setlistId: SETLIST_ID,
  index: 2,
};

afterEach(() => {
  repeatStore.setState({ mode: REPEAT.off, played: [], restart: null });
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(
  stage: OnStage,
  itemId: number | null,
  played: readonly QueuedSong[],
  mode: RepeatMode = REPEAT.all,
) {
  repeatStore.setState({ mode, played, restart: null });
  let queue: readonly QueuedSong[] = [];
  const order = (): PlayOrder => ({
    queue: queueOf(queue),
    stage,
    cursor: itemId === null ? null : cursorAt(stage, itemId),
    restarted: restartedAt(repeatStore.getState(), stage.setlistId, LOADED),
  });
  const requeue = vi.fn((songs: readonly QueuedSong[]) => {
    queue = [...queue, ...songs];
    return Promise.resolve();
  });
  const stop = startRepeatWrap({
    order,
    loaded: () => LOADED,
    requeue,
    subscribe: () => () => undefined,
  });
  return { order, requeue, stop };
}

describe('Repeat all once the queue and the setlist run out', () => {
  it('puts the songs the queue played back in it, in the order they played', async () => {
    const h = harness(noSetlist, null, [stems(QUEUED_A), stems(QUEUED_B)]);
    await settle();
    expect(h.requeue).toHaveBeenCalledWith([stems(QUEUED_A), stems(QUEUED_B)]);
    expect(upNext(h.order())).toEqual({
      source: UP_NEXT_SOURCE.queue,
      song: stems(QUEUED_A),
    });
    expect(repeatStore.getState().played).toEqual([]);
  });

  it('starts the setlist again from song 1 after its last', async () => {
    const h = harness(allStems, 3, []);
    expect(upNext(h.order())).toBeUndefined();
    await settle();
    expect(repeatStore.getState().restart).toEqual({
      setlistId: SETLIST_ID,
      from: LOADED,
    });
    expect(upNext(h.order())).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: allStems.entries[0],
    });
    expect(entriesAfter(allStems, cursorAt(allStems, 3), true)).toEqual(
      allStems.entries,
    );
  });

  it('plays the queued songs again before song 1 comes round', async () => {
    const h = harness(allStems, 3, [stems(QUEUED_A)]);
    await settle();
    expect(h.requeue).toHaveBeenCalledWith([stems(QUEUED_A)]);
    expect(upNext(h.order())).toEqual({
      source: UP_NEXT_SOURCE.queue,
      song: stems(QUEUED_A),
    });
    expect(upNext({ ...h.order(), queue: [] })).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: allStems.entries[0],
    });
  });

  it('leaves the round alone while something is still up next', async () => {
    const h = harness(allStems, 2, [stems(QUEUED_A)]);
    await settle();
    expect(h.requeue).not.toHaveBeenCalled();
    expect(repeatStore.getState().restart).toBeNull();
  });

  it.each([REPEAT.off, REPEAT.one])('does nothing with %s', async (mode) => {
    const h = harness(allStems, 3, [stems(QUEUED_A)], mode);
    await settle();
    expect(h.requeue).not.toHaveBeenCalled();
    expect(upNext(h.order())).toBeUndefined();
  });
});

describe('Repeat all with a setlist that ends on a metronome song', () => {
  it('stops before the metronome song rather than playing it', () => {
    const h = harness(endsOnMetronome, 2, []);
    const next = upNext(h.order());
    expect(next).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: endsOnMetronome.entries[2],
    });
    expect(advanceOf(next).kind).toBe(ADVANCE.open);
  });

  it('does not wrap past it to song 1', async () => {
    const h = harness(endsOnMetronome, 3, [stems(QUEUED_A)]);
    await settle();
    expect(h.requeue).not.toHaveBeenCalled();
    expect(repeatStore.getState().restart).toBeNull();
    expect(upNext(h.order())).toBeUndefined();
  });
});
