import {
  TEMPO_CORRECTION,
  type LibraryRow,
  type SongRecord,
} from '@kitbag/core-db';
import { vi, type Mock } from 'vitest';
import { createStore } from 'zustand/vanilla';

import type { MetronomeCommands } from '../metronome/commands.ts';
import { createMetronomeStore, DEFAULT_BPM } from '../metronome/store.ts';
import { songRow } from '../storage/fixtures.test-helper.ts';
import type { MixerClaim } from '../stemPlayer/mixerClaim.ts';
import { fakeRuntime, RATE, record } from '../stemPlayer/store.test-helper.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import type { SongClickMetronome } from './songClick.ts';
import { createSongPlayerStore, type SongLibraryRows } from './store.ts';

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
    tempoCorrection: TEMPO_CORRECTION.none,
    meterBeatsPerBar: null,
    barOneSeconds: null,
    ...change,
  };
}

export function lastAccentPerBeat(
  setAccent: Mock<(beat: number, accent: number) => void>,
) {
  const last = new Map<number, number>();
  for (const [beat, accent] of setAccent.mock.calls) last.set(beat, accent);
  return [...last.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, accent]) => accent);
}

export function fakeMetronomeCommands() {
  return new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) =>
        (target[key] ??= vi.fn()),
    },
  ) as unknown as {
    [K in keyof MetronomeCommands]: Mock<MetronomeCommands[K]>;
  };
}

export function fakeMetronome() {
  const commands = fakeMetronomeCommands();
  const store = createMetronomeStore(
    commands,
    () => 0,
    () => DEFAULT_BPM,
    Date.now,
    { active: () => false, release: () => undefined },
  );
  return { store, commands };
}

export function fakeSongRuntime(song: SongRecord = songRecord()) {
  const fake = fakeRuntime(record([]));
  const metronomeSetters = {
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setSounds: vi.fn(),
    setAccent: vi.fn<(beat: number, accent: number) => void>(),
  };
  const mixerTrackFrames = vi.fn(() =>
    Promise.resolve(secondsToFrames(song.durationSec, RATE)),
  );
  const commands = { ...fake.commands, ...metronomeSetters, mixerTrackFrames };
  const records = {
    readSong: vi.fn(() => Promise.resolve<SongRecord | undefined>(song)),
  };
  const library = {
    correctDuration: vi.fn(() => Promise.resolve()),
  };
  const readWaveform = vi.fn(() => Promise.resolve<readonly number[]>([0.5]));
  const runtime: SongPlayerRuntime = {
    commands,
    records,
    library,
    readWaveform,
    engine: fake.runtime.engine,
    sharedMetronome: fake.sharedMetronome,
  };
  const standalone = fakeMetronome();
  const metronome: SongClickMetronome = standalone;
  return {
    ...fake,
    runtime,
    commands,
    records,
    library,
    readWaveform,
    metronomeSetters,
    standalone,
    metronome,
  };
}

export type Fake = ReturnType<typeof fakeSongRuntime>;

export function songStore(
  fake: Fake,
  mixerClaim?: MixerClaim,
  library?: SongLibraryRows,
) {
  return createSongPlayerStore(() => fake.runtime, {
    scrubSeekDelayMs: SEEK_MS,
    metronome: fake.metronome,
    ...(mixerClaim === undefined ? {} : { mixerClaim }),
    ...(library === undefined ? {} : { library }),
  });
}

export async function openedSong(song: SongRecord = songRecord()) {
  const fake = fakeSongRuntime(song);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  fake.commands.mixerClearLoop.mockClear();
  return { ...fake, store };
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function leftPlaying(song: SongRecord = songRecord()) {
  const fake = fakeSongRuntime(song);
  const library = createStore(() => ({
    rows: [
      songRow({ id: SONG_ID, title: song.title }),
    ] as readonly LibraryRow[],
    ready: true,
    failed: false,
  }));
  const player = songStore(fake, undefined, library);
  const session = player.getState().open(SONG_ID, BARS);
  await session.loaded;
  player.getState().togglePlay();
  fake.engine.playing = true;
  session.hold.release();
  return { ...fake, library, player };
}

export async function opened(first: SongRecord) {
  const fake = fakeSongRuntime(first);
  const library = createStore(() => ({
    rows: [songRow({ id: SONG_ID })] as readonly LibraryRow[],
    ready: true,
    failed: false,
  }));
  const player = songStore(fake, undefined, library);
  await player.getState().open(SONG_ID, BARS).loaded;
  return { ...fake, library, player };
}
