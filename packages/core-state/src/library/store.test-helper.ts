import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { afterEach, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import { createLibraryStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

export function setup(engineBpm = () => 120) {
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
    setSubdivisionAccents: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setPolyAgainst: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
    engineHold: vi.fn(),
    engineRelease: vi.fn(),
  };
  const metronome = createMetronomeStore(commands, () => 0, engineBpm);
  const library = createLibraryStore({
    repos: () => repos,
    metronome: () => metronome.getState(),
    now: Date.now,
  });
  return { library, metronome, commands, repos };
}
