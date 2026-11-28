import { describe, expect, it } from 'vitest';

import type { createLibraryStore } from './store.ts';
import { isPresetEntry } from './snapshot.ts';
import { setup } from './store.test-helper.ts';

type Library = ReturnType<typeof createLibraryStore>;

function songsIn(library: Library, setlistId: number) {
  return (library.getState().entries[setlistId] ?? [])
    .filter(isPresetEntry)
    .map((entry) => entry.preset.name);
}

function setNames(library: Library) {
  return library.getState().setlists.map((summary) => summary.setlist.name);
}

async function twoSets() {
  const { library } = setup();
  const s = library.getState();
  const gig = await s.createSetlist('Gig');
  const spare = await s.createSetlist('Spare');
  await s.createSetlist('Last');
  for (const name of ['A', 'B', 'C']) await s.newSongFromCurrent(name, gig);
  const b = library.getState().presets.find((p) => p.name === 'B');
  if (b === undefined) throw new Error('missing B');
  await s.addToSetlist(spare, b.id);
  return { library, gig, spare, b };
}

function entryNamed(library: Library, setlistId: number, name: string) {
  const entry = (library.getState().entries[setlistId] ?? [])
    .filter(isPresetEntry)
    .find((e) => e.preset.name === name);
  if (entry === undefined) throw new Error(`missing ${name}`);
  return entry;
}

describe('library deletes with undo', () => {
  it('Undo puts a deleted setlist back in its place with its songs in order', async () => {
    const { library, gig } = await twoSets();
    await library.getState().deleteSetlist(gig);
    expect(setNames(library)).toEqual(['Spare', 'Last']);
    expect(library.getState().deletion?.kind).toBe('setlist');
    await library.getState().undoDeletion();
    expect(setNames(library)).toEqual(['Gig', 'Spare', 'Last']);
    expect(songsIn(library, gig)).toEqual(['A', 'B', 'C']);
    expect(library.getState().deletion).toBeNull();
  });

  it('Undo puts a removed entry back at its place', async () => {
    const { library, gig } = await twoSets();
    await library
      .getState()
      .removeFromSet(entryNamed(library, gig, 'B').item.id);
    expect(songsIn(library, gig)).toEqual(['A', 'C']);
    await library.getState().undoDeletion();
    expect(songsIn(library, gig)).toEqual(['A', 'B', 'C']);
  });

  it('Undo puts a deleted song back in every setlist it was in', async () => {
    const { library, gig, spare, b } = await twoSets();
    await library.getState().deletePreset(b.id);
    expect(songsIn(library, gig)).toEqual(['A', 'C']);
    expect(songsIn(library, spare)).toEqual([]);
    await library.getState().undoDeletion();
    expect(songsIn(library, gig)).toEqual(['A', 'B', 'C']);
    expect(songsIn(library, spare)).toEqual(['B']);
    expect(library.getState().presets.find((p) => p.id === b.id)).toEqual(b);
  });

  it('restores once when Undo is pressed twice', async () => {
    const { library, gig } = await twoSets();
    await library.getState().deleteSetlist(gig);
    const undo = library.getState().undoDeletion;
    await Promise.all([undo(), undo()]);
    expect(setNames(library)).toEqual(['Gig', 'Spare', 'Last']);
  });

  it('keeps the delete when the snackbar is dismissed', async () => {
    const { library, gig } = await twoSets();
    await library.getState().deleteSetlist(gig);
    library.getState().dismissDeletion();
    await library.getState().undoDeletion();
    expect(setNames(library)).toEqual(['Spare', 'Last']);
  });

  it('offers Undo only for the latest delete', async () => {
    const { library, gig, b } = await twoSets();
    await library.getState().deletePreset(b.id);
    await library.getState().deleteSetlist(gig);
    await library.getState().undoDeletion();
    expect(songsIn(library, gig)).toEqual(['A', 'C']);
    expect(library.getState().presets.some((p) => p.id === b.id)).toBe(false);
  });
});
