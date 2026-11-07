import {
  ANALYSIS_STATUS,
  type AnalysisStatus,
  type SongRecord,
} from '@kitbag/core-db';
import { acquireEngineHold, KB_RESULT } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { transportActions } from '../stemPlayer/actions.ts';
import {
  clickActions,
  stopClick,
  turnClickOff,
} from '../stemPlayer/clickActions.ts';
import { debounce } from '../stemPlayer/debounce.ts';
import { loopActions } from '../stemPlayer/loopActions.ts';
import { UNITY_GAIN } from '../stemPlayer/mix.ts';
import {
  createMixerOwner,
  mixerOwner,
  type MixerOwner,
} from '../stemPlayer/mixerOwner.ts';
import type { StemPlayerCommands } from '../stemPlayer/runtime.ts';
import {
  SCRUB_SEEK_DELAY_MS,
  type LoopFailure,
  type LoopState,
  type StemPlayerActions,
  type StemPlayerStatus,
} from '../stemPlayer/store.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import { getSongPlayer, type SongPlayerRuntime } from './runtime.ts';

const SONG_TRACK = 0;

export interface SongPlayerState {
  readonly status: StemPlayerStatus;
  readonly songId: number | null;
  readonly title: string;
  readonly artist: string | null;
  readonly bpm: number | null;
  readonly analysisStatus: AnalysisStatus;
  readonly durationFrames: number;
  readonly engineRate: number;
  readonly beats: readonly number[];
  readonly downbeats: readonly number[];
  readonly envelope: readonly number[] | null;
  readonly loop: LoopState;
  readonly loopFailure: LoopFailure | null;
  readonly click: boolean;
}

export type SongPlayerActions = Pick<
  StemPlayerActions,
  | 'togglePlay'
  | 'scrub'
  | 'cancelScrub'
  | 'seek'
  | 'skip'
  | 'markLoop'
  | 'toggleClick'
> & {
  readonly open: (songId: number, waveformBars: number) => Promise<void>;
  readonly close: () => void;
};

export type SongPlayerStore = SongPlayerState & SongPlayerActions;

export interface SongPlayerTiming {
  readonly scrubSeekDelayMs: number;
}

const DEFAULT_TIMING: SongPlayerTiming = {
  scrubSeekDelayMs: SCRUB_SEEK_DELAY_MS,
};

const closedState: SongPlayerState = {
  status: 'idle',
  songId: null,
  title: '',
  artist: null,
  bpm: null,
  analysisStatus: ANALYSIS_STATUS.pending,
  durationFrames: 0,
  engineRate: 0,
  beats: [],
  downbeats: [],
  envelope: null,
  loop: { kind: 'off' },
  loopFailure: null,
  click: false,
};

function factsOf(record: SongRecord): Partial<SongPlayerState> {
  return {
    title: record.title,
    artist: record.artist === '' ? null : record.artist,
    bpm: record.bpm,
    analysisStatus: record.analysisStatus,
  };
}

export function createSongPlayerStore(
  runtimeOf: () => SongPlayerRuntime = getSongPlayer,
  timing: SongPlayerTiming = DEFAULT_TIMING,
  mixer: MixerOwner = createMixerOwner(),
): StoreApi<SongPlayerStore> {
  let session = 0;
  let trackRequested = false;
  let masterToRestore: number | null = null;
  let releaseEngine: (() => void) | null = null;
  let songStopSubscription: ReturnType<
    StemPlayerCommands['onSongStopped']
  > | null = null;
  const scrubSeek = debounce((frame: number) => {
    runtimeOf().commands.mixerSeek(frame);
  }, timing.scrubSeekDelayMs);

  return createStore<SongPlayerStore>((set, get) => {
    const live = (opened: number) => opened === session;
    const context = { set, get, runtimeOf, session: () => session };

    const teardown = () => {
      const runtime = runtimeOf();
      const { commands } = runtime;
      const { click, loop } = get();
      scrubSeek.cancel();
      if (click) stopClick(runtime);
      commands.songTransportHide();
      commands.mixerStop();
      if (loop.kind === 'on') void commands.mixerClearLoop().catch(() => null);
      if (trackRequested) commands.mixerUnloadTrack(SONG_TRACK);
      trackRequested = false;
      if (masterToRestore !== null)
        commands.mixerSetMasterGain(masterToRestore);
      masterToRestore = null;
    };

    const loadWaveform = (opened: number, path: string, bars: number) => {
      runtimeOf()
        .readWaveform(path, bars)
        .then((envelope) => {
          if (live(opened)) set({ envelope });
        })
        .catch((error: unknown) => {
          console.warn('[kitbag] song waveform unreadable', error);
        });
    };

    const load = async (opened: number, songId: number, bars: number) => {
      const runtime = runtimeOf();
      const { commands } = runtime;
      const record = await runtime.records.readSong(songId);
      if (!live(opened)) return;
      if (record === undefined) {
        set({ status: 'missing' });
        return;
      }
      set(factsOf(record));
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
      const master = await commands.mixerMasterGain();
      if (!live(opened)) return;
      // The stem player's master level has no control on this screen.
      masterToRestore = master;
      commands.mixerSetMasterGain(UNITY_GAIN);
      trackRequested = true;
      const loaded = await commands.loadTrack(SONG_TRACK, record.filePath);
      if (!live(opened)) return;
      if (loaded !== KB_RESULT.KB_OK) {
        set({ status: 'failed' });
        return;
      }
      set({
        status: 'ready',
        engineRate,
        durationFrames: secondsToFrames(record.durationSec, engineRate),
        beats: record.beats,
        downbeats: record.downbeats,
      });
      if (record.waveformPath !== null)
        loadWaveform(opened, record.waveformPath, bars);
    };

    // A second close, from a screen whose session was already displaced, must
    // not stop whatever displaced it.
    const close = () => {
      if (get().songId === null) return;
      mixer.release(close);
      session++;
      teardown();
      set(closedState);
      releaseEngine?.();
      releaseEngine = null;
      songStopSubscription?.remove();
      songStopSubscription = null;
    };

    return {
      ...closedState,
      open: async (songId, waveformBars) => {
        if (get().songId !== null) teardown();
        releaseEngine ??= acquireEngineHold(runtimeOf().commands);
        mixer.claim(close);
        songStopSubscription ??= runtimeOf().commands.onSongStopped(() => {
          turnClickOff(context);
        });
        const opened = ++session;
        set({ ...closedState, status: 'loading', songId });
        try {
          await load(opened, songId, waveformBars);
        } catch (error: unknown) {
          console.warn('[kitbag] song failed to open', error);
          if (live(opened)) set({ status: 'failed' });
        }
      },
      close,
      ...transportActions(get, runtimeOf, scrubSeek),
      ...loopActions(context),
      ...clickActions(context),
    };
  });
}

export const songPlayerStore = createSongPlayerStore(
  getSongPlayer,
  DEFAULT_TIMING,
  mixerOwner,
);
