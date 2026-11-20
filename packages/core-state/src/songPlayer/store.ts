import {
  correctedBpm,
  meterOverrideOf,
  type LibraryRow,
  type LibrarySongRow,
  type SongRecord,
  type TempoCorrection,
} from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { transportActions } from '../stemPlayer/actions.ts';
import { clickActions, followNewGrid } from '../stemPlayer/clickActions.ts';
import { snapToBeat } from '../stemPlayer/loop.ts';
import { loopActions } from '../stemPlayer/loopActions.ts';
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
  type StemPlayerStatus,
} from '../stemPlayer/store.ts';
import { framesToSeconds, secondsToFrames } from '../stemPlayer/time.ts';
import {
  songLibraryStore,
  type SongLibraryState,
} from '../songLibrary/store.ts';
import { getSongPlayer, type SongPlayerRuntime } from './runtime.ts';
import { songCard } from './songCard.ts';
import { clickSettingsOf, songPresetActions } from './songPreset.ts';
import type { SongPlayerActions } from './actions.ts';
import {
  songClickActions,
  songClickEngine,
  standaloneMetronome,
  type SongClickMetronome,
} from './songClick.ts';
import {
  NO_GRID,
  overrideDisagrees,
  recordGrid,
  sameGrid,
  songGrid,
  type SongGrid,
} from './songGrid.ts';
import {
  closedState,
  factsOf,
  namesOf,
  shownGrid,
  type SongPlayerState,
} from './state.ts';

const SONG_TRACK = 0;
const ATTACHABLE: ReadonlySet<StemPlayerStatus> = new Set(['loading', 'ready']);
// Sub-frame rounding from a rate change must never rewrite the stored length.
export const STORED_LENGTH_TOLERANCE_SEC = 0.01;

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
  readonly metronome?: SongClickMetronome;
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
    metronome = standaloneMetronome,
  } = options;
  let trackRequested = false;
  let masterToRestore: number | null = null;
  let loading: Promise<void> = Promise.resolve();
  let holders = 0;
  let waveformBars = 0;
  let shownWaveform: string | null = null;
  let latestWaveform: string | null = null;
  let detectedGrid = NO_GRID;
  // Set while a picked factor is saving, so a re-read cannot bring back an older one.
  let heldCorrection: TempoCorrection | null = null;

  const teardownTracks = () => {
    const { commands } = runtimeOf();
    if (trackRequested) commands.mixerUnloadTrack(SONG_TRACK);
    trackRequested = false;
    if (masterToRestore !== null) commands.mixerSetMasterGain(masterToRestore);
    masterToRestore = null;
  };

  return createStore<SongPlayerStore>((set, get, api) => {
    const clickEngine = songClickEngine({ set, get, metronome });
    const clickSettings = songClickActions({ set, get, metronome });
    api.subscribe(clickEngine.followSong);
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
    const presets = songPresetActions({ ...context, metronome, live });
    const card = songCard({ ...context, close: mixer.close });
    mixer.onSongStopped(card.stopped);

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
      const [record, preset] = await Promise.all([
        runtime.records.readSong(songId),
        runtime.records.forLibrarySong(songId),
      ]);
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
      detectedGrid = record;
      const grid = recordGrid(record);
      set({
        status: 'ready',
        engineRate,
        durationFrames,
        beats: grid.beats,
        downbeatIndices: grid.downbeatIndices,
        detected: grid.detected,
        meterOverride: meterOverrideOf(record),
      });
      if (preset !== undefined)
        set({ clickSettings: clickSettingsOf(preset, get()) });
      if (decoded > 0)
        correctStoredLength(record, framesToSeconds(decoded, engineRate));
      showWaveform(opened, record.waveformPath);
      if (preset !== undefined) await get().toggleClick();
    };

    const isOpenAndReady = (songId: number) => {
      const { status, songId: openSong } = get();
      return status === 'ready' && openSong === songId;
    };

    const showGrid = (grid: SongGrid, facts: Partial<SongPlayerState>) => {
      const regrid = !sameGrid(get(), grid);
      set({
        ...facts,
        detected: grid.detected,
        ...(regrid ? shownGrid(grid) : {}),
      });
      if (regrid) void followNewGrid(context);
    };

    const endAsGone = () => {
      mixer.close();
      set({ status: 'missing' });
    };

    const followAnalysis = (opened: number, stored: SongRecord) => {
      const record =
        heldCorrection === null
          ? stored
          : { ...stored, tempoCorrection: heldCorrection };
      const ready = get().status === 'ready';
      const grid = recordGrid(record);
      const regrid = ready && !sameGrid(get(), grid);
      const reanalysed = ready && !sameGrid(detectedGrid, record);
      if (ready) detectedGrid = record;
      const notice = reanalysed && overrideDisagrees(record);
      set({
        ...factsOf(record),
        ...(ready
          ? { meterOverride: meterOverrideOf(record), detected: grid.detected }
          : {}),
        ...(notice ? { meterNotice: grid.detected } : {}),
        ...(regrid ? shownGrid(grid) : {}),
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
      card.named(namesOf(row));
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
        detectedGrid = NO_GRID;
        heldCorrection = null;
        waveformBars = bars;
        shownWaveform = null;
        latestWaveform = null;
        set({
          ...closedState,
          ...clickSettings.seeded(closedState),
          status: 'loading',
          songId,
        });
        loading = load(opened, songId).catch((error: unknown) => {
          console.warn('[kitbag] song failed to open', error);
          if (live(opened)) set({ status: 'failed' });
        });
        return { hold: sharedHold(opened), loaded: loading };
      },
      close: mixer.close,
      meterOverrideChanged: (songId, override) => {
        if (!isOpenAndReady(songId)) return;
        const meterOverride = meterOverrideOf(override);
        showGrid(songGrid(detectedGrid, meterOverride, get().tempoCorrection), {
          meterOverride,
          meterNotice: null,
        });
      },
      tempoCorrectionChanged: (songId, tempoCorrection) => {
        if (!isOpenAndReady(songId)) return;
        heldCorrection = tempoCorrection;
        showGrid(songGrid(detectedGrid, get().meterOverride, tempoCorrection), {
          tempoCorrection,
          bpm: correctedBpm(get().detectedBpm, tempoCorrection),
        });
      },
      tempoCorrectionSettled: (songId) => {
        if (get().songId === songId) heldCorrection = null;
      },
      playheadBeatSeconds: () => {
        const { beats, engineRate } = get();
        const playhead = framesToSeconds(
          runtimeOf().engine.position(),
          engineRate,
        );
        return beats.length === 0 ? null : snapToBeat(playhead, beats);
      },
      dismissMeterNotice: () => {
        set({ meterNotice: null });
      },
      ...transportActions(get, runtimeOf, scrubSeek, undefined, card.start),
      ...loopActions(context),
      ...clickActions(context, mixer.pendingClick, {
        clickStarting: clickEngine.clickStarting,
      }),
      ...clickSettings.actions,
      saveForSong: presets.saveForSong,
    };
  });
}

export const songPlayerStore = createSongPlayerStore(getSongPlayer, {
  mixerClaim,
  library: songLibraryStore,
  mixerClick,
});
