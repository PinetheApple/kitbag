import type { StemSetRecord, StoredStem } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { vi } from 'vitest';

import type {
  StemPlayerCommands,
  StemPlayerRecords,
  StemPlayerRuntime,
} from './runtime.ts';
import { createStemPlayerStore } from './store.ts';

export const RATE = 44100;
export const SAVE_MS = 500;
export const SEEK_MS = 100;
export const BARS = 8;

export function stem(id: number, change: Partial<StoredStem> = {}): StoredStem {
  return {
    id,
    name: `stem-${String(id)}`,
    role: `stem-${String(id)}`,
    filePath: `stems/job/stem-${String(id)}.flac`,
    waveformPath: `stems/job/stem-${String(id)}.kwav`,
    frames: RATE * 10,
    durationSec: 10,
    format: 'flac',
    channels: 2,
    sampleRate: RATE,
    volume: 1,
    muted: false,
    soloed: false,
    pitch: 0,
    ...change,
  };
}

export function record(stems: StoredStem[]): StemSetRecord {
  return {
    id: 7,
    uuid: 'u',
    title: 'Song',
    songTitle: null,
    artist: null,
    source: 'stemdeck',
    jobId: 'job',
    folder: 'stems/job',
    sampleRate: RATE,
    createdAt: new Date(0),
    speed: 1,
    bpm: 120,
    key: null,
    scale: null,
    keyConfidence: null,
    loudnessLufs: null,
    tempoStability: null,
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3],
    bars: [],
    sections: [],
    lyrics: null,
    lyricsRetimed: null,
    stems,
  };
}

export function fakeRuntime(set: StemSetRecord) {
  const engine = { position: 0, playing: false };
  const songStopped = new Set<() => void>();
  const commands = {
    start: vi.fn(() => Promise.resolve(0)),
    stop: vi.fn(),
    engineHold: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    engineRelease: vi.fn(),
    loadTrack: vi.fn<StemPlayerCommands['loadTrack']>(() =>
      Promise.resolve(KB_RESULT.KB_OK),
    ),
    mixerUnloadTrack: vi.fn(),
    mixerSetGain: vi.fn(),
    mixerSetMute: vi.fn(),
    mixerSetSolo: vi.fn(),
    mixerSetMasterGain: vi.fn(),
    mixerMasterGain: vi.fn(() => Promise.resolve(1)),
    mixerPlay: vi.fn(),
    mixerPause: vi.fn(),
    mixerStop: vi.fn(),
    mixerSeek: vi.fn(),
    mixerSetLoop: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    mixerClearLoop: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    setGrid: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    clearGrid: vi.fn(),
    metronomeFollowMixer: vi.fn(),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    songTransportShow: vi.fn(),
    songTransportHide: vi.fn(),
    onSongStopped: vi.fn((handler: () => void) => {
      songStopped.add(handler);
      return { remove: () => songStopped.delete(handler) };
    }),
  };
  const records = {
    readStemSet: vi.fn(() => Promise.resolve<StemSetRecord | undefined>(set)),
    saveStemMix: vi.fn(() => Promise.resolve()),
    renameStem: vi.fn<StemPlayerRecords['renameStem']>(() => Promise.resolve()),
  };
  const sharedMetronome = { active: vi.fn(() => false), release: vi.fn() };
  const runtime: StemPlayerRuntime = {
    commands,
    records,
    sharedMetronome,
    engine: {
      sampleRate: () => RATE,
      position: () => engine.position,
      playing: () => engine.playing,
      nowFrame: () => 0,
    },
    readWaveform: vi.fn(() => Promise.resolve([0.5])),
  };
  const stopSongFromNotification = () => {
    engine.playing = false;
    engine.position = 0;
    songStopped.forEach((handler) => {
      handler();
    });
  };
  return {
    runtime,
    commands,
    records,
    engine,
    sharedMetronome,
    stopSongFromNotification,
  };
}

export async function opened(stems: StoredStem[]) {
  const fake = fakeRuntime(record(stems));
  const store = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
  });
  await store.getState().open(7, BARS);
  fake.commands.mixerClearLoop.mockClear();
  return { ...fake, store };
}
