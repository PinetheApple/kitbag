import type { PlayQueueEntry } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import {
  ADVANCE,
  advanceOf,
  cursorAt,
  entriesAfter,
  UP_NEXT_SOURCE,
  upNext,
  type OnStage,
} from './order.ts';

const queued = (...stemSetIds: number[]) =>
  stemSetIds.map((stemSetId, position): PlayQueueEntry => ({
    id: 100 + position,
    stemSetId,
    position,
  }));
const stem = (itemId: number, stemSetId: number) =>
  ({
    kind: ENTRY_KIND.stem,
    item: { id: itemId },
    stemSetId,
  }) as unknown as SetlistEntry;
const metronome = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
    preset: { id: itemId, name: `Song ${String(itemId)}` },
  }) as unknown as SetlistEntry;

const SETLIST_ID = 5;
const OTHER_SETLIST_ID = 6;
const setlist = [stem(1, 11), metronome(2), stem(3, 13), stem(4, 11)];
const stage = (entries = setlist, setlistId = SETLIST_ID): OnStage => ({
  setlistId,
  entries,
  skipped: [],
});
const onStageAt = (itemId: number | null, queue = queued()) => ({
  queue,
  stage: stage(),
  cursor: itemId === null ? null : cursorAt(stage(), itemId),
});
const without = (itemId: number) =>
  stage(setlist.filter((entry) => entry.item.id !== itemId));
const skipping = (...skipped: number[]): OnStage => ({ ...stage(), skipped });

describe('up next', () => {
  it('is the first queued song, ahead of the setlist', () => {
    expect(upNext(onStageAt(1, queued(7, 8)))).toEqual({
      source: UP_NEXT_SOURCE.queue,
      stemSetId: 7,
    });
  });

  it('is the setlist entry after the one on stage once the queue is empty', () => {
    expect(upNext(onStageAt(2))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: setlist[2],
    });
  });

  it('is the first setlist entry when none is on stage', () => {
    expect(upNext(onStageAt(null))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: setlist[0],
    });
  });

  it('follows the setlist entry, not the song, so a repeated song moves on', () => {
    expect(upNext(onStageAt(3))).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: setlist[3],
    });
  });

  it('is nothing after the last setlist entry with an empty queue', () => {
    expect(upNext(onStageAt(4))).toBeUndefined();
    expect(
      upNext({ queue: [], stage: stage([]), cursor: null }),
    ).toBeUndefined();
  });
});

describe('up next with entries skipped this time', () => {
  it('passes over a skipped entry to the one after it', () => {
    expect(
      upNext({
        queue: [],
        stage: skipping(3),
        cursor: cursorAt(stage(), 2),
      }),
    ).toEqual({ source: UP_NEXT_SOURCE.setlist, entry: setlist[3] });
  });

  it('is nothing when every entry left is skipped', () => {
    expect(
      upNext({
        queue: [],
        stage: skipping(3, 4),
        cursor: cursorAt(stage(), 2),
      }),
    ).toBeUndefined();
  });
});

describe('up next after the setlist changes', () => {
  it('carries on with the entry that moved up when the one on stage is removed', () => {
    const { cursor } = onStageAt(2);
    expect(upNext({ queue: [], stage: without(2), cursor })).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: setlist[2],
    });
  });

  it('ends when the last entry was on stage and is removed', () => {
    const { cursor } = onStageAt(4);
    expect(upNext({ queue: [], stage: without(4), cursor })).toBeUndefined();
  });

  it('starts another setlist put on stage from its top', () => {
    const { cursor } = onStageAt(3);
    const other = stage([stem(7, 17), stem(8, 18)], OTHER_SETLIST_ID);
    expect(upNext({ queue: [], stage: other, cursor })).toEqual({
      source: UP_NEXT_SOURCE.setlist,
      entry: other.entries[0],
    });
  });
});

describe('advance', () => {
  it('plays a queued stem song', () => {
    expect(advanceOf({ source: UP_NEXT_SOURCE.queue, stemSetId: 7 })).toEqual({
      kind: ADVANCE.play,
      stemSetId: 7,
      setlistItemId: null,
    });
  });

  it('plays a setlist stem song and names its entry', () => {
    expect(
      advanceOf({ source: UP_NEXT_SOURCE.setlist, entry: stem(3, 13) }),
    ).toEqual({ kind: ADVANCE.play, stemSetId: 13, setlistItemId: 3 });
  });

  it('stops at a metronome entry and offers it to open, never playing it', () => {
    const entry = metronome(2);
    expect(advanceOf({ source: UP_NEXT_SOURCE.setlist, entry })).toEqual({
      kind: ADVANCE.open,
      entry,
    });
  });

  it('ends when nothing is up next', () => {
    expect(advanceOf(undefined)).toEqual({ kind: ADVANCE.end });
  });
});

describe('the rest of the setlist', () => {
  it('is every entry after the one on stage', () => {
    expect(entriesAfter(stage(), cursorAt(stage(), 2))).toEqual(
      setlist.slice(2),
    );
  });

  it('is the whole setlist when nothing from it is on stage', () => {
    expect(entriesAfter(stage(), null)).toEqual(setlist);
  });

  it('leaves out the entries skipped this time', () => {
    expect(entriesAfter(skipping(3), cursorAt(stage(), 1))).toEqual([
      setlist[1],
      setlist[3],
    ]);
  });

  it('is nothing after the last entry', () => {
    expect(entriesAfter(stage(), cursorAt(stage(), 4))).toEqual([]);
  });
});
