import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  makeMutable,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';

import {
  createReduceMotionStore,
  type ReduceMotionStore,
} from './reduceMotion.ts';

interface LiveReduceMotion {
  readonly store: ReduceMotionStore;
  readonly value: SharedValue<boolean>;
}

let live: LiveReduceMotion | undefined;

function liveReduceMotion(): LiveReduceMotion {
  if (live !== undefined) return live;
  const store = createReduceMotionStore(AccessibilityInfo);
  const value = makeMutable(store.get());
  store.subscribe(() => {
    value.value = store.get();
  });
  live = { store, value };
  return live;
}

export function useReduceMotion(): boolean {
  const { store } = liveReduceMotion();
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useReduceMotionValue(): SharedValue<boolean> {
  return liveReduceMotion().value;
}

// Reanimated's ReduceMotion.System is the setting at launch, so animations take
// an explicit mode from the live value instead.
export function useReduceMotionMode(): ReduceMotion {
  return useReduceMotion() ? ReduceMotion.Always : ReduceMotion.Never;
}
