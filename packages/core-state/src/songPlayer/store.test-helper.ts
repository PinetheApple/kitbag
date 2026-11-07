import type { SongRecord } from '@kitbag/core-db';
import { vi } from 'vitest';

import { fakeRuntime, record } from '../stemPlayer/store.test-helper.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import { createSongPlayerStore } from './store.ts';
import type { MixerOwner } from '../stemPlayer/mixerOwner.ts';

export const SONG_ID = 3;
export const BARS = 16;
export const SEEK_MS = 100;

export function songRecord(change: Partial<SongRecord> = {}): SongRecord {
  return {
    id: SONG_ID,
    title: 'Everlong',
    artist: 'Foo',
    filePath: 'songs/u/everlong.mp3',
    waveformPath: 'songs/u/everlong.kwav',
    durationSec: 10,
    bpm: 120,
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3],
    downbeats: [0, 4],
    analysisStatus: 'done',
    ...change,
  };
}

export function fakeSongRuntime(song: SongRecord | undefined = songRecord()) {
  const fake = fakeRuntime(record([]));
  const metronomeSetters = {
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setSounds: vi.fn(),
    setAccent: vi.fn(),
  };
  const commands = { ...fake.commands, ...metronomeSetters };
  const records = {
    readSong: vi.fn(() => Promise.resolve<SongRecord | undefined>(song)),
  };
  const readWaveform = vi.fn(() => Promise.resolve<readonly number[]>([0.5]));
  const runtime: SongPlayerRuntime = {
    commands,
    records,
    readWaveform,
    engine: fake.runtime.engine,
    sharedMetronome: fake.sharedMetronome,
  };
  return {
    ...fake,
    runtime,
    commands,
    records,
    readWaveform,
    metronomeSetters,
  };
}

export function songStore(
  fake: ReturnType<typeof fakeSongRuntime>,
  mixer?: MixerOwner,
) {
  return createSongPlayerStore(
    () => fake.runtime,
    { scrubSeekDelayMs: SEEK_MS },
    mixer,
  );
}

export async function openedSong(song: SongRecord = songRecord()) {
  const fake = fakeSongRuntime(song);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS);
  fake.commands.mixerClearLoop.mockClear();
  return { ...fake, store };
}
