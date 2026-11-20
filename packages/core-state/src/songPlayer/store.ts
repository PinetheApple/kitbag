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
import { ATTACHABLE, mixerSession } from '../stemPlayer/mixerSession.ts';
import { previousPresses } from '../stemPlayer/previousPresses.ts';
import {
  ADVANCE_CAUSE,
  endedOnLastFrame,
  songEnds,
  startSong,
} from '../stemPlayer/songEnd.ts';
import { SCRUB_SEEK_DELAY_MS } from '../stemPlayer/store.ts';
import { framesToSeconds, secondsToFrames } from '../stemPlayer/time.ts';
import {
  songLibraryStore,
  type SongLibraryState,
} from '../songLibrary/store.ts';
import { getSongPlayer, type SongPlayerRuntime } from './runtime.ts';
import { playheadBeatSeconds } from './playheadBeat.ts';
import { songCard } from './songCard.ts';
import { countingNow, songCount } from './songCount.ts';
import { songSpeed } from './songSpeed.ts';
import { songWaveform } from './songWaveform.ts';
import {
  linkedPreset,
  readyState,
  songPresetActions,
  type LoadedSong,
} from './songPreset.ts';
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
    const counting = countingNow(get, runtimeOf);
    const clickEngine = songClickEngine({ set, get, metronome, counting });
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
      beforeTeardown: () => {
        if (counting()) clickEngine.countDropped();
      },
      teardownTracks,
      counting,
      followsPlayOrder: true,
      resetState: () => {
        set(closedState);
      },
    });
    const { live, scrubSeek } = mixer;
    const ends = songEnds(
      () => endedOnLastFrame(get(), runtimeOf().engine, counting()),
      mixer.current,
    );
    mixer.onSongEnded(ends.reported);

    mixer.onLastRelease({ keepsSong: () => get().status === 'ready' });
    const context = { set, get, runtimeOf, session: mixer.current };
    const presets = songPresetActions({ ...context, live });
    const previous = previousPresses(mixer.current);
    const count = songCount(context, mixer, api, clickEngine, {
      next: ends.pressedNext,
      previous: previous.pressed,
    });
    const gridFollowers = { gridReplaced: count.gridReplaced };
    const card = songCard({
      ...context,
      close: mixer.close,
      cardStopped: mixer.cardStopped,
      start: count,
      card: mixer.card,
    });
    const speed = songSpeed(context, count.rateSet);
    mixer.onSongStopped(() => {
      ends.stopped();
      card.stopped();
    });

    const waveform = songWaveform({ set, runtimeOf, live });

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

    const becomeReady = async (opened: number, loaded: LoadedSong) => {
      detectedGrid = loaded.record;
      set(readyState(loaded, get().clickSettings));
      waveform.show(opened, loaded.record.waveformPath);
      if (loaded.preset !== undefined && !get().click)
        await get().toggleClick();
    };

    const load = async (opened: number, songId: number) => {
      const runtime = runtimeOf();
      const { commands } = runtime;
      const [record, preset] = await Promise.all([
        runtime.records.readSong(songId),
        linkedPreset(runtime, songId),
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
      if (!(await speed.opening(opened, record.speed, mixer.applyOpeningRate)))
        return;
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
      if (decoded > 0)
        correctStoredLength(record, framesToSeconds(decoded, engineRate));
      await becomeReady(opened, { record, preset, engineRate, durationFrames });
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
      if (regrid) void followNewGrid(context, gridFollowers);
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
      if (ready) waveform.show(opened, record.waveformPath);
      if (regrid) void followNewGrid(context, gridFollowers);
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

    const begin = (songId: number, bars: number) => {
      const opened = mixer.begin();
      detectedGrid = NO_GRID;
      heldCorrection = null;
      waveform.reset(bars);
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
      return opened;
    };

    return {
      ...closedState,
      open: (songId, bars) => {
        const { songId: current, status } = get();
        if (current === songId && ATTACHABLE.has(status)) {
          const opened = mixer.current();
          const hold = mixer.hold(opened);
          return { hold, loaded: reread(opened, songId) };
        }
        const opened = begin(songId, bars);
        return { hold: mixer.hold(opened), loaded: loading };
      },
      takeOver: (songId, bars) =>
        startSong(
          {
            ends,
            begin: (id) => begin(id, bars),
            load: () => loading,
            live,
            ready: () => get().status === 'ready',
            play: () => {
              get().togglePlay();
            },
          },
          songId,
        ),
      handOver: mixer.handOver,
      pressNext: () => {
        ends.pressedNext(mixer.current(), ADVANCE_CAUSE.nextInApp);
      },
      pressPrevious: () => {
        previous.pressed(mixer.current(), true);
      },
      onPrevious: previous.subscribe,
      onSongEnd: ends.subscribe,
      songStillEnded: ends.stands,
      stopAdvancing: () => {
        if (!ends.gaveUp()) return;
        if (mixer.hasHolders()) runtimeOf().commands.songTransportHide();
        else mixer.close();
      },
      handToMetronome: () => {
        runtimeOf().sharedMetronome.showStopped();
        mixer.close();
      },
      close: mixer.close,
      onCardStop: mixer.onCardStop,
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
      playheadBeatSeconds: () => playheadBeatSeconds(get(), runtimeOf()),
      playheadSeconds: () =>
        framesToSeconds(runtimeOf().engine.position(), get().engineRate),
      dismissMeterNotice: () => {
        set({ meterNotice: null });
      },
      ...transportActions(
        get,
        runtimeOf,
        mixer.card,
        scrubSeek,
        count.afterSeek,
        card.start,
      ),
      ...loopActions(context),
      ...clickActions(context, mixer.pendingClick, {
        recountWithClickOff: count.recountWithClickOff,
        recountWithClickOn: count.recountWithClickOn,
        clickStarting: clickEngine.clickStarting,
      }),
      ...clickSettings.actions,
      saveForSong: presets.saveForSong,
      ...speed.actions,
    };
  });
}

export const songPlayerStore = createSongPlayerStore(getSongPlayer, {
  mixerClaim,
  library: songLibraryStore,
  mixerClick,
});
