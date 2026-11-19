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
import {
  COUNT_IN_SCOPE,
  type CountInScope,
} from '../metronome/countInScope.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import { REPEAT_PLAN, type RepeatPlan, type RepeatSetup } from './repeat.ts';

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
  readonly presetFor: (preset: SongPreset) => SongPreset;
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
): SongPreset {
  if (plan?.kind !== REPEAT_PLAN.setlist) return preset;
  const setup = plan.songs.get(preset.uuid);
  if (setup === undefined) return preset;
  return { ...preset, ...presetFieldsOfLogged(setup.settings) };
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
  const clear = () => {
    if (state.getState().plan === null) return;
    const countIn = restore();
    state.setState({ plan: null, userCountIn: null });
    metronome().setCountIn(countIn);
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
    else
      metronome().setCountIn(
        setup === null ? restore() : countInOf(setup.countIn),
      );
  });
  const start = async (plan: RepeatPlan) => {
    clear();
    state.setState({ plan, userCountIn: metronome().countIn });
    const library = port.library.getState();
    if (plan.kind === REPEAT_PLAN.setlist) {
      const { presetId, itemId, setlistId } = plan.load;
      await library.loadSong(presetId, itemId, setlistId);
      return;
    }
    await library.leaveSetlist();
    port.applySettings(plan.setup.settings);
    metronome().setCountIn(countInOf(plan.setup.countIn));
  };
  return {
    state,
    start,
    clear,
    presetFor: (preset) => overlaidPreset(state.getState().plan, preset),
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
