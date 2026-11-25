import {
  stemSetClickViolation,
  type StemSetClick,
  type StemSetRecord,
} from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import { stemMixActions, type StemMixCommands } from '../stemPlayer/actions.ts';
import { patchOf, type ClickField } from '../stemPlayer/clickShape.ts';
import { closedState } from '../stemPlayer/closedState.ts';
import { boundsOf, loopHolds } from '../stemPlayer/loop.ts';
import { UNITY_GAIN, UNSHIFTED_KEY } from '../stemPlayer/mix.ts';
import { mixSaver } from '../stemPlayer/mixSaver.ts';
import { openedStemState } from '../stemPlayer/openedState.ts';
import {
  getStemPlayer,
  type StemPlayerRuntime,
} from '../stemPlayer/runtime.ts';
import type { AdvanceOutcome } from '../stemPlayer/songEnd.ts';
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
import { viewSession, type ViewLibrary } from './viewedPlay.ts';

export type StemViewState = StemPlayerState & HeldSlice;

type StemViewEdits = Pick<
  StemPlayerActions,
  | 'jumpToSection'
  | 'loopSection'
  | 'setGain'
  | 'toggleMute'
  | 'solo'
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

const VIEW_MIX_COMMANDS: StemMixCommands = {
  mixerSetGain: () => undefined,
  mixerSetMute: () => undefined,
  mixerSetSolo: () => undefined,
};

export function createStemViewStore({
  runtimeOf,
  player,
  library,
  mixSaveDelayMs = MIX_SAVE_DELAY_MS,
}: StemViewDeps): StoreApi<StemViewStore> {
  let viewed: StemSetRecord | null = null;
  const records = () => runtimeOf().records;

  return createStore<StemViewStore>((set, get) => {
    const transport = heldTransport(set, get);
    const saver = mixSaver((mixes) => {
      const write = records().saveStemMix(mixes);
      session.track(write);
      return write;
    }, mixSaveDelayMs);
    const session = viewSession({
      kind: 'stems',
      library,
      viewedId: () => (get().status === 'ready' ? get().setId : null),
      held: transport.held,
      opening: (setId) => {
        viewed = null;
        set({ ...VIEW_CLOSED, status: 'loading', setId });
      },
      show: (opened, setId, bars) => show(opened, setId, bars),
      failed: () => {
        set({ status: 'failed' });
      },
      closing: () => {
        viewed = null;
        set(VIEW_CLOSED);
      },
      takeOver: (setId, bars, held) => player().takeOver(setId, bars, held),
      flush: saver.flush,
    });
    const { live } = session;
    const editable = () => get().status === 'ready';

    const shift = (change: SpeedKeyShift) => {
      const { setId, tempoMode } = get();
      if (!editable() || setId === null || viewed === null)
        return Promise.resolve();
      set(change);
      const { speed, songKey, stems } = get();
      set(gridFacts(viewed, tempoMode, { speed, key: songKey }));
      session.save(
        records().saveStemSetSpeedKey(
          setId,
          speedKeyChange(speed, songKey, stems),
        ),
        'speed and key not stored',
      );
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
      session.save(
        records().saveStemSetClick(setId, patch),
        'click setting not stored',
      );
      return Promise.resolve();
    };

    const show = async (opened: number, setId: number, bars: number) => {
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
      ...stemMixActions(set, get, () => VIEW_MIX_COMMANDS, saver),
      jumpToSection: (index) => {
        const { sections, loop } = get();
        const section = sections[index];
        if (section === undefined) return Promise.resolve();
        if (loop.kind === 'on' && !loopHolds(loop, section.startSec))
          set({
            loop: { kind: 'off' },
            loopFailure: null,
            undoableLoop: boundsOf(loop),
          });
        transport.holdAt(section.startSec);
        return Promise.resolve();
      },
      loopSection: (index) => {
        const { sections, loop, undoableLoop } = get();
        const section = sections[index];
        if (section === undefined || !transport.holdLoop(section))
          return Promise.resolve();
        set({
          undoableLoop: loop.kind === 'on' ? boundsOf(loop) : undoableLoop,
        });
        transport.holdAt(section.startSec);
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
        void session.play();
      },
      view: session.view,
      play: session.play,
      leave: session.leave,
    };
  });
}

export const stemViewStore = createStemViewStore({
  runtimeOf: getStemPlayer,
  player: () => stemPlayerStore.getState(),
  library: () => libraryStore.getState(),
});
