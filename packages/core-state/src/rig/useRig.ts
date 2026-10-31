import { useStore } from 'zustand';

import type { RigClick, RigClickStore } from './rigClick.ts';
import type {
  RouteLatencyActions,
  RouteLatencyState,
  RouteLatencyStore,
} from './routeLatency.ts';
import {
  getSubdivisionAccentsStore,
  type SubdivisionAccentsStore,
} from './subdivisionAccents.ts';

export function useRouteLatency<T>(
  store: RouteLatencyStore,
  selector: (state: RouteLatencyState & RouteLatencyActions) => T,
): T {
  return useStore(store, selector);
}

export function useRigClick<T>(
  store: RigClickStore,
  selector: (state: RigClick) => T,
): T {
  return useStore(store, selector);
}

export function useSubdivisionAccents<T>(
  selector: (state: SubdivisionAccentsStore) => T,
): T {
  return useStore(getSubdivisionAccentsStore(), selector);
}
