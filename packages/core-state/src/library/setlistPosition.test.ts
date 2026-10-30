import { describe, expect, it } from 'vitest';

import { adjacentEntry, SONG_STEP } from './setlistPosition.ts';
import type { SetlistEntry } from './snapshot.ts';

const entry = (itemId: number) =>
  ({ item: { id: itemId } }) as unknown as SetlistEntry;
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
});
