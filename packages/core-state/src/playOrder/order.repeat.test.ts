import type { PlayQueueEntry, QueuedSong } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import {
  ADVANCE,
  advanceOf,
  cursorAt,
  UP_NEXT_SOURCE,
  upcoming,
  upNext,
  wrapOf,
  type OnStage,
  type PlayOrder,
  type RepeatRound,
} from './order.ts';

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
const queueOf = (...ids: number[]) =>
  ids.map((stemSetId, position): PlayQueueEntry => ({
    id: position + 1,
    stemSetId,
    songId: null,
    position,
  }));

const allStems: OnStage = {
  setlistId: SETLIST_ID,
  entries: [stem(1), stem(2), stem(3)],
  skipped: [],
};
const endsOnMetronome: OnStage = {
  ...allStems,
  entries: [stem(1), stem(2), metronome(3)],
};
const noSetlist: OnStage = { setlistId: null, entries: [], skipped: [] };

const ALL: RepeatRound = { all: true, played: [], restarted: false };
const played = (...songs: QueuedSong[]): RepeatRound => ({
  ...ALL,
  played: songs,
});

function orderAt(
  stage: OnStage,
  itemId: number | null,
  round: RepeatRound,
  queue: PlayQueueEntry[] = [],
): PlayOrder {
  return {
    queue,
    stage,
    cursor: itemId === null ? null : cursorAt(stage, itemId),
    round,
  };
}

describe('when the round wraps under Repeat all', () => {
  it('never wraps with Repeat all off', () => {
    const order = orderAt(allStems, 3, {
      ...played(stems(QUEUED_A)),
      all: false,
    });
    expect(wrapOf(order)).toBeNull();
    expect(upNext(order)).toBeUndefined();
  });

  it('waits while a queued song or a setlist entry is still ahead', () => {
    expect(wrapOf(orderAt(allStems, 2, ALL))).toBeNull();
    expect(wrapOf(orderAt(allStems, 3, ALL, queueOf(QUEUED_A)))).toBeNull();
  });

  it('does not wrap again once the setlist has started again, with song 1 ahead', () => {
    expect(
      wrapOf(orderAt(allStems, 3, { ...ALL, restarted: true })),
    ).toBeNull();
  });

  it('does not wrap a setlist that ends on a metronome song', () => {
    expect(
      wrapOf(orderAt(endsOnMetronome, 3, played(stems(QUEUED_A)))),
    ).toBeNull();
  });

  it('wraps past a last metronome song skipped this time', () => {
    const skipped = { ...endsOnMetronome, skipped: [3] };
    expect(wrapOf(orderAt(skipped, 2, ALL))).toEqual({
      songs: [],
      restartsSetlist: true,
    });
  });

  it('has nothing to wrap with no setlist and no song played from the queue', () => {
    expect(wrapOf(orderAt(noSetlist, null, ALL))).toBeNull();
  });

  it('brings back the songs the queue played, with no setlist', () => {
    expect(
      wrapOf(
        orderAt(noSetlist, null, played(stems(QUEUED_A), stems(QUEUED_B))),
      ),
    ).toEqual({
      songs: [stems(QUEUED_A), stems(QUEUED_B)],
      restartsSetlist: false,
    });
  });
});

describe('up next across the wrap', () => {
  it('is song 1, not a replay, when every entry left is skipped this time', () => {
    const restSkipped = { ...allStems, skipped: [3] };
    expect(upNext(orderAt(restSkipped, 2, ALL))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: allStems.entries[0],
    });
  });

  it('is the first song played from the queue, then song 1', () => {
    const order = orderAt(
      allStems,
      3,
      played(stems(QUEUED_A), stems(QUEUED_B)),
    );
    expect(upNext(order)).toEqual({
      source: UP_NEXT_SOURCE.queue,
      song: stems(QUEUED_A),
    });
    expect(upcoming(order)).toEqual({
      pending: [stems(QUEUED_A), stems(QUEUED_B)],
      setlist: allStems.entries,
    });
  });

  it('is song 1 when the queue played nothing', () => {
    expect(upNext(orderAt(allStems, 3, ALL))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: allStems.entries[0],
    });
  });

  it('stops before a last metronome song rather than wrapping', () => {
    const next = upNext(orderAt(endsOnMetronome, 2, played(stems(QUEUED_A))));
    expect(next).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: endsOnMetronome.entries[2],
    });
    expect(advanceOf(next).kind).toBe(ADVANCE.open);
  });

  it('is the next song in setlist order after Previous from the last entry', () => {
    expect(upNext(orderAt(allStems, 2, played(stems(QUEUED_A))))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: allStems.entries[2],
    });
  });
});
