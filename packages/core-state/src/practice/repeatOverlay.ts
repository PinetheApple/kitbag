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
  loadedBaselineOf,
  loadedPresetOf,
  type LibraryState,
  type LibraryStore,
  type PresetOverlay,
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

const PLANNED = { left: 'left', own: 'own', logged: 'logged' } as const;

type Planned =
  | { readonly kind: typeof PLANNED.left }
  | { readonly kind: typeof PLANNED.own }
  | { readonly kind: typeof PLANNED.logged; readonly setup: RepeatSetup };

function plannedSetup(plan: RepeatPlan, state: LibraryState): Planned {
  if (plan.kind === REPEAT_PLAN.freePlay) return { kind: PLANNED.left };
  if (state.loaded?.setlistId !== plan.load.setlistId)
    return { kind: PLANNED.left };
  const preset = loadedPresetOf(state);
  if (preset === undefined || loadedBaselineOf(state) === preset)
    return { kind: PLANNED.own };
  const setup = plan.songs.get(preset.uuid);
  return setup === undefined
    ? { kind: PLANNED.own }
    : { kind: PLANNED.logged, setup };
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

function memoised(plan: RepeatPlan): PresetOverlay {
  const made = new Map<number | null, WeakMap<SongPreset, SongPreset>>();
  return (preset, setlistId) => {
    const bySetlist = made.get(setlistId) ?? new WeakMap();
    made.set(setlistId, bySetlist);
    const known = bySetlist.get(preset);
    if (known !== undefined) return known;
    const next = overlaidPreset(plan, preset, setlistId);
    bySetlist.set(preset, next);
    return next;
  };
}

interface Session {
  readonly port: RepeatPort;
  readonly state: StoreApi<RepeatOverlayState>;
  readonly setCountIn: (countIn: CountInConfig) => void;
  readonly restore: () => CountInConfig;
  readonly clear: () => void;
}

function followLibrary(session: Session): void {
  const { port, state, setCountIn, restore, clear } = session;
  port.library.subscribe((next, previous) => {
    const { plan } = state.getState();
    if (plan === null) return;
    const planned = plannedSetup(plan, next);
    if (next.loaded === previous.loaded) {
      const dropped = next.presetOverlay !== previous.presetOverlay;
      if (dropped && planned.kind === PLANNED.own) setCountIn(restore());
      return;
    }
    if (plan.kind === REPEAT_PLAN.freePlay) {
      if (next.loaded !== null) clear();
      return;
    }
    if (planned.kind === PLANNED.left) clear();
    else if (planned.kind === PLANNED.logged)
      setCountIn(countInOf(planned.setup.countIn));
    else setCountIn(restore());
  });
}

async function startRepeat(session: Session, plan: RepeatPlan) {
  const { port, state, setCountIn } = session;
  session.clear();
  state.setState({ plan, userCountIn: port.metronome.getState().countIn });
  const library = port.library.getState();
  if (plan.kind === REPEAT_PLAN.setlist) {
    library.setPresetOverlay(memoised(plan));
    const { presetId, itemId, setlistId } = plan.load;
    await applyCountInTransiently(() =>
      library.loadSong(presetId, itemId, setlistId),
    );
    return;
  }
  await library.leaveSetlist();
  applyCountInTransiently(() => {
    port.applySettings(plan.setup.settings);
  });
  setCountIn(countInOf(plan.setup.countIn));
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
  const clear = () => {
    if (state.getState().plan === null) return;
    const countIn = restore();
    state.setState({ plan: null, userCountIn: null });
    port.library.getState().setPresetOverlay(null);
    setCountIn(countIn);
  };
  const session: Session = { port, state, setCountIn, restore, clear };
  followLibrary(session);
  const loadSaved = async (load: SessionLoad) => {
    clear();
    const { loadSong } = port.library.getState();
    if (load.kind === SESSION_LOAD.setlist)
      await loadSong(load.presetId, load.itemId, load.setlistId);
    else await loadSong(load.presetId);
  };
  return {
    state,
    start: (plan) => startRepeat(session, plan),
    clear,
    loadSaved,
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
