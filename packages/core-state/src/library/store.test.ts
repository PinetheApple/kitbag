import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { KB_ACCENT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import { createLibraryStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

function setup() {
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
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setSound: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
  };
  const metronome = createMetronomeStore(
    commands,
    () => 0,
    () => 120,
  );
  const library = createLibraryStore({
    repos: () => repos,
    metronome: () => metronome.getState(),
  });
  return { library, metronome, commands };
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
    metronome
      .getState()
      .setRamp({ enabled: true, startBpm: 96, endBpm: 104, bars: 8 });
    const later = await s.createSetlist('Later');
    const gig = await s.createSetlist('Gig');
    const song = await s.newSongFromCurrent('Blackbird', gig);
    metronome.getState().setTempo(140);
    metronome.getState().setBeats(4, 4);
    const [entry] = library.getState().entries[gig] ?? [];
    if (entry === undefined) throw new Error('missing entry');
    await s.loadSong(song, entry.item.id, gig);
    const m = metronome.getState();
    expect([m.bpm, m.beatsPerBar, m.ramp.enabled, m.ramp.endBpm]).toEqual([
      96,
      3,
      true,
      104,
    ]);
    expect(library.getState().setlists.map((x) => x.setlist.id)).toEqual([
      gig,
      later,
    ]);
    expect(library.getState().played).toEqual([entry.item.id]);
    expect(library.getState().loaded).toEqual({
      presetId: song,
      itemId: entry.item.id,
    });
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
});
