// React binding for the metronome config store. It lives here because
// core-state is the one package that holds stores and the one that may import
// zustand (SPEC §13.1, §13.6) — a tool subscribing by hand would be a second
// store binding.
//
// Human-speed values ONLY (§13.3, §13.4): every field this selects changes when
// a finger moves. bar_phase / current_beat / current_bpm are never in the store
// and never come through here — worklets poll them from the JSI HostObject.

import { useStore } from 'zustand';

import { metronomeStore, type MetronomeStore } from './store.ts';

/** Subscribe to one slice of the metronome config. */
export function useMetronome<T>(selector: (state: MetronomeStore) => T): T {
  return useStore(metronomeStore, selector);
}
