import { describe, expect, it } from 'vitest';

import { isLoadedSongUnsaved } from './presetMapping.ts';
import { SONG_STEP } from './setlistPosition.ts';
import { loadedPresetOf } from './store.ts';
import { setup } from './store.test-helper.ts';

const SAVED_BPM = 100;
const NEXT_BPM = 130;
const EDITED_BPM = 150;

async function gig() {
  const fixture = setup();
  const { library, metronome } = fixture;
  const s = library.getState();
  const setlistId = await s.createSetlist('Gig');
  metronome.getState().setTempo(SAVED_BPM);
  const first = await s.newSongFromCurrent('Opener', setlistId);
  metronome.getState().setTempo(NEXT_BPM);
  const second = await s.newSongFromCurrent('Ballad', setlistId);
  await s.newSongFromCurrent('Shuffle', setlistId);
  const [opener] = library.getState().entries[setlistId] ?? [];
  if (opener === undefined) throw new Error('missing opener');
  await s.loadSong(first, opener.item.id, setlistId);
  const edited = () => {
    const preset = loadedPresetOf(library.getState());
    return (
      preset !== undefined && isLoadedSongUnsaved(preset, metronome.getState())
    );
  };
  return { ...fixture, setlistId, first, second, opener, edited };
}

function savedBpm(
  library: ReturnType<typeof setup>['library'],
  presetId: number,
) {
  return library.getState().presets.find((p) => p.id === presetId)?.bpm;
}

describe('saving and reverting the loaded song', () => {
  it('saves the live settings into a song loaded from a setlist', async () => {
    const { library, metronome, first, edited } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    metronome.getState().setSubdivision(2);
    await library.getState().saveLoadedSong();
    expect(savedBpm(library, first)).toBe(EDITED_BPM);
    expect(edited()).toBe(false);
  });

  it('saves the live settings into a song loaded on its own', async () => {
    const { library, metronome, second, edited } = await gig();
    await library.getState().loadSong(second);
    expect(library.getState().loaded?.itemId).toBeNull();
    metronome.getState().setTempo(EDITED_BPM);
    await library.getState().saveLoadedSong();
    expect(savedBpm(library, second)).toBe(EDITED_BPM);
    expect(edited()).toBe(false);
  });

  it('reverts to the saved song and keeps it loaded', async () => {
    const { library, metronome, opener, edited } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    metronome.getState().setSubdivision(2);
    library.getState().revertLoadedSong();
    expect(metronome.getState().bpm).toBe(SAVED_BPM);
    expect(metronome.getState().subdivision).toBe(1);
    expect(library.getState().loaded?.itemId).toBe(opener.item.id);
    expect(edited()).toBe(false);
    expect(library.getState().discarded).toBeNull();
  });
});

describe('discarding unsaved changes', () => {
  it('steps on, discards the changes and undo brings them back', async () => {
    const { library, metronome, first, opener, setlistId, edited } =
      await gig();
    metronome.getState().setTempo(EDITED_BPM);
    metronome.getState().setSubdivision(2);
    await library.getState().stepSong(SONG_STEP.next);
    expect(metronome.getState().bpm).toBe(NEXT_BPM);
    expect(metronome.getState().subdivision).toBe(1);
    expect(library.getState().discarded?.loaded).toEqual({
      presetId: first,
      itemId: opener.item.id,
      setlistId,
    });
    await library.getState().undoDiscard();
    expect(library.getState().loaded).toEqual({
      presetId: first,
      itemId: opener.item.id,
      setlistId,
    });
    expect(metronome.getState().bpm).toBe(EDITED_BPM);
    expect(metronome.getState().subdivision).toBe(2);
    expect(edited()).toBe(true);
    expect(library.getState().discarded).toBeNull();
    expect(savedBpm(library, first)).toBe(SAVED_BPM);
  });

  it('leaves no snapshot when the song had no unsaved changes', async () => {
    const { library } = await gig();
    await library.getState().stepSong(SONG_STEP.next);
    expect(library.getState().discarded).toBeNull();
  });

  it('keeps the snapshot through a clean step, so undo still works', async () => {
    const { library, metronome, first, second } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    await library.getState().stepSong(SONG_STEP.next);
    await library.getState().stepSong(SONG_STEP.next);
    expect(library.getState().loaded?.presetId).not.toBe(second);
    expect(library.getState().discarded?.loaded.presetId).toBe(first);
    await library.getState().undoDiscard();
    expect(library.getState().loaded?.presetId).toBe(first);
    expect(metronome.getState().bpm).toBe(EDITED_BPM);
  });

  it('replaces the snapshot when a later step discards changes too', async () => {
    const { library, metronome, second } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    await library.getState().stepSong(SONG_STEP.next);
    metronome.getState().setTempo(EDITED_BPM + 1);
    await library.getState().stepSong(SONG_STEP.previous);
    expect(library.getState().discarded?.loaded.presetId).toBe(second);
  });

  it('snapshots on Leave setlist and undo rejoins the setlist', async () => {
    const { library, metronome, setlistId } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    await library.getState().leaveSetlist();
    expect(library.getState().loaded).toBeNull();
    expect(metronome.getState().bpm).toBe(EDITED_BPM);
    expect(library.getState().discarded).not.toBeNull();
    await library.getState().undoDiscard();
    expect(library.getState().loaded?.setlistId).toBe(setlistId);
    const active = library.getState().setlists.find((s) => s.setlist.active);
    expect(active?.setlist.id).toBe(setlistId);
  });

  it('snapshots on Clear song and on loading another song', async () => {
    const { library, metronome, first, second } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    library.getState().clearSong();
    expect(library.getState().discarded).not.toBeNull();
    await library.getState().undoDiscard();
    metronome.getState().setTempo(EDITED_BPM + 1);
    await library.getState().loadSong(second);
    expect(library.getState().discarded?.loaded.presetId).toBe(first);
  });

  it('forgets the snapshot when dismissed', async () => {
    const { library, metronome } = await gig();
    metronome.getState().setTempo(EDITED_BPM);
    await library.getState().stepSong(SONG_STEP.next);
    library.getState().dismissDiscarded();
    expect(library.getState().discarded).toBeNull();
  });
});
