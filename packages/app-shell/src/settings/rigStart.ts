import {
  getSubdivisionAccentsStore,
  metronomeStore,
  replaySubdivisionAccents,
  type RouteLatencyStore,
  type SendSubdivisionAccents,
} from '@kitbag/core-state';

import type { VolumePersistence } from './rigPreferences.ts';

export interface RigStart {
  readonly routeLatency: RouteLatencyStore;
  readonly volume: VolumePersistence;
  readonly sendAccents: SendSubdivisionAccents;
}

// The engine keeps no rig settings across a process start; this is their replay.
export function startRig({
  routeLatency,
  volume,
  sendAccents,
}: RigStart): void {
  try {
    const saved = volume.load();
    if (saved !== undefined) metronomeStore.getState().setVolume(saved);
    metronomeStore.subscribe((state, previous) => {
      if (state.volume !== previous.volume) volume.save(state.volume);
    });
    replaySubdivisionAccents(getSubdivisionAccentsStore(), sendAccents);
  } catch (error) {
    console.warn('[kitbag] rig settings not applied', error);
  }
  routeLatency
    .getState()
    .start()
    .catch((error: unknown) => {
      console.warn('[kitbag] route latency not applied', error);
    });
}
