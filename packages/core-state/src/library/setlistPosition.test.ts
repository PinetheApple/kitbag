import { describe, expect, it } from 'vitest';

import { adjacentPresetEntry, SONG_STEP } from './setlistPosition.ts';
import { ENTRY_KIND, type SetlistEntry } from './snapshot.ts';

const entry = (itemId: number) =>
  ({
    kind: ENTRY_KIND.preset,
    item: { id: itemId },
  }) as unknown as SetlistEntry;
const stem = (itemId: number) =>
  ({ kind: ENTRY_KIND.stem, item: { id: itemId } }) as unknown as SetlistEntry;
const entries = [entry(10), entry(11), entry(12)];

describe('adjacentPresetEntry', () => {
  it('steps to the song either side', () => {
    expect(adjacentPresetEntry(entries, 11, SONG_STEP.previous)).toBe(
      entries[0],
    );
    expect(adjacentPresetEntry(entries, 11, SONG_STEP.next)).toBe(entries[2]);
  });

  it('has no previous song before the first', () => {
    expect(
      adjacentPresetEntry(entries, 10, SONG_STEP.previous),
    ).toBeUndefined();
  });

  it('has no next song after the last', () => {
    expect(adjacentPresetEntry(entries, 12, SONG_STEP.next)).toBeUndefined();
  });

  it('starts from the first song when none from the set is loaded', () => {
    expect(adjacentPresetEntry(entries, null, SONG_STEP.next)).toBe(entries[0]);
    expect(
      adjacentPresetEntry(entries, 99, SONG_STEP.previous),
    ).toBeUndefined();
  });

  it('steps over stem songs, which the metronome cannot play', () => {
    const mixed = [stem(9), entry(10), stem(20), stem(21), entry(11)];
    expect(adjacentPresetEntry(mixed, 10, SONG_STEP.next)).toBe(mixed[4]);
    expect(adjacentPresetEntry(mixed, 11, SONG_STEP.previous)).toBe(mixed[1]);
    expect(adjacentPresetEntry(mixed, null, SONG_STEP.next)).toBe(mixed[1]);
    expect(adjacentPresetEntry(mixed, 10, SONG_STEP.previous)).toBeUndefined();
  });
});
