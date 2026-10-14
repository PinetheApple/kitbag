// React binding for the tuner store. Human-speed values only (§13.3): the
// needle, cents and detected string come from the HostObject in a worklet and
// never pass through here.

import { useStore } from 'zustand';

import { tunerStore } from './store.ts';
import type { TunerStore } from './types.ts';

/** Subscribe to one slice of tuner state or one action. */
export function useTuner<T>(selector: (state: TunerStore) => T): T {
  return useStore(tunerStore, selector);
}
