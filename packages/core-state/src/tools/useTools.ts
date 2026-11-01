import { useStore } from 'zustand';

import { getToolsStore, type ToolsStore } from './store.ts';

export function useTools<T>(selector: (state: ToolsStore) => T): T {
  return useStore(getToolsStore(), selector);
}
