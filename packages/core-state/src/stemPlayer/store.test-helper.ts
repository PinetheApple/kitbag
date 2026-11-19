import type { MeterOverride, StemSetRecord, StoredStem } from '@kitbag/core-db';
import {
  KB_COUNT_IN_OFF,
  KB_MIXDOWN_STATE,
  KB_MIXER_UNITY_RATE,
  KB_RESULT,
  type SongTransportRequest,
} from '@kitbag/core-native';
import { vi } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';

import { COUNT_IN_DRAIN_MARGIN_SECONDS } from './countedStart.ts';
import type {
  MixdownRuntime,
  StemPlayerCommands,
  StemPlayerRecords,
  StemPlayerRuntime,
} from './runtime.ts';
import { CODES } from '../songLibrary/store.test-helper.ts';
import { createStemPlayerStore, type StemPlayerStore } from './store.ts';

export const RATE = 44100;
export const SAVE_MS = 500;
export const SEEK_MS = 100;
export const BARS = 8;

export const SONG_DETAILS: Partial<StemSetRecord> = {
  sections: [
    { name: 'Verse', kind: 'verse', color: '', startSec: 4, endSec: 8 },
    { name: 'Intro', kind: 'intro', color: '', startSec: 0, endSec: 4 },
    { name: 'Outro', kind: 'outro', color: '', startSec: 8, endSec: 12 },
  ],
  lyrics: {
    synced: '[00:01.00]One\n[00:02.00]\n[00:03.00]Two\n[00:05.00]Three',
    plain: null,
    offsetSec: 0.5,
    instrumental: false,
  },
};

export const at = (seconds: number) => Math.round(seconds * RATE);

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

export function record(
  stems: StoredStem[],
  change: Partial<StemSetRecord> = {},
): StemSetRecord {
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
    meterBeatsPerBar: null,
    barOneSeconds: null,
    ...change,
  };
}

export function fakeRuntime(set: StemSetRecord) {
  let stored = set;
  const engine = {
    position: 0,
    playing: false,
    now: 0,
    rate: KB_MIXER_UNITY_RATE,
  };
  const songStopped = new Set<() => void>();
  const songRequests = new Set<(request: SongTransportRequest) => void>();
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
    songCountIn: vi.fn<StemPlayerCommands['songCountIn']>(() =>
      Promise.resolve(KB_RESULT.KB_OK),
    ),
    songPause: vi.fn(),
    songStop: vi.fn(),
    mixerSetLoop: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    mixerClearLoop: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    mixerSetRate: vi.fn<StemPlayerCommands['mixerSetRate']>((rate) => {
      engine.rate = rate;
      return Promise.resolve(KB_RESULT.KB_OK);
    }),
    mixerRate: vi.fn(() => Promise.resolve(engine.rate)),
    mixerSetTrackPitch: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    mixerTrackPitch: vi.fn(() => Promise.resolve(0)),
    mixerTrackFrames: vi.fn(() => Promise.resolve(0)),
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
    onSongTransport: vi.fn(
      (handler: (request: SongTransportRequest) => void) => {
        songRequests.add(handler);
        return { remove: () => songRequests.delete(handler) };
      },
    ),
  };
  const records = {
    readStemSet: vi.fn(() =>
      Promise.resolve<StemSetRecord | undefined>(stored),
    ),
    saveStemMix: vi.fn<StemPlayerRecords['saveStemMix']>((mixes) => {
      stored = {
        ...stored,
        stems: stored.stems.map((row) => ({
          ...row,
          ...mixes.find((mix) => mix.id === row.id),
        })),
      };
      return Promise.resolve();
    }),
    renameStem: vi.fn<StemPlayerRecords['renameStem']>(() => Promise.resolve()),
    saveLyricsRetimed: vi.fn<StemPlayerRecords['saveLyricsRetimed']>(() =>
      Promise.resolve(),
    ),
  };
  const sharedMetronome = { active: vi.fn(() => false), release: vi.fn() };
  const countInBars = vi.fn<() => number>(() => KB_COUNT_IN_OFF);
  const mixdownEngine = {
    state: KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE as KB_MIXDOWN_STATE,
    progress: 0,
  };
  const mixdown = {
    start: vi.fn<MixdownRuntime['start']>((fileName) => {
      mixdownEngine.state = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_RUNNING;
      mixdownEngine.progress = 0;
      return Promise.resolve({
        result: KB_RESULT.KB_OK,
        path: `/cache/exports/${fileName}`,
      });
    }),
    cancel: vi.fn(),
    progress: () => mixdownEngine.progress,
    state: () => mixdownEngine.state,
    share: vi.fn<MixdownRuntime['share']>(() => Promise.resolve()),
    announce: vi.fn<MixdownRuntime['announce']>(),
    foreground: vi.fn(() => true),
    codes: () => CODES,
  };
  const runtime: StemPlayerRuntime = {
    commands,
    records,
    sharedMetronome,
    engine: {
      sampleRate: () => RATE,
      position: () => engine.position,
      playing: () => engine.playing,
      nowFrame: () => engine.now,
    },
    countInBars,
    readWaveform: vi.fn(() => Promise.resolve([0.5])),
    mixdown,
  };
  const stopSongFromNotification = () => {
    engine.playing = false;
    engine.position = 0;
    songStopped.forEach((handler) => {
      handler();
    });
  };
  const requestFromNotification = (request: SongTransportRequest) => {
    songRequests.forEach((handler) => {
      handler(request);
    });
  };
  return {
    runtime,
    commands,
    records,
    engine,
    sharedMetronome,
    countInBars,
    mixdown,
    mixdownEngine,
    stopSongFromNotification,
    songStopListeners: songStopped,
    requestFromNotification,
    songRequestListeners: songRequests,
  };
}

export async function opened(
  stems: StoredStem[],
  change: Partial<StemSetRecord> = {},
) {
  const fake = fakeRuntime(record(stems, change));
  const store = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
  });
  await store.getState().open(7, BARS);
  fake.commands.mixerClearLoop.mockClear();
  fake.commands.mixerRate.mockClear();
  return { ...fake, store };
}

export function meterSaved(
  store: StoreApi<StemPlayerStore>,
  override: MeterOverride,
): void {
  const { setId, meterOverrideChanged } = store.getState();
  if (setId === null) throw new Error('no song open');
  meterOverrideChanged(setId, override);
}

export const ONE_BAR = 1;
export const BAR_BEATS = 2;
export const TWO_FOUR = [{ beat: 0, beatsPerBar: BAR_BEATS }];
export const BEAT = 0.5;
export const HEAD = at(1.2);
export const COUNT_END =
  at(COUNT_IN_DRAIN_MARGIN_SECONDS) + ONE_BAR * BAR_BEATS * at(BEAT);

export async function countingSong({ click = true } = {}) {
  const song = await opened([stem(1)], { ...SONG_DETAILS, bars: TWO_FOUR });
  song.countInBars.mockReturnValue(ONE_BAR);
  if (click) await song.store.getState().toggleClick();
  song.engine.position = HEAD;
  vi.clearAllMocks();
  return song;
}
