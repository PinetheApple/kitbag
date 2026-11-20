import { useStore } from 'zustand';

import {
  getHistoryPrefsStore,
  type HistoryPrefsStore,
} from './historyPrefs.ts';

export function useHistoryPrefs<T>(
  selector: (state: HistoryPrefsStore) => T,
): T {
  return useStore(getHistoryPrefsStore(), selector);
}
