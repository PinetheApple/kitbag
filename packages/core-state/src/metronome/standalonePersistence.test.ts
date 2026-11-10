import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { setup } from '../library/store.test-helper.ts';
import { BPM_BOUNDS } from './config.ts';
import {
  standaloneMetronomeOf,
  type MetronomeSettingsInput,
} from './standalone.ts';
import {
  bindStandaloneMetronomePersistence,
  type StandaloneMetronomePersistence,
} from './standalonePersistence.ts';

const STANDALONE_BPM = 125;
const SONG_BPM = 90;
const SONG_EDIT_BPM = 95;
const SONG_SUBDIVISION = 4;
const RAMPED_BPM = 130;
const RAMP = {
  enabled: false,
  startBpm: 100,
  targetBpm: 140,
  stepBpm: 10,
  interval: 2,
  unit: KB_RAMP_UNIT.KB_RAMP_SECONDS,
  loop: true,
};

function memoryPersistence(initial: Partial<MetronomeSettingsInput> = {}) {
  let stored = initial;
  let saves = 0;
  const persistence: StandaloneMetronomePersistence = {
    load: () => stored,
    save: (settings) => {
      saves++;
      stored = settings;
    },
  };
  return { persistence, stored: () => stored, saves: () => saves };
}

type Memory = ReturnType<typeof memoryPersistence>;

function launch(memory: Memory, engineBpm?: () => number) {
  const app = setup(engineBpm);
  bindStandaloneMetronomePersistence(
    app.metronome,
    app.library,
    memory.persistence,
  );
  return app;
}

const settled = () => Promise.resolve();

async function saveSongInSetlist(app: ReturnType<typeof setup>) {
  const s = app.library.getState();
  const setlistId = await s.createSetlist('Gig');
  const presetId = await s.newSongFromCurrent('Ballad', setlistId);
  await s.savePreset(presetId, {
    bpm: SONG_BPM,
    subdivision: SONG_SUBDIVISION,
  });
  const [entry] = app.library.getState().entries[setlistId] ?? [];
  if (entry === undefined) throw new Error('missing setlist entry');
  return { presetId, itemId: entry.item.id, setlistId };
}

async function standaloneThenSong(memory: Memory) {
  const app = launch(memory);
  app.metronome.getState().setTempo(STANDALONE_BPM);
  await settled();
  return { app, song: await saveSongInSetlist(app) };
}

describe('standalone metronome across an app restart', () => {
  it('comes back with every standalone setting, on the engine too', async () => {
    const memory = memoryPersistence();
    const { metronome } = launch(memory);
    const first = metronome.getState();
    first.setBeats(7, 8);
    first.setSubdivision(3);
    first.cycleAccent(1);
    first.setPoly(true, 5);
    first.setPolyAgainst(2);
    first.cyclePolyAccent(2);
    first.setSounds(2, 4);
    first.setBarMute({ enabled: true, playBars: 3, muteBars: 1 });
    first.setRamp(RAMP);
    first.setTempo(STANDALONE_BPM);
    await settled();
    const saved = standaloneMetronomeOf(metronome.getState());

    const relaunched = launch(memory);
    expect(standaloneMetronomeOf(relaunched.metronome.getState())).toEqual(
      saved,
    );
    expect(relaunched.commands.setTempo).toHaveBeenLastCalledWith(
      STANDALONE_BPM,
    );
    expect(relaunched.commands.setBeats).toHaveBeenLastCalledWith(7, 8);
    expect(relaunched.commands.setPolyAccent).toHaveBeenCalledWith(
      2,
      KB_ACCENT.KB_ACCENT_MUTED,
    );
  });

  it('restores the tempo but never playback, and saves nothing on restore', async () => {
    const memory = memoryPersistence();
    const first = launch(memory).metronome.getState();
    first.start();
    first.setTempo(STANDALONE_BPM);
    await settled();
    const savesBeforeRelaunch = memory.saves();

    const relaunched = launch(memory);
    await settled();
    expect(relaunched.metronome.getState().bpm).toBe(STANDALONE_BPM);
    expect(relaunched.metronome.getState().running).toBe(false);
    expect(relaunched.commands.metronomeStart).not.toHaveBeenCalled();
    expect(memory.saves()).toBe(savesBeforeRelaunch);
  });

  it('restores an enabled ramp at its start tempo', async () => {
    const memory = memoryPersistence();
    const first = launch(memory, () => RAMPED_BPM).metronome;
    first.getState().setRamp({ ...RAMP, enabled: true });
    first.getState().start();
    first.getState().stop();
    await settled();
    expect(memory.stored().bpm).toBe(RAMPED_BPM);

    const relaunched = launch(memory).metronome.getState();
    expect(relaunched.ramp.enabled).toBe(true);
    expect(relaunched.bpm).toBe(RAMP.startBpm);
  });

  it('ranges a stored ramp that is switched off', () => {
    const memory = memoryPersistence({
      ramp: { ...RAMP, startBpm: 9999, targetBpm: -5 },
    });
    const { ramp } = launch(memory).metronome.getState();
    expect(ramp.enabled).toBe(false);
    expect(ramp.startBpm).toBe(BPM_BOUNDS.max);
    expect(ramp.targetBpm).toBe(BPM_BOUNDS.min);
  });

  it('is not overwritten by loading or editing a song or setlist step', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    const s = app.library.getState();

    await s.loadSong(song.presetId);
    app.metronome.getState().setTempo(SONG_EDIT_BPM);
    await s.loadSong(song.presetId, song.itemId, song.setlistId);
    await settled();
    expect(app.metronome.getState().bpm).toBe(SONG_BPM);

    const relaunched = launch(memory).metronome.getState();
    expect(relaunched.bpm).toBe(STANDALONE_BPM);
    expect(relaunched.subdivision).not.toBe(SONG_SUBDIVISION);
  });

  it('saves a cleared song’s settings as the standalone ones', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    await app.library.getState().loadSong(song.presetId);
    app.library.getState().clearSong();
    await settled();

    expect(memory.stored().bpm).toBe(SONG_BPM);
  });

  it('keeps edits made after the loaded song is deleted', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    await app.library.getState().loadSong(song.presetId);
    await app.library.getState().deletePreset(song.presetId);
    await settled();
    expect(memory.stored().bpm).toBe(SONG_BPM);
    app.metronome.getState().setTempo(SONG_EDIT_BPM);
    await settled();

    expect(launch(memory).metronome.getState().bpm).toBe(SONG_EDIT_BPM);
  });

  it('saves the settings left after leaving a setlist', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    const s = app.library.getState();
    await s.loadSong(song.presetId, song.itemId, song.setlistId);
    await s.leaveSetlist();
    await settled();

    expect(memory.stored().bpm).toBe(SONG_BPM);
  });

  it('does not save when an undone discard re-links the song', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    const s = app.library.getState();
    await s.loadSong(song.presetId, song.itemId, song.setlistId);
    app.metronome.getState().setTempo(SONG_EDIT_BPM);
    s.clearSong();
    await settled();
    app.metronome.getState().setTempo(STANDALONE_BPM);
    await settled();
    const savesBeforeUndo = memory.saves();

    await s.undoDiscard();
    await settled();
    expect(app.metronome.getState().bpm).toBe(SONG_EDIT_BPM);
    expect(app.library.getState().loaded).not.toBeNull();
    expect(memory.saves()).toBe(savesBeforeUndo);
    expect(memory.stored().bpm).toBe(STANDALONE_BPM);
  });

  it('leaves the saved song and the stored standalone tempo alone while a song is edited', async () => {
    const memory = memoryPersistence();
    const { app, song } = await standaloneThenSong(memory);
    await app.library
      .getState()
      .loadSong(song.presetId, song.itemId, song.setlistId);
    app.metronome.getState().setTempo(SONG_EDIT_BPM);
    await settled();
    await app.library.getState().refresh();

    const state = app.library.getState();
    expect(memory.stored().bpm).toBe(STANDALONE_BPM);
    expect(state.presets.find((p) => p.id === song.presetId)?.bpm).toBe(
      SONG_BPM,
    );
    expect(state.loaded).toEqual(song);
  });
});
