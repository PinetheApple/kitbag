import { useStore } from 'zustand';

import { tempoLadderStore, type TempoLadderStore } from './store.ts';

export function useTempoLadder<T>(selector: (state: TempoLadderStore) => T): T {
  return useStore(tempoLadderStore, selector);
}
