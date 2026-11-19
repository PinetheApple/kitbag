import {
  presetFieldsOfLogged,
  type LoggedCountIn,
  type LoggedSettings,
  type SongPreset,
} from '@kitbag/core-db';
import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  libraryStore,
  loadedPresetOf,
  type LibraryState,
  type LibraryStore,
} from '../library/store.ts';
import { isCountInBars, type CountInConfig } from '../metronome/config.ts';
import { applyCountInTransiently } from '../metronome/countInPersistence.ts';
import {
  COUNT_IN_SCOPE,
  type CountInScope,
} from '../metronome/countInScope.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import {
  REPEAT_PLAN,
  SESSION_LOAD,
  type RepeatPlan,
  type RepeatSetup,
  type SessionLoad,
} from './repeat.ts';

export interface RepeatPort {
  readonly library: StoreApi<LibraryStore>;
  readonly metronome: StoreApi<MetronomeStore>;
  readonly applySettings: (settings: LoggedSettings) => void;
}

export interface RepeatOverlayState {
  readonly plan: RepeatPlan | null;
  readonly userCountIn: CountInConfig | null;
}

export interface RepeatOverlay {
  readonly state: StoreApi<RepeatOverlayState>;
  readonly start: (plan: RepeatPlan) => Promise<void>;
  readonly clear: () => void;
  readonly loadSaved: (load: SessionLoad) => Promise<void>;
  readonly presetFor: (
    preset: SongPreset,
    setlistId: number | null,
  ) => SongPreset;
}

export function restoredCountIn(
  user: CountInConfig,
  current: CountInConfig,
  scope: CountInScope,
): CountInConfig {
  const bars = scope === COUNT_IN_SCOPE.always ? user.bars : current.bars;
  return { bars, distinct: user.distinct, sound: user.sound };
}

function countInOf({ bars, distinct, sound }: LoggedCountIn): CountInConfig {
  return {
    bars: isCountInBars(bars) ? bars : KB_COUNT_IN_OFF,
    distinct,
    sound,
  };
}

function plannedSetup(
  plan: RepeatPlan,
  state: LibraryState,
): RepeatSetup | null | undefined {
  if (plan.kind === REPEAT_PLAN.freePlay) return undefined;
  if (state.loaded?.setlistId !== plan.load.setlistId) return undefined;
  const preset = loadedPresetOf(state);
  return preset === undefined ? null : (plan.songs.get(preset.uuid) ?? null);
}

export function overlaidPreset(
  plan: RepeatPlan | null,
  preset: SongPreset,
  setlistId: number | null,
): SongPreset {
  if (plan?.kind !== REPEAT_PLAN.setlist) return preset;
  if (setlistId !== plan.load.setlistId) return preset;
  const setup = plan.songs.get(preset.uuid);
  if (setup === undefined) return preset;
  return { ...preset, ...presetFieldsOfLogged(setup.settings) };
}

function memoised(plan: RepeatPlan) {
  const made = new Map<number | null, WeakMap<SongPreset, SongPreset>>();
  return (preset: SongPreset, setlistId: number | null) => {
    const bySetlist = made.get(setlistId) ?? new WeakMap();
    made.set(setlistId, bySetlist);
    const known = bySetlist.get(preset);
    if (known !== undefined) return known;
    const next = overlaidPreset(plan, preset, setlistId);
    bySetlist.set(preset, next);
    return next;
  };
}

export function createRepeatOverlay(port: RepeatPort): RepeatOverlay {
  const state = createStore<RepeatOverlayState>(() => ({
    plan: null,
    userCountIn: null,
  }));
  const metronome = () => port.metronome.getState();
  const restore = () => {
    const { userCountIn } = state.getState();
    const live = metronome();
    return userCountIn === null
      ? live.countIn
      : restoredCountIn(userCountIn, live.countIn, live.countInScope);
  };
  const setCountIn = (countIn: CountInConfig) => {
    applyCountInTransiently(() => {
      metronome().setCountIn(countIn);
    });
  };
  let presetFor: RepeatOverlay['presetFor'] = (preset) => preset;
  const clear = () => {
    if (state.getState().plan === null) return;
    const countIn = restore();
    state.setState({ plan: null, userCountIn: null });
    presetFor = (preset) => preset;
    port.library.getState().setPresetOverlay(null);
    setCountIn(countIn);
  };
  port.library.subscribe((next, previous) => {
    const { plan } = state.getState();
    if (plan === null || next.loaded === previous.loaded) return;
    if (plan.kind === REPEAT_PLAN.freePlay) {
      if (next.loaded !== null) clear();
      return;
    }
    const setup = plannedSetup(plan, next);
    if (setup === undefined) clear();
    else setCountIn(setup === null ? restore() : countInOf(setup.countIn));
  });
  const start = async (plan: RepeatPlan) => {
    clear();
    state.setState({ plan, userCountIn: metronome().countIn });
    const library = port.library.getState();
    if (plan.kind === REPEAT_PLAN.setlist) {
      presetFor = memoised(plan);
      library.setPresetOverlay(presetFor);
      const { presetId, itemId, setlistId } = plan.load;
      let loading = Promise.resolve();
      applyCountInTransiently(() => {
        loading = library.loadSong(presetId, itemId, setlistId);
      });
      await loading;
      return;
    }
    await library.leaveSetlist();
    applyCountInTransiently(() => {
      port.applySettings(plan.setup.settings);
    });
    setCountIn(countInOf(plan.setup.countIn));
  };
  const loadSaved = async (load: SessionLoad) => {
    clear();
    const { loadSong } = port.library.getState();
    if (load.kind === SESSION_LOAD.setlist)
      await loadSong(load.presetId, load.itemId, load.setlistId);
    else await loadSong(load.presetId);
  };
  return {
    state,
    start,
    clear,
    loadSaved,
    presetFor: (preset, setlistId) => presetFor(preset, setlistId),
  };
}

let configured: RepeatOverlay | undefined;

export function configureRepeatOverlay(
  applySettings: RepeatPort['applySettings'],
): RepeatOverlay {
  if (configured !== undefined)
    throw new Error('Repeat overlay is already configured');
  configured = createRepeatOverlay({
    library: libraryStore,
    metronome: metronomeStore,
    applySettings,
  });
  return configured;
}

export function getRepeatOverlay(): RepeatOverlay | undefined {
  return configured;
}
