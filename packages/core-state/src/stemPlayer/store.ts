import {
  meterOverrideOf,
  type BundleTempo,
  type ClickRate,
  type MeterOverride,
  type StemSetRecord,
  type StoredSection,
  type TempoMode,
} from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { mixActions, transportActions } from './actions.ts';
import { sameNumbers } from './bars.ts';
import { clickActions, followNewGrid, releaseClick } from './clickActions.ts';
import { clickShapeActions } from './clickShape.ts';
import { closedState } from './closedState.ts';
import {
  exportActions,
  exportAfterLeaving,
  NO_EXPORT,
  type ExportActions,
  type ExportSlice,
} from './exportActions.ts';
import type { SongFacts } from './facts.ts';
import type { LoopEdge, LoopSeconds } from './loop.ts';
import { sectionLoopActions } from './loopActions.ts';
import { overrideDownbeats } from './meterOverride.ts';
import { songLyrics, type RetimeTap, type SongLyrics } from './lyrics.ts';
import { createMixerClaim, mixerClaim, type MixerClaim } from './mixerClaim.ts';
import { createMixerClick, mixerClick, type MixerClick } from './mixerClick.ts';
import { mixerSession, type MixerHold } from './mixerSession.ts';
import { mixSaver } from './mixSaver.ts';
import { stemSongHolds } from './stemSongHolds.ts';
import {
  showCountOnSongCard,
  songTransportRequests,
} from './notificationTransport.ts';
import { renameActions } from './renameActions.ts';
import { retimeActions, retimeAnchor } from './retimeActions.ts';
import { getStemPlayer, type StemPlayerRuntime } from './runtime.ts';
import { sortedSections } from './sections.ts';
import {
  advanceSong,
  endedOnLastFrame,
  songEnds,
  type AdvanceListener,
  type AdvanceOutcome,
} from './songEnd.ts';
import { countPending, songStart } from './songStart.ts';
import {
  loadTracks,
  loadWaveforms,
  rowsOf,
  unloadTracks,
} from './stemTracks.ts';
import { clampedSpeed, wholeKey } from './speedKey.ts';
import { speedKeySession } from './speedKeyActions.ts';
import { songGrid, tempoActions } from './tempoActions.ts';
import { longestSeconds, tempoModeOf } from './tempoGrid.ts';
import { framesToSeconds, secondsToFrames } from './time.ts';

const MIX_SAVE_DELAY_MS = 600;
export const SCRUB_SEEK_DELAY_MS = 120;

export interface StemRow {
  readonly id: number;
  readonly name: string;
  readonly role: string;
  readonly transposable: boolean;
  readonly key: number;
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

export type RetimeState =
  | { readonly kind: 'off' }
  | {
      readonly kind: 'recording';
      readonly taps: readonly RetimeTap[];
      readonly nextLine: number;
      readonly shiftSteps: number;
      readonly playbackRate: number | null;
    };

export type StemPlayerStatus =
  'idle' | 'loading' | 'ready' | 'missing' | 'failed';

export type LoopFailure = 'tooShort' | 'pastEnd' | 'engine';

export type RetimeFailure = 'notStored';

export interface StemPlayerState {
  readonly status: StemPlayerStatus;
  readonly setId: number | null;
  readonly title: string;
  readonly artist: string | null;
  readonly facts: SongFacts;
  readonly recordedFacts: SongFacts;
  readonly speed: number;
  readonly songKey: number;
  readonly stems: readonly StemRow[];
  readonly overLimit: number;
  readonly masterGain: number;
  readonly engineRate: number;
  readonly durationFrames: number;
  readonly beats: readonly number[];
  readonly downbeatIndices: readonly number[];
  readonly meterOverride: MeterOverride;
  readonly detectedMeter: number;
  readonly detectedBarOneSeconds: number;
  readonly tempo: BundleTempo | null;
  readonly tempoMode: TempoMode | null;
  readonly loop: LoopState;
  readonly loopFailure: LoopFailure | null;
  readonly undoableLoop: LoopSeconds | null;
  readonly click: boolean;
  readonly clickGrouping: readonly number[];
  readonly clickRate: ClickRate;
  readonly countEndFrame: number | null;
  readonly countBeatsPerBar: number;
  readonly advancedTo: number | null;
  readonly advanceCountEnd: number | null;
  readonly sections: readonly StoredSection[];
  readonly lyrics: SongLyrics;
  readonly retime: RetimeState;
  readonly retimeFailure: RetimeFailure | null;
}

export interface StemPlayerActions {
  readonly open: (setId: number, waveformBars: number) => Promise<void>;
  readonly acquireSong: (setId: number, waveformBars: number) => MixerHold;
  readonly advanceTo: (setId: number) => Promise<AdvanceOutcome>;
  readonly onSongEnd: (listener: AdvanceListener) => () => void;
  readonly songStillEnded: () => boolean;
  readonly stopAdvancing: () => void;
  readonly handToMetronome: () => void;
  readonly close: () => void;
  readonly onCardStop: (listener: () => void) => () => void;
  readonly setGain: (index: number, gain: number) => void;
  readonly toggleMute: (index: number) => void;
  readonly solo: (index: number, additive: boolean) => void;
  readonly setMasterGain: (gain: number) => void;
  readonly resetMix: () => void;
  readonly setSpeed: (speed: number) => Promise<void>;
  readonly setSongKey: (key: number) => Promise<void>;
  readonly setStemKey: (index: number, key: number) => Promise<void>;
  readonly resetSpeedKey: () => Promise<void>;
  readonly togglePlay: () => void;
  readonly scrub: (frame: number) => void;
  readonly cancelScrub: () => void;
  readonly seek: (frame: number) => void;
  readonly skip: (seconds: number) => void;
  readonly markLoop: () => Promise<void>;
  readonly moveLoopEdge: (edge: LoopEdge, seconds: number) => Promise<void>;
  readonly undoLoop: () => Promise<void>;
  readonly dismissLoopUndo: () => void;
  readonly jumpToSection: (index: number) => Promise<void>;
  readonly loopSection: (index: number) => Promise<void>;
  readonly beginRetime: (fromLine: number) => void;
  readonly tapRetime: () => void;
  readonly undoRetimeTap: () => void;
  readonly shiftRetime: (steps: number) => void;
  readonly commitRetime: () => Promise<void>;
  readonly cancelRetime: () => void;
  readonly leaveRetime: () => void;
  readonly resetRetime: () => Promise<void>;
  readonly toggleClick: () => Promise<void>;
  readonly setClickGrouping: (groups: readonly number[]) => Promise<void>;
  readonly setClickRate: (rate: ClickRate) => Promise<void>;
  readonly setTempoMode: (mode: TempoMode) => Promise<void>;
  readonly renameStem: (index: number, name: string) => Promise<void>;
  readonly meterOverrideChanged: (
    setId: number,
    override: MeterOverride,
  ) => void;
  readonly saveMeterOverride: (
    setId: number,
    override: MeterOverride,
  ) => Promise<void>;
  readonly playheadSeconds: () => number;
}

export type StemPlayerStore = StemPlayerState &
  ExportSlice &
  StemPlayerActions &
  ExportActions;
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

export interface StemPlayerOptions extends Partial<StemPlayerTiming> {
  readonly mixerClaim?: MixerClaim;
  readonly mixerClick?: MixerClick;
}

export function createStemPlayerStore(
  runtimeOf: () => StemPlayerRuntime = getStemPlayer,
  options: StemPlayerOptions = {},
): StoreApi<StemPlayerStore> {
  const {
    mixSaveDelayMs = MIX_SAVE_DELAY_MS,
    scrubSeekDelayMs = SCRUB_SEEK_DELAY_MS,
    mixerClaim: claim = createMixerClaim(),
    mixerClick: songClick = createMixerClick(),
  } = options;
  let requestedTracks = 0;
  let markedDownbeatIndices: readonly number[] = [];
  let openRecord: StemSetRecord | null = null;
  let waveformBars = 0;
  const saver = mixSaver(
    (mixes) => runtimeOf().records.saveStemMix(mixes),
    mixSaveDelayMs,
  );

  const teardownTracks = () => {
    unloadTracks(runtimeOf().commands, requestedTracks);
    requestedTracks = 0;
  };

  return createStore<StemPlayerStore>((set, get, store) => {
    const mixer = mixerSession({
      set,
      get,
      runtimeOf,
      scrubSeekDelayMs,
      claim,
      mixerClick: songClick,
      isOpen: () => get().setId !== null,
      beforeTeardown: () => {
        saver.flush();
        get().leaveRetime();
      },
      teardownTracks,
      counting: () =>
        countPending(get().countEndFrame, runtimeOf().engine.nowFrame()),
      followsPlayOrder: true,
      resetState: () => {
        set({
          ...closedState,
          exportState: exportAfterLeaving(get().exportState),
        });
      },
    });
    const { live, scrubSeek } = mixer;
    const context: ActionContext = {
      set,
      get,
      runtimeOf,
      session: mixer.current,
    };
    const start = songStart({
      ...context,
      releaseClick: () => releaseClick(context),
    });
    mixer.onScrubSeek(start.afterSeek);
    mixer.onClickReleased(start.endCountNow);
    const card = showCountOnSongCard(
      store,
      runtimeOf,
      start.counting,
      mixer.card,
    );
    const ends = songEnds(
      () => endedOnLastFrame(get(), runtimeOf().engine, start.counting()),
      mixer.current,
    );
    mixer.onSongEnded(ends.reported);
    const holds = stemSongHolds({ mixer, get, ends, runtimeOf, start });
    holds.onCardStop(() => {
      card.stopped();
      start.songStopped();
    });
    mixer.onSongTransport(
      songTransportRequests({
        get,
        runtimeOf,
        counting: start.counting,
        stopCount: () => {
          card.stopped();
          start.stop();
        },
        next: ends.pressedNext,
      }),
    );
    const speedKey = speedKeySession(context, start.rateSet, () => openRecord);
    const clickShape = clickShapeActions(context);
    const clicks = clickActions(context, mixer.pendingClick, {
      recountWithClickOff: start.recountWithClickOff,
      recountWithClickOn: start.recountWithClickOn,
      gridSent: clickShape.gridSent,
    });
    const songDownbeats = (beats: readonly number[], override: MeterOverride) =>
      overrideDownbeats(
        { beats, downbeatIndices: markedDownbeatIndices },
        override,
      );
    const followers = {
      gridReplaced: start.gridReplaced,
      gridSent: clickShape.gridSent,
    };
    const applyGrid = (mode: TempoMode) => {
      if (openRecord === null) return;
      const { marked, state } = songGrid(
        openRecord,
        mode,
        get().meterOverride,
        speedKey.shift(),
      );
      markedDownbeatIndices = marked;
      set(state);
      void followNewGrid(context, followers);
    };
    const anchorRetime = retimeAnchor(context);
    const afterSeek = (frame: number) => {
      anchorRetime(frame);
      start.afterSeek(frame);
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
      const engineRate = await mixer.startEngine(opened);
      if (engineRate === null) return;
      if (!(await mixer.clearSessionLeftovers(opened))) return;
      const speed = await mixer.applyOpeningRate(
        opened,
        clampedSpeed(record.speed),
      );
      if (speed === null) return;
      speedKey.persisted.speed = record.speed;
      start.rateSet(speed);
      const songKey = wholeKey(record.pitch);
      const rows = rowsOf(record);
      requestedTracks = rows.length;
      const stems = await loadTracks(runtime, record, rows, () => live(opened));
      const masterGain = await commands.mixerMasterGain();
      if (!live(opened)) return;
      openRecord = record;
      const override = meterOverrideOf(record);
      const grid = songGrid(record, tempoModeOf(record), override, {
        speed,
        key: songKey,
      });
      markedDownbeatIndices = grid.marked;
      set({
        status: 'ready',
        title: record.songTitle ?? record.title,
        artist: record.artist,
        ...grid.state,
        meterOverride: override,
        speed,
        songKey,
        tempo: record.tempo,
        stems,
        overLimit: record.stems.length - rows.length,
        masterGain,
        engineRate,
        durationFrames: secondsToFrames(longestSeconds(record), engineRate),
        clickGrouping: record.clickGrouping,
        clickRate: record.clickRate,
        sections: sortedSections(record.sections),
        lyrics: songLyrics(record.lyrics, record.lyricsRetimed),
      });
      loadWaveforms(context, () => live(opened), record, bars);
    };

    const showLoading = (setId: number, advancedTo: number | null = null) => {
      set({
        ...closedState,
        exportState: exportAfterLeaving(get().exportState),
        status: 'loading',
        setId,
        advancedTo,
      });
    };

    const loadSession = async (opened: number, setId: number, bars: number) => {
      waveformBars = bars;
      try {
        await load(opened, setId, bars);
      } catch (error: unknown) {
        console.warn('[kitbag] stem song failed to open', error);
        if (live(opened)) set({ status: 'failed' });
      }
    };

    return {
      ...closedState,
      exportState: NO_EXPORT,
      open: async (setId, bars) => {
        const opened = mixer.begin();
        showLoading(setId);
        await loadSession(opened, setId, bars);
      },
      acquireSong: (setId, bars) => {
        if (holds.joins(setId)) return mixer.holdAgain();
        const acquired = mixer.begin();
        showLoading(setId);
        void loadSession(acquired, setId, bars);
        return mixer.hold(acquired);
      },
      advanceTo: (setId) =>
        advanceSong(
          {
            ends,
            begin: (id) => {
              const opened = mixer.advance();
              showLoading(id, id);
              return opened;
            },
            load: (opened, id) => loadSession(opened, id, waveformBars),
            live,
            ready: () => get().status === 'ready',
            play: () => {
              get().togglePlay();
              set({ advanceCountEnd: get().countEndFrame });
            },
          },
          setId,
        ),
      onSongEnd: ends.subscribe,
      songStillEnded: ends.stands,
      stopAdvancing: holds.gaveUp,
      handToMetronome: () => {
        runtimeOf().sharedMetronome.showStopped();
        mixer.close();
      },
      close: mixer.close,
      onCardStop: mixer.onCardStop,
      ...mixActions(set, get, runtimeOf, saver),
      ...transportActions(
        get,
        runtimeOf,
        mixer.card,
        scrubSeek,
        afterSeek,
        start,
      ),
      ...sectionLoopActions(context),
      ...clicks,
      ...clickShape.actions,
      ...renameActions(context),
      ...tempoActions(context, applyGrid),
      ...retimeActions(context, claim.defer, start, speedKey.rates),
      ...speedKey.actions,
      meterOverrideChanged: (setId, override) => {
        const { status, setId: openSet, beats, downbeatIndices } = get();
        if (status !== 'ready' || openSet !== setId) return;
        const meterOverride = meterOverrideOf(override);
        const downbeats = songDownbeats(beats, meterOverride);
        if (sameNumbers(downbeats, downbeatIndices)) {
          set({ meterOverride });
          return;
        }
        set({ meterOverride, downbeatIndices: downbeats });
        void followNewGrid(context, followers);
      },
      ...exportActions(context),
      saveMeterOverride: (setId, override) =>
        runtimeOf().records.saveStemSetMeterOverride(setId, override),
      playheadSeconds: () =>
        framesToSeconds(runtimeOf().engine.position(), get().engineRate),
    };
  });
}

export const stemPlayerStore = createStemPlayerStore(getStemPlayer, {
  mixerClaim,
  mixerClick,
});
