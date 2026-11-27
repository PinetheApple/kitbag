import {
  DEFAULT_VOLUME,
  getSubdivisionAccentsStore,
  reloadSubdivisionAccentsStore,
  replaySubdivisionAccents,
  type createMetronomeStore,
  type RouteLatencyStore,
  type SendSubdivisionAccents,
  type SubdivisionAccentsStoreApi,
} from '@kitbag/core-state';

import type { AppStateSource } from './rigClickLifecycle.ts';
import type { VolumePersistence } from './rigPreferences.ts';

export interface RigStart {
  readonly routeLatency: RouteLatencyStore;
  readonly metronome: ReturnType<typeof createMetronomeStore>;
  readonly volume: VolumePersistence;
  readonly sendAccents: SendSubdivisionAccents;
  readonly appState: AppStateSource;
  readonly accents?: SubdivisionAccentsStoreApi;
}

export interface RigReload extends Pick<
  RigStart,
  'routeLatency' | 'metronome' | 'volume'
> {
  readonly reloadAccents?: () => void;
}

export function reloadRig({
  routeLatency,
  metronome,
  volume,
  reloadAccents = reloadSubdivisionAccentsStore,
}: RigReload): Promise<void> {
  metronome.getState().setVolume(volume.load() ?? DEFAULT_VOLUME);
  reloadAccents();
  return routeLatency.getState().reload();
}

// The engine keeps no rig settings across a process start; this is their replay.
export function startRig({
  routeLatency,
  metronome,
  volume,
  sendAccents,
  appState,
  accents = getSubdivisionAccentsStore(),
}: RigStart): void {
  try {
    const saved = volume.load();
    if (saved !== undefined) metronome.getState().setVolume(saved);
    metronome.subscribe((state, previous) => {
      if (state.volume !== previous.volume) volume.save(state.volume);
    });
    replaySubdivisionAccents(accents, sendAccents);
  } catch (error) {
    console.warn('[kitbag] rig settings not applied', error);
  }
  appState.addEventListener('change', (state) => {
    if (state === 'background') void routeLatency.getState().flush();
  });
  routeLatency
    .getState()
    .start()
    .catch((error: unknown) => {
      console.warn('[kitbag] route latency not applied', error);
    });
}
