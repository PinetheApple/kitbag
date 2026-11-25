import { meterOverrideOf } from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import type { SongPlayerActions } from '../songPlayer/actions.ts';
import {
  getSongPlayer,
  type SongPlayerRuntime,
} from '../songPlayer/runtime.ts';
import {
  songClickActions,
  standaloneMetronome,
  type SongClickActions,
  type SongClickMetronome,
} from '../songPlayer/songClick.ts';
import { recordGrid } from '../songPlayer/songGrid.ts';
import {
  linkedPreset,
  readyState,
  songPresetActions,
} from '../songPlayer/songPreset.ts';
import { songWaveform } from '../songPlayer/songWaveform.ts';
import {
  closedState,
  factsOf,
  type SongPlayerState,
} from '../songPlayer/state.ts';
import { songPlayerStore, type SongPlayerStore } from '../songPlayer/store.ts';
import type { AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import { clampedSpeed } from '../stemPlayer/speedKey.ts';
import { tempoModeOf } from '../stemPlayer/tempoGrid.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import {
  heldTransport,
  type HeldSlice,
  type HeldTransportActions,
} from './heldTransport.ts';
import { viewSession, type ViewLibrary } from './viewedPlay.ts';

export type SongViewState = SongPlayerState & HeldSlice;

export interface SongViewActions
  extends
    HeldTransportActions,
    SongClickActions,
    Pick<SongPlayerActions, 'togglePlay' | 'setSpeed' | 'resetSpeed'> {
  readonly view: (songId: number, waveformBars: number) => Promise<void>;
  readonly play: () => Promise<AdvanceOutcome | null>;
  readonly leave: () => void;
}

export type SongViewStore = SongViewState & SongViewActions;

export interface SongViewDeps {
  readonly runtimeOf: () => SongPlayerRuntime;
  readonly player: () => Pick<SongPlayerStore, 'takeOver'>;
  readonly library: () => ViewLibrary;
  readonly metronome: SongClickMetronome;
}

const VIEW_CLOSED: SongViewState = { ...closedState, startSec: 0 };

export function createSongViewStore({
  runtimeOf,
  player,
  library,
  metronome,
}: SongViewDeps): StoreApi<SongViewStore> {
  return createStore<SongViewStore>((set, get) => {
    const transport = heldTransport(set, get);
    const session = viewSession({
      kind: 'song',
      library,
      viewedId: () => (get().status === 'ready' ? get().songId : null),
      held: transport.held,
      opening: (songId, bars) => {
        waveform.reset(bars);
        set({ ...VIEW_CLOSED, status: 'loading', songId });
      },
      show: (opened, songId) => show(opened, songId),
      failed: () => {
        set({ status: 'failed' });
      },
      closing: () => {
        set(VIEW_CLOSED);
      },
      takeOver: (songId, bars, held) => player().takeOver(songId, bars, held),
    });
    const { live } = session;
    const waveform = songWaveform({ set, runtimeOf, live });
    const clicks = songClickActions({
      set,
      get: () => ({ ...get(), click: false }),
      metronome,
    });
    const presets = songPresetActions({
      set,
      get,
      runtimeOf,
      session: session.current,
      live,
    });

    const savedClick =
      <A extends unknown[]>(edit: (...args: A) => void) =>
      (...args: A) => {
        edit(...args);
        if (get().clickSettings.dirty)
          session.save(presets.saveForSong(), 'song click not stored');
      };

    const setSpeed = (requested: number) => {
      const { status, songId, speed: previous } = get();
      const speed = clampedSpeed(requested);
      if (status !== 'ready' || songId === null || speed === previous)
        return Promise.resolve();
      set({ speed });
      session.save(
        runtimeOf().records.saveSongSpeed(songId, speed),
        'song speed not stored',
      );
      return Promise.resolve();
    };

    const show = async (opened: number, songId: number) => {
      const runtime = runtimeOf();
      const [record, preset] = await Promise.all([
        runtime.records.readSong(songId),
        linkedPreset(runtime, songId),
      ]);
      if (!live(opened)) return;
      if (record === undefined) {
        set({ status: 'missing' });
        return;
      }
      const engineRate = runtime.engine.sampleRate();
      if (engineRate <= 0) {
        set({ status: 'failed' });
        return;
      }
      const durationFrames = secondsToFrames(record.durationSec, engineRate);
      const meter = {
        meterOverride: meterOverrideOf(record),
        detected: recordGrid(record).detected,
      };
      const { clickSettings } = clicks.seeded(meter);
      set({
        ...factsOf(record, tempoModeOf(record)),
        clickSettings,
        ...readyState(
          { record, preset, engineRate, durationFrames },
          clickSettings,
        ),
        click: preset !== undefined,
        speed: clampedSpeed(record.speed),
      });
      waveform.show(opened, record.waveformPath);
    };

    return {
      ...VIEW_CLOSED,
      ...transport.actions,
      setClickSounds: savedClick(clicks.actions.setClickSounds),
      cycleClickAccent: savedClick(clicks.actions.cycleClickAccent),
      setClickCountIn: savedClick(clicks.actions.setClickCountIn),
      setSpeed,
      resetSpeed: () => setSpeed(KB_MIXER_UNITY_RATE),
      togglePlay: () => {
        void session.play();
      },
      view: session.view,
      play: session.play,
      leave: session.leave,
    };
  });
}

export const songViewStore = createSongViewStore({
  runtimeOf: getSongPlayer,
  player: () => songPlayerStore.getState(),
  library: () => libraryStore.getState(),
  metronome: standaloneMetronome,
});
