import { useStore } from 'zustand';

import { getToolInstallStore, type ToolInstallStore } from './installStore.ts';

export function useToolInstall<T>(selector: (state: ToolInstallStore) => T): T {
  return useStore(getToolInstallStore(), selector);
}
