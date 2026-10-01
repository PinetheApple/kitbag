import { useStore } from 'zustand';

import { metronomeStore, type MetronomeStore } from './store.ts';

export function useMetronome<T>(selector: (state: MetronomeStore) => T): T {
  return useStore(metronomeStore, selector);
}
