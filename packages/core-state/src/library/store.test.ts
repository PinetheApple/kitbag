import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { KB_ACCENT, KB_RAMP_UNIT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import { SONG_STEP } from './setlistPosition.ts';
import { createLibraryStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

function setup(engineBpm = () => 120) {
  const handle = openTestDatabase();
  handles.push(handle);
  const repos = {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
  const commands = {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
  };
  const metronome = createMetronomeStore(commands, () => 0, engineBpm);
  const library = createLibraryStore({
    repos: () => repos,
    metronome: () => metronome.getState(),
  });
  return { library, metronome, commands, repos };
}

async function songsIn(
  library: ReturnType<typeof createLibraryStore>,
  setlistId: number,
) {
  await library.getState().refresh();
  return (library.getState().entries[setlistId] ?? []).map(
    (e) => e.preset.name,
  );
}

describe('library store', () => {
  it('creates, reorders, duplicates, moves, removes and deletes', async () => {
    const { library } = setup();
    const s = library.getState();
    const gig = await s.createSetlist('Gig');
    const spare = await s.createSetlist('Spare');
    for (const name of ['A', 'B', 'C']) await s.newSongFromCurrent(name, gig);
    await s.reorder(gig, 2, 0);
    expect(await songsIn(library, gig)).toEqual(['C', 'A', 'B']);
    const dup = await s.duplicateSetlist(gig);
    expect(await songsIn(library, dup)).toEqual(['C', 'A', 'B']);
    const [c] = library.getState().entries[gig] ?? [];
    if (c === undefined) throw new Error('missing C');
    await s.moveToSetlist(c.item.id, spare);
    expect(await songsIn(library, gig)).toEqual(['A', 'B']);
    expect(await songsIn(library, spare)).toEqual(['C']);
    await s.removeFromSet(c.item.id);
    expect(library.getState().standalone.map((p) => p.name)).toEqual([]);
    await s.deletePreset(c.preset.id);
    expect(await songsIn(library, dup)).toEqual(['A', 'B']);
  });

  it('keeps a song removed from every set in All songs', async () => {
    const { library } = setup();
    const s = library.getState();
    const gig = await s.createSetlist('Gig');
    await s.newSongFromCurrent('Solo', gig);
    const [entry] = library.getState().entries[gig] ?? [];
    if (entry === undefined) throw new Error('missing entry');
    await s.removeFromSet(entry.item.id);
    expect(library.getState().standalone.map((p) => p.name)).toEqual(['Solo']);
  });

  it('searches setlists and songs with % and _ taken literally', async () => {
    const { library } = setup();
    const s = library.getState();
    await s.createSetlist('100% rock');
    await s.createSetlist('1000 rock');
    await s.newSongFromCurrent('a_b');
    await s.newSongFromCurrent('axb');
    await s.search('%');
    expect(library.getState().results?.setlists.map((x) => x.name)).toEqual([
      '100% rock',
    ]);
    await s.search('_');
    expect(library.getState().results?.presets.map((x) => x.name)).toEqual([
      'a_b',
    ]);
  });

  it('loads a song into the metronome and pins its setlist with a played count', async () => {
    const { library, metronome } = setup();
    const s = library.getState();
    metronome.getState().setBeats(3, 4);
    metronome.getState().setTempo(96);
    metronome.getState().setRamp({
      enabled: true,
      startBpm: 96,
      targetBpm: 104,
      stepBpm: 5,
      interval: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    metronome.getState().setPoly(true, 3);
    metronome.getState().cyclePolyAccent(1);
    metronome.getState().setSounds(2, 5);
    const later = await s.createSetlist('Later');
    const gig = await s.createSetlist('Gig');
    const song = await s.newSongFromCurrent('Blackbird', gig);
    const savedAccents = metronome.getState().accents;
    metronome.getState().setTempo(140);
    metronome.getState().cycleAccent(1);
    metronome.getState().setBeats(4, 4);
    metronome.getState().cyclePolyAccent(1);
    metronome.getState().setSounds(0, 0);
    const [entry] = library.getState().entries[gig] ?? [];
    if (entry === undefined) throw new Error('missing entry');
    await s.loadSong(song, entry.item.id, gig);
    const m = metronome.getState();
    expect([m.bpm, m.beatsPerBar, m.ramp.enabled, m.ramp.targetBpm]).toEqual([
      96,
      3,
      true,
      104,
    ]);
    expect(m.accents).toEqual(savedAccents);
    expect(m.polyAccents).toEqual([
      KB_ACCENT.KB_ACCENT_ACCENTED,
      KB_ACCENT.KB_ACCENT_MUTED,
      KB_ACCENT.KB_ACCENT_NORMAL,
    ]);
    expect(m.sounds).toEqual({ normal: 2, accent: 5 });
    expect(library.getState().setlists.map((x) => x.setlist.id)).toEqual([
      gig,
      later,
    ]);
    expect(library.getState().played).toEqual([entry.item.id]);
    expect(library.getState().loaded).toEqual({
      presetId: song,
      itemId: entry.item.id,
      setlistId: gig,
    });
  });

  async function offStage() {
    const { library, repos, metronome } = setup();
    const s = library.getState();
    const gig = await s.createSetlist('Gig');
    for (const name of ['One', 'Two', 'Three'])
      await s.newSongFromCurrent(name, gig);
    const solo = await s.newSongFromCurrent('Solo');
    const [first] = library.getState().entries[gig] ?? [];
    if (first === undefined) throw new Error('missing first song');
    return { library, repos, metronome, gig, solo, first };
  }

  async function onStage() {
    const stage = await offStage();
    const { first, gig } = stage;
    await stage.library
      .getState()
      .loadSong(first.preset.id, first.item.id, gig);
    return stage;
  }

  const loadedName = (library: ReturnType<typeof createLibraryStore>) =>
    library
      .getState()
      .presets.find((p) => p.id === library.getState().loaded?.presetId)?.name;

  const activeId = (library: ReturnType<typeof createLibraryStore>) =>
    library.getState().setlists.find((x) => x.setlist.active)?.setlist.id;

  it('steps through the active setlist and stops at both ends', async () => {
    const { library, gig } = await onStage();
    const s = library.getState();
    await s.stepSong(SONG_STEP.previous);
    expect(loadedName(library)).toBe('One');
    await s.stepSong(SONG_STEP.next);
    await s.stepSong(SONG_STEP.next);
    expect(loadedName(library)).toBe('Three');
    await s.stepSong(SONG_STEP.next);
    expect(loadedName(library)).toBe('Three');
    await s.stepSong(SONG_STEP.previous);
    expect(loadedName(library)).toBe('Two');
    expect(activeId(library)).toBe(gig);
    expect(library.getState().played).toHaveLength(3);
  });

  it('clears the active setlist when a song is loaded from outside it', async () => {
    const { library, solo } = await onStage();
    await library.getState().loadSong(solo);
    expect(activeId(library)).toBeUndefined();
    expect(library.getState().played).toEqual([]);
    expect(loadedName(library)).toBe('Solo');
  });

  it('leaves the setlist and unlinks the loaded song, keeping its settings', async () => {
    const { library, metronome } = await onStage();
    const bpm = metronome.getState().bpm;
    await library.getState().leaveSetlist();
    expect(activeId(library)).toBeUndefined();
    expect(library.getState().played).toEqual([]);
    expect(library.getState().loaded).toBeNull();
    expect(metronome.getState().bpm).toBe(bpm);
  });

  it('clears the loaded song without touching the metronome or the preset', async () => {
    const { library, metronome, repos } = setup();
    metronome.getState().setTempo(96);
    const id = await library.getState().newSongFromCurrent('Solo');
    await library.getState().loadSong(id);
    metronome.getState().setTempo(132);
    const update = vi.spyOn(repos.presets, 'update');
    library.getState().clearSong();
    expect(library.getState().loaded).toBeNull();
    expect(metronome.getState().bpm).toBe(132);
    expect(update).not.toHaveBeenCalled();
    expect(library.getState().presets.find((p) => p.id === id)?.bpm).toBe(96);
  });

  it('clears the setlist when an outside load overtakes a pin still in flight', async () => {
    const { library, gig, solo, first } = await offStage();
    const pinning = library
      .getState()
      .loadSong(first.preset.id, first.item.id, gig);
    await library.getState().loadSong(solo);
    await pinning;
    expect(activeId(library)).toBeUndefined();
    expect(loadedName(library)).toBe('Solo');
  });

  it('marks an outside song as off stage even when leaving the setlist fails', async () => {
    const { library, repos, solo } = await onStage();
    vi.spyOn(repos.setlists, 'selectActive').mockRejectedValue(
      new Error('disk full'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(library.getState().loadSong(solo)).resolves.toBeUndefined();
    expect(library.getState().loaded).toMatchObject({ setlistId: null });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('setlist'),
      expect.objectContaining({ message: 'disk full' }),
    );
  });

  it('keeps the setlist and says why when Leave setlist fails', async () => {
    const { library, repos, gig } = await onStage();
    vi.spyOn(repos.setlists, 'selectActive').mockRejectedValue(
      new Error('disk full'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(library.getState().leaveSetlist()).resolves.toBeUndefined();
    expect(activeId(library)).toBe(gig);
    expect(warn).toHaveBeenCalled();
  });

  it('steps by setlist item when the same song is in the set twice', async () => {
    const { library, gig, first } = await onStage();
    await library.getState().addToSetlist(gig, first.preset.id);
    const items = (library.getState().entries[gig] ?? []).map((e) => e.item.id);
    const s = library.getState();
    await s.stepSong(SONG_STEP.next);
    await s.stepSong(SONG_STEP.next);
    await s.stepSong(SONG_STEP.next);
    expect(library.getState().loaded?.itemId).toBe(items[3]);
    expect(loadedName(library)).toBe('One');
    await s.stepSong(SONG_STEP.previous);
    expect(library.getState().loaded?.itemId).toBe(items[2]);
  });

  it('starts from song 1 when the loaded song is removed from the set', async () => {
    const { library, gig, first } = await onStage();
    await library.getState().stepSong(SONG_STEP.next);
    const loaded = library.getState().loaded?.itemId;
    if (loaded === undefined || loaded === null) throw new Error('not loaded');
    await library.getState().removeFromSet(loaded);
    await library.getState().stepSong(SONG_STEP.previous);
    expect(library.getState().loaded?.itemId).toBe(loaded);
    await library.getState().stepSong(SONG_STEP.next);
    expect(library.getState().loaded?.itemId).toBe(first.item.id);
    expect(activeId(library)).toBe(gig);
  });

  it('saves edits and the live metronome into a preset explicitly', async () => {
    const { library, metronome } = setup();
    const s = library.getState();
    const id = await s.newSongFromCurrent('Song');
    await s.savePreset(id, { name: 'Renamed', notes: 'count 3', bpm: 77 });
    let preset = library.getState().presets.find((p) => p.id === id);
    expect([preset?.name, preset?.notes, preset?.bpm]).toEqual([
      'Renamed',
      'count 3',
      77,
    ]);
    metronome.getState().setTempo(133);
    metronome.getState().cycleAccent(0);
    await s.saveCurrentInto(id);
    preset = library.getState().presets.find((p) => p.id === id);
    expect(preset?.bpm).toBe(133);
    expect(Array.from(preset?.accents ?? [])[0]).toBe(
      KB_ACCENT.KB_ACCENT_NORMAL,
    );
  });

  it.each([
    [KB_RAMP_UNIT.KB_RAMP_SECONDS, 30, true],
    [KB_RAMP_UNIT.KB_RAMP_MINUTES, 2.5, false],
    [KB_RAMP_UNIT.KB_RAMP_BARS, 12, true],
  ])(
    'round-trips a ramp in unit %s, its length and loop',
    async (unit, duration, loop) => {
      const { library, metronome } = setup();
      const ramp = {
        enabled: true,
        startBpm: 90,
        targetBpm: 120,
        stepBpm: 5,
        interval: duration,
        unit,
        loop,
      };
      metronome.getState().setRamp(ramp);
      const id = await library.getState().newSongFromCurrent('Timed');
      metronome.getState().setRamp({
        ...ramp,
        enabled: false,
        unit: KB_RAMP_UNIT.KB_RAMP_BARS,
        interval: 4,
        loop: !loop,
      });
      await library.getState().loadSong(id);
      expect(metronome.getState().ramp).toEqual(ramp);
    },
  );

  it('loads a song tempo while running, not the stale engine tempo', async () => {
    const { library, metronome } = setup(() => 120);
    metronome.getState().setTempo(96);
    const id = await library.getState().newSongFromCurrent('Slow');
    metronome.getState().setTempo(120);
    metronome.getState().start();
    await library.getState().loadSong(id);
    expect(metronome.getState().bpm).toBe(96);
  });

  it('still loads a song when pinning its setlist fails', async () => {
    const { library, metronome, repos } = setup();
    const gig = await library.getState().createSetlist('Gig');
    metronome.getState().setTempo(88);
    const id = await library.getState().newSongFromCurrent('Song', gig);
    const [entry] = library.getState().entries[gig] ?? [];
    if (entry === undefined) throw new Error('missing entry');
    metronome.getState().setTempo(120);
    vi.spyOn(repos.setlists, 'selectActive').mockRejectedValue(
      new Error('disk full'),
    );
    await expect(
      library.getState().loadSong(id, entry.item.id, gig),
    ).resolves.toBeUndefined();
    expect(metronome.getState().bpm).toBe(88);
    expect(library.getState().loaded).toEqual({
      presetId: id,
      itemId: entry.item.id,
      setlistId: gig,
    });
  });

  it('keeps the library usable when only the search after a refresh fails', async () => {
    const { library, repos } = setup();
    await library.getState().createSetlist('Gig');
    await library.getState().search('Gig');
    vi.spyOn(repos.setlists, 'search').mockRejectedValue(new Error('busy'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await library.getState().refresh();
    expect(library.getState()).toMatchObject({ ready: true, failed: false });
    expect(library.getState().setlists.map((s) => s.setlist.name)).toEqual([
      'Gig',
    ]);
  });

  it('reports a failed snapshot as failed and says why', async () => {
    const { library, repos } = setup();
    vi.spyOn(repos.setlists, 'list').mockRejectedValue(new Error('no disk'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await library.getState().refresh();
    expect(library.getState()).toMatchObject({ ready: true, failed: true });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('library'),
      expect.objectContaining({ message: 'no disk' }),
    );
  });

  it('loads a ramped song while running at the ramp start, as the engine does', async () => {
    const { library, metronome, commands } = setup(() => 120);
    metronome.getState().setTempo(96);
    metronome.getState().setRamp({
      enabled: true,
      startBpm: 100,
      targetBpm: 140,
      stepBpm: 5,
      interval: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    const id = await library.getState().newSongFromCurrent('Climb');
    metronome.getState().setTempo(120);
    metronome.getState().start();
    commands.setRamp.mockClear();
    await library.getState().loadSong(id);
    expect(commands.setRamp).toHaveBeenLastCalledWith(
      true,
      100,
      140,
      5,
      8,
      KB_RAMP_UNIT.KB_RAMP_BARS,
      false,
    );
    expect(metronome.getState().bpm).toBe(100);
  });
});
