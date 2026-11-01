import {
  configureSubdivisionAccentsPersistence,
  createRouteLatencyStore,
  metronomeStore,
  type RouteLatencyDeps,
  type RouteLatencyStore,
  type SendSubdivisionAccents,
} from '@kitbag/core-state';
import { AppState } from 'react-native';

import type { StoredPreference } from '@/runtime/storedPreference';

import {
  accentsPersistence,
  volumePersistence,
  type RigKey,
} from './rigPreferences.ts';
import { startRig } from './rigStart.ts';

export type RouteStorage = Pick<
  RouteLatencyDeps,
  'list' | 'save' | 'remove' | 'watchOutputRoute'
>;

export interface RigBindings {
  readonly stored: (key: RigKey) => StoredPreference;
  readonly sendAccents: SendSubdivisionAccents;
  readonly routes: RouteStorage;
}

export function applyLatency(offsetMs: number): void {
  metronomeStore.getState().setLatency(offsetMs);
}

export function bootRig({
  stored,
  sendAccents,
  routes,
}: RigBindings): RouteLatencyStore {
  configureSubdivisionAccentsPersistence(accentsPersistence(stored));
  const routeLatency = createRouteLatencyStore({
    ...routes,
    applyLatency,
    appliedLatency: () => metronomeStore.getState().latencyOffset,
  });
  startRig({
    routeLatency,
    metronome: metronomeStore,
    volume: volumePersistence(stored),
    sendAccents,
    appState: AppState,
  });
  return routeLatency;
}
