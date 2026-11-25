import {
  stemSetClickViolation,
  type StemSetClick,
  type StemSetRecord,
} from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import { mixActions, type MixCommands } from '../stemPlayer/actions.ts';
import { patchOf, type ClickField } from '../stemPlayer/clickShape.ts';
import { closedState } from '../stemPlayer/closedState.ts';
import { UNITY_GAIN, UNSHIFTED_KEY } from '../stemPlayer/mix.ts';
import { mixSaver } from '../stemPlayer/mixSaver.ts';
import { openedStemState } from '../stemPlayer/openedState.ts';
import {
  getStemPlayer,
  type StemPlayerRuntime,
} from '../stemPlayer/runtime.ts';
import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';
import { clampedSpeed, wholeKey } from '../stemPlayer/speedKey.ts';
import {
  keyedRows,
  songKeyOf,
  speedKeyChange,
  stemKeyOf,
  unshiftedKey,
} from '../stemPlayer/speedKeyActions.ts';
import { loadWaveforms, rowsOf } from '../stemPlayer/stemTracks.ts';
import {
  MIX_SAVE_DELAY_MS,
  stemPlayerStore,
  type StemPlayerActions,
  type StemPlayerState,
  type StemPlayerStore,
} from '../stemPlayer/store.ts';
import { gridFacts } from '../stemPlayer/tempoActions.ts';
import {
  heldTransport,
  type HeldSlice,
  type HeldTransportActions,
} from './heldTransport.ts';
import { viewedPlay, type ViewLibrary } from './viewedPlay.ts';

export type StemViewState = StemPlayerState & HeldSlice;

type StemViewEdits = Pick<
  StemPlayerActions,
  | 'jumpToSection'
  | 'loopSection'
  | 'setGain'
  | 'toggleMute'
  | 'solo'
  | 'setMasterGain'
  | 'resetMix'
  | 'setSpeed'
  | 'setSongKey'
  | 'setStemKey'
  | 'resetSpeedKey'
  | 'setClickGrouping'
  | 'setClickRate'
  | 'togglePlay'
>;

export interface StemViewActions extends HeldTransportActions, StemViewEdits {
  readonly view: (setId: number, waveformBars: number) => Promise<void>;
  readonly play: () => Promise<AdvanceOutcome | null>;
  readonly leave: () => void;
}

export type StemViewStore = StemViewState & StemViewActions;

export interface StemViewDeps {
  readonly runtimeOf: () => StemPlayerRuntime;
  readonly player: () => Pick<StemPlayerStore, 'takeOver'>;
  readonly library: () => ViewLibrary;
  readonly mixSaveDelayMs?: number;
}

type SpeedKeyShift = Partial<
  Pick<StemViewState, 'speed' | 'songKey' | 'stems'>
>;

const VIEW_CLOSED: StemViewState = { ...closedState, startSec: 0 };

// A viewed song's mix reaches the engine only through Play's load.
const NO_MIXER: MixCommands = {
  mixerSetGain: () => undefined,
  mixerSetMute: () => undefined,
  mixerSetSolo: () => undefined,
  mixerSetMasterGain: () => undefined,
};

export function createStemViewStore({
  runtimeOf,
  player,
  library,
  mixSaveDelayMs = MIX_SAVE_DELAY_MS,
}: StemViewDeps): StoreApi<StemViewStore> {
  let viewing = 0;
  let bars = 0;
  let starting = false;
  let viewed: StemSetRecord | null = null;
  const live = (opened: number) => opened === viewing;
  const plays = viewedPlay(library);
  const records = () => runtimeOf().records;
  const saver = mixSaver((mixes) => {
    const write = records().saveStemMix(mixes);
    plays.track(write);
    return write;
  }, mixSaveDelayMs);

  return createStore<StemViewStore>((set, get) => {
    const transport = heldTransport(set, get);
    const editable = () => get().status === 'ready';

    const saveSpeedKey = (setId: number) => {
      const { speed, songKey, stems } = get();
      plays.track(
        records()
          .saveStemSetSpeedKey(setId, speedKeyChange(speed, songKey, stems))
          .catch((error: unknown) => {
            warn('speed and key not stored', error);
          }),
      );
    };

    const shift = (change: SpeedKeyShift) => {
      const { setId, tempoMode } = get();
      if (!editable() || setId === null || viewed === null)
        return Promise.resolve();
      set(change);
      const { speed, songKey } = get();
      set(gridFacts(viewed, tempoMode, { speed, key: songKey }));
      saveSpeedKey(setId);
      return Promise.resolve();
    };

    const changeClick = <K extends ClickField>(
      field: K,
      value: StemSetClick[K],
    ) => {
      const { setId } = get();
      const patch = patchOf(field, value);
      if (
        !editable() ||
        setId === null ||
        stemSetClickViolation(patch) !== null
      )
        return Promise.resolve();
      set(patch);
      plays.track(
        records()
          .saveStemSetClick(setId, patch)
          .catch((error: unknown) => {
            warn('click setting not stored', error);
          }),
      );
      return Promise.resolve();
    };

    const show = async (opened: number, setId: number) => {
      const runtime = runtimeOf();
      const record = await runtime.records.readStemSet(setId);
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
      viewed = record;
      const { state } = openedStemState(record, {
        engineRate,
        speed: clampedSpeed(record.speed),
        stems: rowsOf(record),
        masterGain: UNITY_GAIN,
      });
      set(state);
      loadWaveforms({ get, set, runtimeOf }, () => live(opened), record, bars);
    };

    return {
      ...VIEW_CLOSED,
      ...transport.actions,
      ...mixActions(set, get, () => NO_MIXER, saver),
      jumpToSection: (index) => {
        const { sections, loop } = get();
        const section = sections[index];
        if (section === undefined) return Promise.resolve();
        const outside =
          loop.kind === 'on' &&
          (section.startSec < loop.startSec || section.startSec >= loop.endSec);
        if (outside) set({ loop: { kind: 'off' } });
        transport.holdAt(section.startSec);
        return Promise.resolve();
      },
      loopSection: (index) => {
        const section = get().sections[index];
        if (section === undefined) return Promise.resolve();
        transport.holdLoop(section);
        if (get().loop.kind === 'on') transport.holdAt(section.startSec);
        return Promise.resolve();
      },
      setSpeed: (requested) => shift({ speed: clampedSpeed(requested) }),
      setSongKey: (requested) => {
        const songKey = wholeKey(requested);
        const previous = get().songKey;
        if (songKey === previous) return Promise.resolve();
        const stems = keyedRows(get().stems, songKeyOf(previous, songKey));
        return shift({ songKey, stems });
      },
      setStemKey: (index, requested) =>
        shift({
          stems: keyedRows(get().stems, stemKeyOf(index, wholeKey(requested))),
        }),
      resetSpeedKey: () =>
        shift({
          speed: KB_MIXER_UNITY_RATE,
          songKey: UNSHIFTED_KEY,
          stems: keyedRows(get().stems, unshiftedKey),
        }),
      setClickGrouping: (groups) => changeClick('clickGrouping', groups),
      setClickRate: (rate) => changeClick('clickRate', rate),
      togglePlay: () => {
        void get().play();
      },
      view: async (setId, waveformBars) => {
        saver.flush();
        const opened = ++viewing;
        bars = waveformBars;
        viewed = null;
        set({ ...VIEW_CLOSED, status: 'loading', setId });
        try {
          await show(opened, setId);
        } catch (error: unknown) {
          warn('stem song not viewable', error);
          if (live(opened)) set({ status: 'failed' });
        }
      },
      play: async () => {
        const { status, setId } = get();
        if (status !== 'ready' || setId === null || starting) return null;
        starting = true;
        saver.flush();
        const opened = viewing;
        const held = transport.held();
        try {
          const outcome = await plays.play({ kind: 'stems', id: setId }, () =>
            player().takeOver(setId, bars, held),
          );
          if (live(opened) && outcome === ADVANCE_OUTCOME.playing)
            get().leave();
          return outcome;
        } finally {
          starting = false;
        }
      },
      leave: () => {
        saver.flush();
        viewing++;
        viewed = null;
        set(VIEW_CLOSED);
      },
    };
  });
}

export const stemViewStore = createStemViewStore({
  runtimeOf: getStemPlayer,
  player: () => stemPlayerStore.getState(),
  library: () => libraryStore.getState(),
});
