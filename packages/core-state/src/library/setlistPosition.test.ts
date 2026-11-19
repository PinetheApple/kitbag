import { describe, expect, it } from 'vitest';

import { adjacentEntry, SONG_STEP } from './setlistPosition.ts';
import { ENTRY_KIND, type SetlistEntry } from './snapshot.ts';

const entry = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
  }) as unknown as SetlistEntry;
const stem = (itemId: number) =>
  ({ kind: ENTRY_KIND.stem, item: { id: itemId } }) as unknown as SetlistEntry;
const entries = [entry(10), entry(11), entry(12)];

describe('adjacentEntry', () => {
  it('steps to the song either side', () => {
    expect(adjacentEntry(entries, 11, SONG_STEP.previous)).toBe(entries[0]);
    expect(adjacentEntry(entries, 11, SONG_STEP.next)).toBe(entries[2]);
  });

  it('has no previous song before the first', () => {
    expect(adjacentEntry(entries, 10, SONG_STEP.previous)).toBeUndefined();
  });

  it('has no next song after the last', () => {
    expect(adjacentEntry(entries, 12, SONG_STEP.next)).toBeUndefined();
  });

  it('starts from the first song when none from the set is loaded', () => {
    expect(adjacentEntry(entries, null, SONG_STEP.next)).toBe(entries[0]);
    expect(adjacentEntry(entries, 99, SONG_STEP.previous)).toBeUndefined();
  });

  it('steps across stem songs and metronome songs alike', () => {
    const mixed = [stem(9), entry(10), stem(20), stem(21), entry(11)];
    expect(adjacentEntry(mixed, 10, SONG_STEP.next)).toBe(mixed[2]);
    expect(adjacentEntry(mixed, 20, SONG_STEP.next)).toBe(mixed[3]);
    expect(adjacentEntry(mixed, 11, SONG_STEP.previous)).toBe(mixed[3]);
    expect(adjacentEntry(mixed, null, SONG_STEP.next)).toBe(mixed[0]);
    expect(adjacentEntry(mixed, 9, SONG_STEP.previous)).toBeUndefined();
  });
});
