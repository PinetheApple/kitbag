import { useMemo } from 'react';
import { useStore } from 'zustand';

import { toolCounts, toolRoster, toolSections } from './catalogue.ts';
import { getToolInstallStore, type ToolInstallStore } from './installStore.ts';
import { useTools } from './useTools.ts';

export function useToolInstall<T>(selector: (state: ToolInstallStore) => T): T {
  return useStore(getToolInstallStore(), selector);
}

export function useToolCatalogue(builtIds: readonly string[]) {
  const catalogue = useToolInstall((s) => s.catalogue);
  const off = useTools((s) => s.off);
  return useMemo(() => {
    const sections = toolSections(builtIds, catalogue);
    return {
      sections,
      roster: toolRoster(sections),
      counts: toolCounts(sections, off),
    };
  }, [builtIds, catalogue, off]);
}
