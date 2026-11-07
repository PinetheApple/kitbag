import type { SongRecord } from '@kitbag/core-db';
import { vi } from 'vitest';

import type { MixerClaim } from '../stemPlayer/mixerClaim.ts';
import { fakeRuntime, RATE, record } from '../stemPlayer/store.test-helper.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import { createSongPlayerStore } from './store.ts';

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
    downbeatIndices: [0, 4],
    analysisStatus: 'done',
    ...change,
  };
}

export function fakeSongRuntime(song: SongRecord = songRecord()) {
  const fake = fakeRuntime(record([]));
  const metronomeSetters = {
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setSounds: vi.fn(),
    setAccent: vi.fn(),
  };
  const mixerTrackFrames = vi.fn(() =>
    Promise.resolve(secondsToFrames(song.durationSec, RATE)),
  );
  const commands = { ...fake.commands, ...metronomeSetters, mixerTrackFrames };
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

export type Fake = ReturnType<typeof fakeSongRuntime>;

export function songStore(fake: Fake, mixerClaim?: MixerClaim) {
  return createSongPlayerStore(() => fake.runtime, {
    scrubSeekDelayMs: SEEK_MS,
    ...(mixerClaim === undefined ? {} : { mixerClaim }),
  });
}

export async function openedSong(song: SongRecord = songRecord()) {
  const fake = fakeSongRuntime(song);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  fake.commands.mixerClearLoop.mockClear();
  return { ...fake, store };
}
