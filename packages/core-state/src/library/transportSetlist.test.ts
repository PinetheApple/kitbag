import { describe, expect, it } from 'vitest';

import type { ActiveSet } from './activeSet.ts';
import type { SetlistEntry, SetlistSummary } from './snapshot.ts';
import type { LoadedSong } from './store.ts';
import { transportSetlistOf } from './transportSetlist.ts';

const SETLIST_ID = 7;
const subtitleOf = (set: ActiveSet, song: string | undefined) =>
  `${set.name}|${song ?? 'none'}`;
const titles = ['Intro', 'Blackbird', 'Encore'];
const entries: SetlistEntry[] = titles.map(
  (name, index) =>
    ({
      item: { id: 100 + index },
      preset: { id: 200 + index, name },
    }) as unknown as SetlistEntry,
);
const summary = {
  setlist: { id: SETLIST_ID, name: 'Wedding set', active: true },
  songCount: entries.length,
} as unknown as SetlistSummary;

const library = (loaded: LoadedSong | null) => ({
  loaded,
  setlists: [summary],
  entries: { [SETLIST_ID]: entries },
});
const loadedAt = (index: number): LoadedSong => ({
  presetId: 200 + index,
  itemId: 100 + index,
  setlistId: SETLIST_ID,
});

describe('transportSetlistOf', () => {
  it('with no song loaded, has no current song to name', () => {
    expect(transportSetlistOf(subtitleOf, library(null))).toEqual({
      subtitle: 'Wedding set|none',
      index: null,
      songCount: 3,
    });
  });

  it('is null for a song loaded outside a setlist', () => {
    const loaded = { presetId: 200, itemId: null, setlistId: null };
    expect(transportSetlistOf(subtitleOf, library(loaded))).toBeNull();
  });

  it('places a song mid-setlist and names it for the subtitle', () => {
    expect(transportSetlistOf(subtitleOf, library(loadedAt(1)))).toEqual({
      subtitle: 'Wedding set|Blackbird',
      index: 1,
      songCount: 3,
    });
  });

  it('places the first and the last song', () => {
    expect(transportSetlistOf(subtitleOf, library(loadedAt(0)))).toMatchObject({
      subtitle: 'Wedding set|Intro',
      index: 0,
    });
    expect(transportSetlistOf(subtitleOf, library(loadedAt(2)))).toEqual({
      subtitle: 'Wedding set|Encore',
      index: 2,
      songCount: 3,
    });
  });

  it('treats a song removed from the set as no current song', () => {
    const removed = { ...loadedAt(1), itemId: 999 };
    expect(transportSetlistOf(subtitleOf, library(removed))).toMatchObject({
      subtitle: 'Wedding set|none',
      index: null,
    });
  });

  it('is null once the setlist is gone', () => {
    const state = { ...library(loadedAt(1)), setlists: [] };
    expect(transportSetlistOf(subtitleOf, state)).toBeNull();
  });

  it('is null when the loaded song is not in the active setlist', () => {
    const inactive = {
      ...summary,
      setlist: { ...summary.setlist, active: false },
    };
    const other = {
      ...summary,
      setlist: { ...summary.setlist, id: SETLIST_ID + 1 },
    };
    const state = { ...library(loadedAt(1)), setlists: [other, inactive] };
    expect(transportSetlistOf(subtitleOf, state)).toBeNull();
  });
});
