import type { StemSetRecord } from '@kitbag/core-db';
import { KB_MAX_TRACKS, KB_RESULT } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { mixActions, transportActions } from './actions.ts';
import { clickActions, stopClick } from './clickActions.ts';
import { debounce } from './debounce.ts';
import { NO_SONG_FACTS, songFacts, type SongFacts } from './facts.ts';
import { loopActions } from './loopActions.ts';
import { UNITY_GAIN } from './mix.ts';
import { mixSaver } from './mixSaver.ts';
import { renameActions } from './renameActions.ts';
import { getStemPlayer, type StemPlayerRuntime } from './runtime.ts';
import { secondsToFrames } from './time.ts';

const MIX_SAVE_DELAY_MS = 600;
const SCRUB_SEEK_DELAY_MS = 120;

export interface StemRow {
  readonly id: number;
  readonly name: string;
  readonly volume: number;
  readonly muted: boolean;
  readonly soloed: boolean;
  readonly loaded: boolean;
  readonly envelope: readonly number[] | null;
  readonly extent: number;
}

export type LoopState =
  | { readonly kind: 'off' }
  | { readonly kind: 'armed'; readonly startSec: number }
  | {
      readonly kind: 'on';
      readonly startSec: number;
      readonly endSec: number;
    };

export type StemPlayerStatus =
  'idle' | 'loading' | 'ready' | 'missing' | 'failed';

export type LoopFailure = 'tooShort' | 'pastEnd' | 'engine';

export interface StemPlayerState {
  readonly status: StemPlayerStatus;
  readonly setId: number | null;
  readonly title: string;
  readonly artist: string | null;
  readonly facts: SongFacts;
  readonly stems: readonly StemRow[];
  readonly overLimit: number;
  readonly masterGain: number;
  readonly engineRate: number;
  readonly durationFrames: number;
  readonly beats: readonly number[];
  readonly loop: LoopState;
  readonly loopFailure: LoopFailure | null;
  readonly click: boolean;
}

export interface StemPlayerActions {
  readonly open: (setId: number, waveformBars: number) => Promise<void>;
  readonly close: () => void;
  readonly setGain: (index: number, gain: number) => void;
  readonly toggleMute: (index: number) => void;
  readonly solo: (index: number, additive: boolean) => void;
  readonly setMasterGain: (gain: number) => void;
  readonly resetMix: () => void;
  readonly togglePlay: () => void;
  readonly scrub: (frame: number) => void;
  readonly cancelScrub: () => void;
  readonly seek: (frame: number) => void;
  readonly skip: (seconds: number) => void;
  readonly markLoop: () => Promise<void>;
  readonly toggleClick: () => Promise<void>;
  readonly renameStem: (index: number, name: string) => Promise<void>;
}

export type StemPlayerStore = StemPlayerState & StemPlayerActions;
export type SetState = StoreApi<StemPlayerStore>['setState'];
export type Get = StoreApi<StemPlayerStore>['getState'];

export interface ActionContext {
  readonly set: SetState;
  readonly get: Get;
  readonly runtimeOf: () => StemPlayerRuntime;
  readonly session: () => number;
}

export interface StemPlayerTiming {
  readonly mixSaveDelayMs: number;
  readonly scrubSeekDelayMs: number;
}

const DEFAULT_TIMING: StemPlayerTiming = {
  mixSaveDelayMs: MIX_SAVE_DELAY_MS,
  scrubSeekDelayMs: SCRUB_SEEK_DELAY_MS,
};

const closedState: StemPlayerState = {
  status: 'idle',
  setId: null,
  title: '',
  artist: null,
  facts: NO_SONG_FACTS,
  stems: [],
  overLimit: 0,
  masterGain: UNITY_GAIN,
  engineRate: 0,
  durationFrames: 0,
  beats: [],
  loop: { kind: 'off' },
  loopFailure: null,
  click: false,
};

function longestSeconds(record: StemSetRecord): number {
  return Math.max(0, ...record.stems.map((stem) => stem.durationSec));
}

function rowsOf(record: StemSetRecord): StemRow[] {
  const longest = longestSeconds(record);
  return record.stems.slice(0, KB_MAX_TRACKS).map((stem) => ({
    id: stem.id,
    name: stem.name,
    volume: stem.volume,
    muted: stem.muted,
    soloed: stem.soloed,
    loaded: false,
    envelope: null,
    extent: longest > 0 ? stem.durationSec / longest : 1,
  }));
}

async function loadTracks(
  runtime: StemPlayerRuntime,
  record: StemSetRecord,
  rows: readonly StemRow[],
  isLive: () => boolean,
): Promise<StemRow[]> {
  const { commands } = runtime;
  const results = await Promise.all(
    rows.map((_, track) =>
      commands
        .loadTrack(track, record.stems[track]?.filePath ?? '')
        .catch(() => KB_RESULT.KB_ERROR_INVALID_ARGUMENT),
    ),
  );
  // The mixer ignores mix commands for a track it has not loaded yet.
  return rows.map((row, track) => {
    const loaded = results[track] === KB_RESULT.KB_OK;
    if (loaded && isLive()) {
      commands.mixerSetGain(track, row.volume);
      commands.mixerSetMute(track, row.muted);
      commands.mixerSetSolo(track, row.soloed);
    }
    return { ...row, loaded };
  });
}

export function createStemPlayerStore(
  runtimeOf: () => StemPlayerRuntime = getStemPlayer,
  timing: StemPlayerTiming = DEFAULT_TIMING,
): StoreApi<StemPlayerStore> {
  let session = 0;
  let requestedTracks = 0;
  const saver = mixSaver(
    (mixes) => runtimeOf().records.saveStemMix(mixes),
    timing.mixSaveDelayMs,
  );
  const scrubSeek = debounce((frame: number) => {
    runtimeOf().commands.mixerSeek(frame);
  }, timing.scrubSeekDelayMs);

  const teardown = (get: Get) => {
    const runtime = runtimeOf();
    const { commands } = runtime;
    const { click, loop } = get();
    saver.flush();
    scrubSeek.cancel();
    if (click) stopClick(runtime);
    commands.songTransportHide();
    commands.mixerStop();
    if (loop.kind === 'on') void commands.mixerClearLoop().catch(() => null);
    for (let track = 0; track < requestedTracks; track++) {
      commands.mixerSetSolo(track, false);
      commands.mixerSetMute(track, false);
      commands.mixerSetGain(track, UNITY_GAIN);
      commands.mixerUnloadTrack(track);
    }
    requestedTracks = 0;
  };

  return createStore<StemPlayerStore>((set, get) => {
    const live = (opened: number) => opened === session;
    const context: ActionContext = {
      set,
      get,
      runtimeOf,
      session: () => session,
    };
    const loadWaveforms = (
      opened: number,
      record: StemSetRecord,
      bars: number,
    ) => {
      get().stems.forEach((row, track) => {
        const path = record.stems[track]?.waveformPath ?? null;
        if (path === null) return;
        runtimeOf()
          .readWaveform(path, bars)
          .then((envelope) => {
            if (!live(opened)) return;
            set((s) => ({
              stems: s.stems.map((r) =>
                r.id === row.id ? { ...r, envelope } : r,
              ),
            }));
          })
          .catch((error: unknown) => {
            console.warn('[kitbag] stem waveform unreadable', error);
          });
      });
    };

    const load = async (opened: number, setId: number, bars: number) => {
      const runtime = runtimeOf();
      const { commands } = runtime;
      const record = await runtime.records.readStemSet(setId);
      if (!live(opened)) return;
      if (record === undefined) {
        set({ status: 'missing' });
        return;
      }
      if (runtime.sharedMetronome.active()) runtime.sharedMetronome.release();
      const started = await commands.start();
      const engineRate = runtime.engine.sampleRate();
      if (!live(opened)) return;
      if (started !== KB_RESULT.KB_OK || engineRate <= 0) {
        set({ status: 'failed' });
        return;
      }
      // A loop a failed clear left behind would otherwise play in this song.
      await commands.mixerClearLoop().catch(() => null);
      if (!live(opened)) return;
      const rows = rowsOf(record);
      requestedTracks = rows.length;
      const stems = await loadTracks(runtime, record, rows, () => live(opened));
      const masterGain = await commands.mixerMasterGain();
      if (!live(opened)) return;
      set({
        status: 'ready',
        title: record.songTitle ?? record.title,
        artist: record.songTitle === null ? null : record.artist,
        facts: songFacts(record),
        stems,
        overLimit: record.stems.length - rows.length,
        masterGain,
        engineRate,
        durationFrames: secondsToFrames(longestSeconds(record), engineRate),
        beats: record.beats,
      });
      loadWaveforms(opened, record, bars);
    };

    return {
      ...closedState,
      open: async (setId, waveformBars) => {
        if (get().setId !== null) teardown(get);
        const opened = ++session;
        set({ ...closedState, status: 'loading', setId });
        try {
          await load(opened, setId, waveformBars);
        } catch (error: unknown) {
          console.warn('[kitbag] stem song failed to open', error);
          if (live(opened)) set({ status: 'failed' });
        }
      },
      close: () => {
        session++;
        teardown(get);
        set(closedState);
      },
      ...mixActions(set, get, runtimeOf, saver),
      ...transportActions(get, runtimeOf, scrubSeek),
      ...loopActions(context),
      ...clickActions(context),
      ...renameActions(context),
    };
  });
}

export const stemPlayerStore = createStemPlayerStore();
