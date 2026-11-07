import type { StemSetRecord, StoredSection } from '@kitbag/core-db';
import { KB_MAX_TRACKS, KB_RESULT } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { mixActions, transportActions } from './actions.ts';
import { clickActions } from './clickActions.ts';
import { NO_SONG_FACTS, songFacts, type SongFacts } from './facts.ts';
import type { LoopSeconds } from './loop.ts';
import { sectionLoopActions } from './loopActions.ts';
import {
  NO_LYRICS,
  songLyrics,
  type RetimeTap,
  type SongLyrics,
} from './lyrics.ts';
import { UNITY_GAIN } from './mix.ts';
import { createMixerClaim, mixerClaim, type MixerClaim } from './mixerClaim.ts';
import { mixerSession } from './mixerSession.ts';
import { mixSaver } from './mixSaver.ts';
import { renameActions } from './renameActions.ts';
import { retimeActions, retimeAnchor } from './retimeActions.ts';
import type { MixerHold } from './screenHold.ts';
import { getStemPlayer, type StemPlayerRuntime } from './runtime.ts';
import { sortedSections } from './sections.ts';
import { secondsToFrames } from './time.ts';

const MIX_SAVE_DELAY_MS = 600;
export const SCRUB_SEEK_DELAY_MS = 120;

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

export type RetimeState =
  | { readonly kind: 'off' }
  | {
      readonly kind: 'recording';
      readonly taps: readonly RetimeTap[];
      readonly nextLine: number;
      readonly shiftSteps: number;
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
  readonly stems: readonly StemRow[];
  readonly overLimit: number;
  readonly masterGain: number;
  readonly engineRate: number;
  readonly durationFrames: number;
  readonly beats: readonly number[];
  readonly loop: LoopState;
  readonly loopFailure: LoopFailure | null;
  readonly undoableLoop: LoopSeconds | null;
  readonly click: boolean;
  readonly sections: readonly StoredSection[];
  readonly lyrics: SongLyrics;
  readonly retime: RetimeState;
  readonly retimeFailure: RetimeFailure | null;
}

export interface StemPlayerActions {
  readonly open: (setId: number, waveformBars: number) => Promise<void>;
  readonly acquireSong: (setId: number, waveformBars: number) => MixerHold;
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

export interface StemPlayerOptions extends Partial<StemPlayerTiming> {
  readonly mixerClaim?: MixerClaim;
}

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
  undoableLoop: null,
  click: false,
  sections: [],
  lyrics: NO_LYRICS,
  retime: { kind: 'off' },
  retimeFailure: null,
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
  options: StemPlayerOptions = {},
): StoreApi<StemPlayerStore> {
  const {
    mixSaveDelayMs = MIX_SAVE_DELAY_MS,
    scrubSeekDelayMs = SCRUB_SEEK_DELAY_MS,
    mixerClaim: claim = createMixerClaim(),
  } = options;
  let requestedTracks = 0;
  const saver = mixSaver(
    (mixes) => runtimeOf().records.saveStemMix(mixes),
    mixSaveDelayMs,
  );

  const teardownTracks = () => {
    const { commands } = runtimeOf();
    for (let track = 0; track < requestedTracks; track++) {
      commands.mixerSetSolo(track, false);
      commands.mixerSetMute(track, false);
      commands.mixerSetGain(track, UNITY_GAIN);
      commands.mixerUnloadTrack(track);
    }
    requestedTracks = 0;
  };

  return createStore<StemPlayerStore>((set, get) => {
    const mixer = mixerSession({
      set,
      get,
      runtimeOf,
      scrubSeekDelayMs,
      claim,
      isOpen: () => get().setId !== null,
      beforeTeardown: () => {
        saver.flush();
        get().leaveRetime();
      },
      teardownTracks,
      resetState: () => {
        set(closedState);
      },
    });
    const { live, scrubSeek } = mixer;
    const context: ActionContext = {
      set,
      get,
      runtimeOf,
      session: mixer.current,
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
      const engineRate = await mixer.startEngine(opened);
      if (engineRate === null) return;
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
        sections: sortedSections(record.sections),
        lyrics: songLyrics(record.lyrics, record.lyricsRetimed),
      });
      loadWaveforms(opened, record, bars);
    };

    const beginSession = (setId: number) => {
      const opened = mixer.begin();
      set({ ...closedState, status: 'loading', setId });
      return opened;
    };

    const loadSession = async (opened: number, setId: number, bars: number) => {
      try {
        await load(opened, setId, bars);
      } catch (error: unknown) {
        console.warn('[kitbag] stem song failed to open', error);
        if (live(opened)) set({ status: 'failed' });
      }
    };

    return {
      ...closedState,
      open: async (setId, waveformBars) => {
        await loadSession(beginSession(setId), setId, waveformBars);
      },
      // Across an Activity relaunch the new screen can acquire before the old
      // one unmounts, so a release only closes the session it acquired.
      acquireSong: (setId, waveformBars) => {
        const acquired = beginSession(setId);
        void loadSession(acquired, setId, waveformBars);
        return mixer.hold(acquired);
      },
      close: mixer.close,
      ...mixActions(set, get, runtimeOf, saver),
      ...transportActions(get, runtimeOf, scrubSeek, retimeAnchor(context)),
      ...sectionLoopActions(context),
      ...clickActions(context),
      ...renameActions(context),
      ...retimeActions(context),
    };
  });
}

export const stemPlayerStore = createStemPlayerStore(getStemPlayer, {
  mixerClaim,
});
