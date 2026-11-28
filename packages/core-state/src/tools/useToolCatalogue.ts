import { useMemo } from 'react';

import { onToolIds, toolCounts, toolSections } from './catalogue.ts';
import { useToolInstall } from './useToolInstall.ts';
import { useTools } from './useTools.ts';

export function useToolCatalogue(builtIds: readonly string[]) {
  const catalogue = useToolInstall((s) => s.catalogue);
  const off = useTools((s) => s.off);
  return useMemo(() => {
    const sections = toolSections(builtIds, catalogue);
    return {
      sections,
      on: onToolIds(sections, off),
      counts: toolCounts(sections, off),
    };
  }, [builtIds, catalogue, off]);
}
