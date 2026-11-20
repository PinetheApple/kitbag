import type { PlayQueueEntry } from '@kitbag/core-db';
import type { SongTransportOrder } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { ENTRY_KIND, type SetlistEntry } from '../library/snapshot.ts';
import { cardOrderOf, startCardOrder } from './cardOrder.ts';
import { cursorAt, type OnStage, type PlayOrder } from './order.ts';

const SETLIST_ID = 5;
const QUEUED_SET_ID = 21;
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
const gig: OnStage = {
  setlistId: SETLIST_ID,
  entries: [stem(1), metronome(2), stem(3)],
  skipped: [],
};
const alone: OnStage = { setlistId: null, entries: [], skipped: [] };
const queued: PlayQueueEntry[] = [
  { id: 1, stemSetId: QUEUED_SET_ID, songId: null, position: 0 },
];
const at = (itemId: number): PlayOrder => ({
  queue: [],
  stage: gig,
  cursor: cursorAt(gig, itemId),
});

const UP_NEXT: SongTransportOrder = { previous: true, next: true };
const LAST: SongTransportOrder = { previous: true, next: false };
const ALONE: SongTransportOrder = { previous: false, next: false };

describe('the play order the song card shows', () => {
  it('has Next while a setlist entry follows, a metronome song included', () => {
    expect(cardOrderOf(at(1), false)).toEqual(UP_NEXT);
    expect(cardOrderOf(at(2), false)).toEqual(UP_NEXT);
  });

  it('has Next while a song is queued, with no setlist', () => {
    expect(
      cardOrderOf({ queue: queued, stage: alone, cursor: null }, false),
    ).toEqual(UP_NEXT);
  });

  it('keeps Previous and drops Next at the last entry', () => {
    expect(cardOrderOf(at(3), false)).toEqual(LAST);
  });

  it('keeps Previous for a song on its own once an earlier song was heard', () => {
    expect(
      cardOrderOf({ queue: [], stage: alone, cursor: null }, true),
    ).toEqual(LAST);
  });

  it('has neither for a song on its own', () => {
    expect(
      cardOrderOf({ queue: [], stage: alone, cursor: null }, false),
    ).toEqual(ALONE);
  });
});

describe('sending the play order to the card', () => {
  function harness(first: PlayOrder) {
    let order = first;
    let changed: () => void = () => undefined;
    const send = vi.fn<(order: SongTransportOrder) => void>();
    startCardOrder({
      order: () => order,
      back: () => false,
      subscribe: (listener) => {
        changed = listener;
        return () => undefined;
      },
      send,
    });
    const change = (next: PlayOrder) => {
      order = next;
      changed();
    };
    return { send, change };
  }

  it('sends the order at once', () => {
    const { send } = harness(at(1));
    expect(send.mock.calls).toEqual([[UP_NEXT]]);
  });

  it('sends again only when what the card shows changes', () => {
    const { send, change } = harness(at(1));
    change(at(2));
    expect(send).toHaveBeenCalledTimes(1);
    change(at(3));
    expect(send).toHaveBeenLastCalledWith(LAST);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
