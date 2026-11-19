import { presetFieldsOfLogged } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { applyPreset, isLoadedSongUnsaved } from '../library/presetMapping.ts';
import { SONG_STEP } from '../library/setlistPosition.ts';
import { loadedBaselineOf } from '../library/store.ts';
import { SESSION_LOAD, repeatPlanOf } from './repeat.ts';
import { gig } from './repeat.test-helper.ts';
import { createRepeatOverlay } from './repeatOverlay.ts';

const BPMS = [70, 80, 90] as const;

async function repeating() {
  const g = await gig();
  const overlay = createRepeatOverlay({
    library: g.library,
    metronome: g.metronome,
    applySettings: (settings) => {
      applyPreset(presetFieldsOfLogged(settings), () => g.metronome.getState());
    },
  });
  const bpm = () => g.metronome.getState().bpm;
  const start = async () => {
    const plan = repeatPlanOf(g.log(BPMS), g.library.getState());
    if (plan === null) throw new Error('no plan');
    await overlay.start(plan);
  };
  const unsaved = () => {
    const baseline = loadedBaselineOf(g.library.getState());
    return (
      baseline !== undefined &&
      isLoadedSongUnsaved(baseline, g.metronome.getState())
    );
  };
  return { ...g, overlay, bpm, start, unsaved };
}

describe('Repeat through the library store', () => {
  it('applies the logged settings on loadSong and on stepSong', async () => {
    const r = await repeating();
    await r.start();
    expect(r.bpm()).toBe(80);
    await r.library.getState().stepSong(SONG_STEP.next);
    expect(r.bpm()).toBe(70);
  });

  it('loads a planned song on its own with its saved settings', async () => {
    const r = await repeating();
    await r.start();
    await r.library.getState().loadSong(r.second.id);
    expect(r.bpm()).toBe(r.second.bpm);
    expect(r.overlay.state.getState().plan).toBeNull();
  });

  it('keeps the overlay to its own store', async () => {
    const r = await repeating();
    const other = await gig();
    await r.start();
    expect(other.library.getState().presetOverlay).toBeNull();
    await other.library
      .getState()
      .loadSong(other.first.id, other.entries[0]?.item.id, other.setlistId);
    expect(other.metronome.getState().bpm).toBe(other.first.bpm);
  });

  it('shows no unsaved changes for logged settings, and does for an edit', async () => {
    const r = await repeating();
    await r.start();
    expect(r.unsaved()).toBe(false);
    await r.library.getState().stepSong(SONG_STEP.next);
    expect(r.library.getState().discarded).toBeNull();
    r.metronome.getState().setTempo(123);
    expect(r.unsaved()).toBe(true);
  });

  it('reverts to the saved song, bypassing the overlay', async () => {
    const r = await repeating();
    await r.start();
    r.library.getState().revertLoadedSong();
    expect(r.bpm()).toBe(r.first.bpm);
  });

  it('brings discarded edits back on Undo, bypassing the overlay', async () => {
    const r = await repeating();
    await r.start();
    r.metronome.getState().setTempo(123);
    await r.library.getState().stepSong(SONG_STEP.next);
    await r.library.getState().undoDiscard();
    expect(r.bpm()).toBe(123);
  });

  it('loads an old session with saved settings while a Repeat is active', async () => {
    const r = await repeating();
    await r.start();
    await r.overlay.loadSaved({
      kind: SESSION_LOAD.setlist,
      setlistId: r.setlistId,
      name: 'Gig',
      presetId: r.first.id,
      itemId: r.entries[0]?.item.id ?? 0,
    });
    expect(r.bpm()).toBe(r.first.bpm);
    expect(r.library.getState().presetOverlay).toBeNull();
  });

  it('plays a deleted setlist as free play until a song is loaded', async () => {
    const r = await repeating();
    const log = r.log(BPMS);
    await r.library.getState().deleteSetlist(r.setlistId);
    const plan = repeatPlanOf(log, r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    expect(r.library.getState().loaded).toBeNull();
    expect(r.bpm()).toBe(70);
    await r.library.getState().loadSong(r.first.id);
    expect(r.overlay.state.getState().plan).toBeNull();
    expect(r.bpm()).toBe(r.first.bpm);
  });
});
