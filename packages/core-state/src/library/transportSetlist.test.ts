import { describe, expect, it } from 'vitest';

import type { SetlistEntry, SetlistSummary } from './snapshot.ts';
import type { LoadedSong } from './store.ts';
import { transportSetlistOf } from './transportSetlist.ts';

const SETLIST_ID = 7;
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
  it('is null with no song loaded', () => {
    expect(transportSetlistOf(library(null))).toBeNull();
  });

  it('is null for a song loaded outside a setlist', () => {
    const loaded = { presetId: 200, itemId: null, setlistId: null };
    expect(transportSetlistOf(library(loaded))).toBeNull();
  });

  it('places a song mid-setlist', () => {
    expect(transportSetlistOf(library(loadedAt(1)))).toEqual({
      setlistName: 'Wedding set',
      songTitle: 'Blackbird',
      index: 1,
      songCount: 3,
    });
  });

  it('places the first and the last song', () => {
    expect(transportSetlistOf(library(loadedAt(0)))?.index).toBe(0);
    expect(transportSetlistOf(library(loadedAt(2)))).toMatchObject({
      songTitle: 'Encore',
      index: 2,
      songCount: 3,
    });
  });

  it('is null once the item is no longer in the setlist', () => {
    const removed = { ...loadedAt(1), itemId: 999 };
    expect(transportSetlistOf(library(removed))).toBeNull();
  });

  it('is null once the setlist is gone', () => {
    const state = { ...library(loadedAt(1)), setlists: [] };
    expect(transportSetlistOf(state)).toBeNull();
  });
});
