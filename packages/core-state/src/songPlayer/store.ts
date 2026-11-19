import {
  ANALYSIS_STATUS,
  type AnalysisStatus,
  type LibraryRow,
  type LibrarySongRow,
  type SongRecord,
} from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  transportActions,
  type TransportSlice,
} from '../stemPlayer/actions.ts';
import {
  clickActions,
  followNewGrid,
  type ClickSlice,
} from '../stemPlayer/clickActions.ts';
import { sameNumbers } from '../stemPlayer/bars.ts';
import { loopActions, type LoopSlice } from '../stemPlayer/loopActions.ts';
import { overrideDownbeats } from '../stemPlayer/meterOverride.ts';
import { UNITY_GAIN, UNSHIFTED_KEY } from '../stemPlayer/mix.ts';
import {
  createMixerClaim,
  mixerClaim,
  type MixerClaim,
} from '../stemPlayer/mixerClaim.ts';
import {
  createMixerClick,
  mixerClick,
  type MixerClick,
} from '../stemPlayer/mixerClick.ts';
import { mixerSession, type MixerHold } from '../stemPlayer/mixerSession.ts';
import {
  SCRUB_SEEK_DELAY_MS,
  type StemPlayerActions,
  type StemPlayerStatus,
} from '../stemPlayer/store.ts';
import { framesToSeconds, secondsToFrames } from '../stemPlayer/time.ts';
import {
  songLibraryStore,
  type SongLibraryState,
} from '../songLibrary/store.ts';
import { getSongPlayer, type SongPlayerRuntime } from './runtime.ts';

const SONG_TRACK = 0;
const ATTACHABLE: ReadonlySet<StemPlayerStatus> = new Set(['loading', 'ready']);
// Sub-frame rounding from a rate change must never rewrite the stored length.
export const STORED_LENGTH_TOLERANCE_SEC = 0.01;

interface SongPlayerState extends TransportSlice, ClickSlice, LoopSlice {
  readonly songId: number | null;
  readonly bpm: number | null;
  readonly analysisStatus: AnalysisStatus;
  readonly envelope: readonly number[] | null;
}

interface SongSession {
  readonly hold: MixerHold;
  readonly loaded: Promise<void>;
}

type SongPlayerActions = Pick<
  StemPlayerActions,
  | 'togglePlay'
  | 'scrub'
  | 'cancelScrub'
  | 'seek'
  | 'skip'
  | 'markLoop'
  | 'toggleClick'
> & {
  readonly open: (songId: number, waveformBars: number) => SongSession;
  readonly close: () => void;
};

export type SongPlayerStore = SongPlayerState & SongPlayerActions;

export type SongLibraryRows = Pick<
  StoreApi<Pick<SongLibraryState, 'rows' | 'ready' | 'failed'>>,
  'subscribe'
>;

interface SongPlayerOptions {
  readonly scrubSeekDelayMs?: number;
  readonly mixerClaim?: MixerClaim;
  readonly library?: SongLibraryRows;
  readonly mixerClick?: MixerClick;
}

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
  downbeatIndices: [],
  envelope: null,
  loop: { kind: 'off' },
  loopFailure: null,
  click: false,
};

type SongFacts = Pick<
  SongRecord,
  'title' | 'artist' | 'bpm' | 'analysisStatus'
>;

function namesOf(record: Pick<SongFacts, 'title' | 'artist'>) {
  return {
    title: record.title,
    artist: record.artist === '' ? null : record.artist,
  };
}

function factsOf(record: SongFacts): Partial<SongPlayerState> {
  return {
    ...namesOf(record),
    bpm: record.bpm,
    analysisStatus: record.analysisStatus,
  };
}

function songDownbeats(record: SongRecord): readonly number[] {
  return overrideDownbeats(record, record);
}

export function createSongPlayerStore(
  runtimeOf: () => SongPlayerRuntime = getSongPlayer,
  options: SongPlayerOptions = {},
): StoreApi<SongPlayerStore> {
  const {
    scrubSeekDelayMs = SCRUB_SEEK_DELAY_MS,
    mixerClaim: claim = createMixerClaim(),
    library,
    mixerClick: songClick = createMixerClick(),
  } = options;
  let trackRequested = false;
  let masterToRestore: number | null = null;
  let loading: Promise<void> = Promise.resolve();
  let holders = 0;
  let waveformBars = 0;
  let shownWaveform: string | null = null;
  let latestWaveform: string | null = null;

  const teardownTracks = () => {
    const { commands } = runtimeOf();
    if (trackRequested) commands.mixerUnloadTrack(SONG_TRACK);
    trackRequested = false;
    if (masterToRestore !== null) commands.mixerSetMasterGain(masterToRestore);
    masterToRestore = null;
  };

  return createStore<SongPlayerStore>((set, get) => {
    const mixer = mixerSession({
      set,
      get,
      runtimeOf,
      scrubSeekDelayMs,
      claim,
      mixerClick: songClick,
      isOpen: () => get().songId !== null,
      teardownTracks,
      resetState: () => {
        set(closedState);
      },
    });
    const { live, scrubSeek } = mixer;

    const sharedHold = (opened: number): MixerHold => {
      const own = mixer.hold(opened);
      let held = true;
      holders++;
      return {
        live: own.live,
        release: () => {
          if (!held || !own.live()) return;
          held = false;
          holders--;
          const outlivesPlayer = get().status === 'ready';
          if (holders === 0 && !outlivesPlayer) own.release();
        },
      };
    };
    const context = { set, get, runtimeOf, session: mixer.current };

    const showWaveform = (opened: number, path: string | null) => {
      if (path === null || path === shownWaveform || path === latestWaveform)
        return;
      latestWaveform = path;
      runtimeOf()
        .readWaveform(path, waveformBars)
        .then((envelope) => {
          if (!live(opened) || path !== latestWaveform) return;
          shownWaveform = path;
          set({ envelope });
        })
        .catch((error: unknown) => {
          if (path === latestWaveform) latestWaveform = null;
          console.warn('[kitbag] song waveform unreadable', error);
        });
    };

    const correctStoredLength = (record: SongRecord, decodedSec: number) => {
      const driftSec = Math.abs(decodedSec - record.durationSec);
      if (driftSec <= STORED_LENGTH_TOLERANCE_SEC) return;
      void runtimeOf().library.correctDuration(record.id, decodedSec);
    };

    const unshiftKey = async (opened: number) => {
      const { commands } = runtimeOf();
      const key = await commands.mixerTrackPitch(SONG_TRACK);
      if (!live(opened)) return false;
      if (key === UNSHIFTED_KEY) return true;
      return mixer.awaitReset(
        opened,
        commands.mixerSetTrackPitch(SONG_TRACK, UNSHIFTED_KEY),
      );
    };

    const load = async (opened: number, songId: number) => {
      const runtime = runtimeOf();
      const { commands } = runtime;
      const record = await runtime.records.readSong(songId);
      if (!live(opened)) return;
      if (record === undefined) {
        set({ status: 'missing' });
        return;
      }
      set(factsOf(record));
      const engineRate = await mixer.startEngine(opened);
      if (engineRate === null) return;
      if (!(await mixer.clearSessionLeftovers(opened))) return;
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
      if (!(await unshiftKey(opened))) return;
      const decoded = await commands.mixerTrackFrames(SONG_TRACK);
      if (!live(opened)) return;
      const durationFrames =
        decoded > 0 ? decoded : secondsToFrames(record.durationSec, engineRate);
      if (durationFrames <= 0) {
        set({ status: 'failed' });
        return;
      }
      set({
        status: 'ready',
        engineRate,
        durationFrames,
        beats: record.beats,
        downbeatIndices: songDownbeats(record),
      });
      if (decoded > 0)
        correctStoredLength(record, framesToSeconds(decoded, engineRate));
      showWaveform(opened, record.waveformPath);
    };

    const endAsGone = () => {
      mixer.close();
      set({ status: 'missing' });
    };

    const followAnalysis = (opened: number, record: SongRecord) => {
      const { status, beats, downbeatIndices } = get();
      const ready = status === 'ready';
      const downbeats = songDownbeats(record);
      const regrid =
        ready &&
        !(
          sameNumbers(beats, record.beats) &&
          sameNumbers(downbeatIndices, downbeats)
        );
      set({
        ...factsOf(record),
        ...(regrid ? { beats: record.beats, downbeatIndices: downbeats } : {}),
      });
      if (ready) showWaveform(opened, record.waveformPath);
      if (regrid) void followNewGrid(context);
    };

    const refreshFacts = async (opened: number, songId: number) => {
      const record = await runtimeOf().records.readSong(songId);
      if (!live(opened)) return;
      if (record === undefined) endAsGone();
      else followAnalysis(opened, record);
    };

    const reread = (opened: number, songId: number) => {
      loading = loading
        .then(() => refreshFacts(opened, songId))
        .catch((error: unknown) => {
          console.warn('[kitbag] song facts unreadable', error);
        });
      return loading;
    };

    const followLibrary = (rows: readonly LibraryRow[]) => {
      const { songId } = get();
      if (songId === null) return;
      const row = rows.find(
        (candidate): candidate is LibrarySongRow =>
          candidate.kind === 'song' && candidate.id === songId,
      );
      if (row === undefined) {
        endAsGone();
        return;
      }
      set(namesOf(row));
      void reread(mixer.current(), songId);
    };

    library?.subscribe((state, previous) => {
      if (state.rows === previous.rows || !state.ready || state.failed) return;
      followLibrary(state.rows);
    });

    return {
      ...closedState,
      open: (songId, bars) => {
        const { songId: current, status } = get();
        if (current === songId && ATTACHABLE.has(status)) {
          const opened = mixer.current();
          const hold = sharedHold(opened);
          return { hold, loaded: reread(opened, songId) };
        }
        const opened = mixer.begin();
        holders = 0;
        waveformBars = bars;
        shownWaveform = null;
        latestWaveform = null;
        set({ ...closedState, status: 'loading', songId });
        loading = load(opened, songId).catch((error: unknown) => {
          console.warn('[kitbag] song failed to open', error);
          if (live(opened)) set({ status: 'failed' });
        });
        return { hold: sharedHold(opened), loaded: loading };
      },
      close: mixer.close,
      ...transportActions(get, runtimeOf, scrubSeek),
      ...loopActions(context),
      ...clickActions(context, mixer.pendingClick),
    };
  });
}

export const songPlayerStore = createSongPlayerStore(getSongPlayer, {
  mixerClaim,
  library: songLibraryStore,
  mixerClick,
});
