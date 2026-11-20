import { useStore } from 'zustand';

import {
  getPracticeHistoryStore,
  type PracticeHistoryStore,
} from './historyList.ts';

export function usePracticeHistory<T>(
  selector: (state: PracticeHistoryStore) => T,
): T {
  return useStore(getPracticeHistoryStore(), selector);
}
