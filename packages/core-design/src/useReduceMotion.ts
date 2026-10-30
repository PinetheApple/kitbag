import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  makeMutable,
  ReduceMotion,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import {
  bindToValue,
  createReduceMotionStore,
  type ReduceMotionStore,
} from './reduceMotion.ts';

interface LiveReduceMotion {
  readonly store: ReduceMotionStore;
  readonly value: SharedValue<boolean>;
}

let live: LiveReduceMotion | undefined;

function liveReduceMotion(launch: boolean): LiveReduceMotion {
  if (live !== undefined) return live;
  const store = createReduceMotionStore(AccessibilityInfo, launch);
  const value = makeMutable(store.get());
  bindToValue(store, (enabled) => {
    value.value = enabled;
  });
  live = { store, value };
  return live;
}

// Reanimated's hook returns the setting at launch: right for the first frame,
// stale after a toggle, so it only seeds the live store.
export function useReduceMotion(): boolean {
  const { store } = liveReduceMotion(useReducedMotion());
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useReduceMotionValue(): SharedValue<boolean> {
  return liveReduceMotion(useReducedMotion()).value;
}

// ReduceMotion.System is also the launch value, so animations take an explicit
// mode from the live one.
export function useReduceMotionMode(): ReduceMotion {
  return useReduceMotion() ? ReduceMotion.Always : ReduceMotion.Never;
}
